/**
 * Meta Facebook Login router.
 *
 * Mirrors server/routers/canva.ts but for the Meta user-scope OAuth flow.
 * See server/services/meta.ts for the token lifecycle rationale.
 *
 * Procedures:
 *   - getAuthUrl (admin only): builds the Facebook Login dialog URL with
 *     PKCE state and returns it. The frontend redirects window.location.
 *   - isConnected (admin only): returns whether the admin user currently
 *     has a valid token + expiry metadata for the settings UI.
 *   - disconnect (admin only): clears the stored token.
 *
 * Express callback:
 *   - handleMetaCallback: exchanges the returned `code` for a short-lived
 *     token, swaps to a long-lived token, stores it against the admin user,
 *     and redirects to /settings?meta=connected|error.
 */
import { adminProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { ENV } from "../_core/env";
import { TRPCError } from "@trpc/server";
import {
  generatePKCE,
  getMetaAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchMetaUserProfile,
  computeExpiresAt,
} from "../services/meta";

// PKCE store — same pattern as canva.ts. In-memory Map keyed on state string,
// 10-minute TTL. Acceptable for single-instance DO App Platform deployment.
// If we go multi-instance, swap for Redis.
const metaPkceStore = new Map<string, { verifier: string; expiresAt: number }>();

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(metaPkceStore.entries());
  for (const [key, value] of entries) {
    if (value.expiresAt < now) {
      metaPkceStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export const metaRouter = router({
  /**
   * Build the Facebook Login authorization URL and return it to the frontend.
   * Frontend redirects window.location to this URL and Facebook brings the user
   * back to /api/meta/callback after consent.
   */
  getAuthUrl: adminProcedure.query(({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }
    if (!ENV.metaAppId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "META_APP_ID env var is not configured",
      });
    }

    const { verifier, challenge } = generatePKCE();
    const state = `${ctx.user.openId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    metaPkceStore.set(state, { verifier, expiresAt: Date.now() + 10 * 60 * 1000 });

    const authUrl = getMetaAuthUrl(ENV.metaOAuthRedirectUri, state, challenge);
    return { authUrl };
  }),

  /**
   * Return connection status for the current admin user. Used by the Settings
   * UI to render Connect/Disconnect buttons and the expiry countdown.
   */
  isConnected: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { connected: false as const };
    const tokens = await db.getUserMetaTokens(ctx.user.openId);
    if (!tokens?.accessToken) {
      return { connected: false as const };
    }
    return {
      connected: true as const,
      expiresAt: tokens.expiresAt,
      connectedAt: tokens.connectedAt,
      name: tokens.name ?? null,
    };
  }),

  /**
   * Clear the current admin user's Meta token. Preview requests will fall
   * back to the existing "Open on Meta" link until they reconnect.
   */
  disconnect: adminProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }
    await db.updateUserMetaTokens(ctx.user.openId, null, null);
    return { success: true };
  }),
});

/**
 * Express route handler for the OAuth callback. Registered at
 * /api/meta/callback in server/_core/index.ts next to the Canva callback.
 *
 * Flow:
 *   1. Validate query params (code + state OR error).
 *   2. Look up the PKCE verifier by state, reject if missing/expired.
 *   3. Exchange code → short-lived token.
 *   4. Exchange short-lived → long-lived token.
 *   5. Store against the admin user identified by state prefix.
 *   6. Redirect to /settings?meta=connected or /settings?meta=error.
 */
export async function handleMetaCallback(req: any, res: any) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error(`[Meta] OAuth error: ${error} - ${error_description}`);
    return res.redirect(
      `/settings?meta=error&message=${encodeURIComponent((error_description as string) || (error as string))}`,
    );
  }

  if (!code || !state) {
    return res.redirect(`/settings?meta=error&message=${encodeURIComponent("Missing code or state")}`);
  }

  const pkceData = metaPkceStore.get(state as string);
  if (!pkceData) {
    return res.redirect(
      `/settings?meta=error&message=${encodeURIComponent("Invalid or expired state — try connecting again")}`,
    );
  }

  const openId = (state as string).split("-")[0];

  try {
    // 1. Exchange code for short-lived token.
    const shortLived = await exchangeCodeForToken(code as string, ENV.metaOAuthRedirectUri, pkceData.verifier);

    // 2. Swap short-lived for long-lived (60-day) token so we don't have to
    //    re-auth in an hour.
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    const expiresAt = computeExpiresAt(longLived);

    // 3. Store against the admin user's openId.
    await db.updateUserMetaTokens(openId, longLived.access_token, expiresAt);

    // 4. Best-effort profile fetch just for logging — don't fail the callback
    //    if Facebook hiccups.
    try {
      const profile = await fetchMetaUserProfile(longLived.access_token);
      console.log(`[Meta] Connected user ${profile.name} (${profile.id}) for openId=${openId}`);
    } catch (profileErr: any) {
      console.warn(`[Meta] Profile fetch failed after token exchange:`, profileErr?.message ?? profileErr);
    }

    // 5. Clean up PKCE verifier + redirect back to Settings.
    metaPkceStore.delete(state as string);
    return res.redirect("/settings?meta=connected");
  } catch (err: any) {
    console.error("[Meta] OAuth callback failed:", err);
    return res.redirect(
      `/settings?meta=error&message=${encodeURIComponent(err?.message ?? "Unknown error during token exchange")}`,
    );
  }
}
