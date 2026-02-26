import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import * as db from "../db";
import { generatePKCE, getCanvaAuthUrl, exchangeCodeForToken, refreshAccessToken, uploadAssetToCanva, pollAssetUploadJob, createDesignFromAsset, getBrandTemplateDataset, createAutofillJob, pollAutofillJob } from "../services/canva";
import { TRPCError } from "@trpc/server";

// Store PKCE verifiers temporarily (in production, use Redis or database)
const pkceStore = new Map<string, { verifier: string; expiresAt: number }>();

// Clean up expired PKCE verifiers every 10 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(pkceStore.entries());
  for (const [key, value] of entries) {
    if (value.expiresAt < now) {
      pkceStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export const canvaRouter = router({
  // Get Canva authorization URL
  getAuthUrl: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }

    const { verifier, challenge } = generatePKCE();
    const state = `${ctx.user.openId}-${Date.now()}`;
    // Use fixed redirect URI to match Canva portal configuration
    const redirectUri = "https://3000-ilfzg47vdtu2vrhca80ig-263dd919.sg1.manus.computer/api/canva/callback";
    
    // Store verifier for 10 minutes
    pkceStore.set(state, { verifier, expiresAt: Date.now() + 10 * 60 * 1000 });
    
    const authUrl = getCanvaAuthUrl(redirectUri, state, challenge);
    return { authUrl };
  }),

  // Check if user has connected Canva
  isConnected: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { connected: false };
    
    const tokens = await db.getUserCanvaTokens(ctx.user.openId);
    return { connected: !!tokens?.accessToken };
  }),

  // Upload image to Canva and create design
  uploadAndCreateDesign: publicProcedure
    .input(z.object({
      imageUrl: z.string(),
      title: z.string(),
      width: z.number(),
      height: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });
      }

      let tokens = await db.getUserCanvaTokens(ctx.user.openId);
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Canva not connected" });
      }

      // Check if token is expired and refresh if needed
      if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
        try {
          const refreshed = await refreshAccessToken(tokens.refreshToken);
          const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
          await db.updateUserCanvaTokens(
            ctx.user.openId,
            refreshed.access_token,
            refreshed.refresh_token,
            expiresAt
          );
          tokens = { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token, expiresAt };
        } catch (error) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Canva token refresh failed" });
        }
      }

      try {
        // Upload asset to Canva
        if (!tokens.accessToken) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Canva token missing" });
        }
        const uploadJob = await uploadAssetToCanva(tokens.accessToken, input.imageUrl, input.title);
        
        // Poll until upload completes
        const completedJob = await pollAssetUploadJob(tokens.accessToken, uploadJob.job.id);
        
        if (!completedJob.job.asset) {
          throw new Error("Asset upload completed but no asset returned");
        }
        
        // Create design from asset
        const design = await createDesignFromAsset(
          tokens.accessToken,
          completedJob.job.asset.id,
          input.title,
          input.width,
          input.height
        );

        return {
          assetId: completedJob.job.asset.id,
          designId: design.design.id,
          editUrl: design.design.urls.edit_url,
          viewUrl: design.design.urls.view_url,
        };
      } catch (error) {
        console.error("[Canva] Upload/create failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Canva upload failed" });
      }
    }),

  // Create editable design using Autofill API
  createEditableDesign: publicProcedure
    .input(z.object({
      templateId: z.string(),
      headline: z.string(),
      subheadline: z.string().optional(),
      benefit1: z.string(),
      benefit2: z.string(),
      benefit3: z.string(),
      cta: z.string(),
      productImageUrl: z.string(),
      backgroundImageUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });
      }

      let tokens = await db.getUserCanvaTokens(ctx.user.openId);
      if (!tokens?.accessToken || !tokens?.refreshToken) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Canva not connected" });
      }

      // Check if token is expired and refresh if needed
      if (tokens.expiresAt && new Date(tokens.expiresAt) < new Date()) {
        try {
          const refreshed = await refreshAccessToken(tokens.refreshToken);
          const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
          await db.updateUserCanvaTokens(
            ctx.user.openId,
            refreshed.access_token,
            refreshed.refresh_token,
            expiresAt
          );
          tokens = { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token, expiresAt };
        } catch (error) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Canva token refresh failed" });
        }
      }

      try {
        if (!tokens.accessToken) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Canva token missing" });
        }

        // Upload product image as asset
        const productUploadJob = await uploadAssetToCanva(tokens.accessToken, input.productImageUrl, "Product");
        const productJob = await pollAssetUploadJob(tokens.accessToken, productUploadJob.job.id);
        
        if (!productJob.job.asset) {
          throw new Error("Product upload completed but no asset returned");
        }

        // Upload background image as asset
        const backgroundUploadJob = await uploadAssetToCanva(tokens.accessToken, input.backgroundImageUrl, "Background");
        const backgroundJob = await pollAssetUploadJob(tokens.accessToken, backgroundUploadJob.job.id);
        
        if (!backgroundJob.job.asset) {
          throw new Error("Background upload completed but no asset returned");
        }

        // Create autofill data
        const autofillData: Record<string, any> = {
          HEADLINE: { type: "text", text: input.headline },
          BENEFIT_1: { type: "text", text: input.benefit1 },
          BENEFIT_2: { type: "text", text: input.benefit2 },
          BENEFIT_3: { type: "text", text: input.benefit3 },
          CTA: { type: "text", text: input.cta },
          PRODUCT_IMAGE: { type: "image", asset_id: productJob.job.asset.id },
          BACKGROUND: { type: "image", asset_id: backgroundJob.job.asset.id },
        };

        // Add optional subheadline if provided
        if (input.subheadline) {
          autofillData.SUBHEADLINE = { type: "text", text: input.subheadline };
        }

        // Create autofill job
        const autofillJob = await createAutofillJob(tokens.accessToken, input.templateId, autofillData);
        
        // Poll until autofill completes
        const completedJob = await pollAutofillJob(tokens.accessToken, autofillJob.job.id);

        if (!completedJob.job.result?.design) {
          throw new Error("Autofill completed but no design returned");
        }

        return {
          designUrl: completedJob.job.result.design.url,
          thumbnailUrl: completedJob.job.result.design.thumbnail?.url,
        };
      } catch (error) {
        console.error("[Canva] Autofill failed:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Canva autofill failed" });
      }
    }),

  // Disconnect Canva
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }

    await db.updateUserCanvaTokens(ctx.user.openId, "", "", new Date(0));
    return { success: true };
  }),
});

// Express route handler for OAuth callback (not tRPC)
export async function handleCanvaCallback(req: any, res: any) {
  const { code, state, error, error_description } = req.query;

  // Handle Canva errors
  if (error) {
    console.error(`[Canva] OAuth error: ${error} - ${error_description}`);
    return res.redirect(`/settings?canva=error&message=${encodeURIComponent(error_description || error)}`);
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  // Retrieve PKCE verifier
  const pkceData = pkceStore.get(state as string);
  if (!pkceData) {
    return res.status(400).send("Invalid or expired state");
  }

  const openId = (state as string).split("-")[0];
  // Use same fixed redirect URI as authorization
  const redirectUri = "https://3000-ilfzg47vdtu2vrhca80ig-263dd919.sg1.manus.computer/api/canva/callback";

  try {
    const tokenResponse = await exchangeCodeForToken(code as string, redirectUri, pkceData.verifier);
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await db.updateUserCanvaTokens(
      openId,
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      expiresAt
    );

    // Clean up PKCE verifier
    pkceStore.delete(state as string);

    // Redirect to settings page
    res.redirect("/settings?canva=connected");
  } catch (error) {
    console.error("[Canva] OAuth callback failed:", error);
    res.redirect("/settings?canva=error");
  }
}
