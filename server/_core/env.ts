export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** DigitalOcean Spaces (S3-compatible file storage) */
  doSpacesKey: process.env.DO_SPACES_KEY ?? "",
  doSpacesSecret: process.env.DO_SPACES_SECRET ?? "",
  doSpacesBucket: process.env.DO_SPACES_BUCKET ?? "",
  doSpacesRegion: process.env.DO_SPACES_REGION ?? "",
  doSpacesEndpoint: process.env.DO_SPACES_ENDPOINT ?? "",
  foreplayApiKey: process.env.FOREPLAY_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  clickupApiKey: process.env.CLICKUP_API_KEY ?? "",
  /** Gemini image generation (Iterate + Static pipelines) — required if using those pipelines */
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "",
  CANVA_CLIENT_ID: process.env.CANVA_CLIENT_ID ?? "",
  CANVA_CLIENT_SECRET: process.env.CANVA_CLIENT_SECRET ?? "",
  CANVA_WEBHOOK_SECRET: process.env.CANVA_WEBHOOK_SECRET ?? "",
  APP_URL: process.env.APP_URL ?? "https://www.performcreative.io",
  /**
   * Meta Facebook Login OAuth — user-scope token for reading ad video sources
   * and other fields denied to the System User token used by the sync pipeline.
   * Obtained once via the "Connect Facebook" button on /settings, stored per-
   * user in users.metaUserAccessToken. See server/routers/meta.ts for the flow.
   */
  metaAppId: process.env.META_APP_ID ?? "",
  metaAppSecret: process.env.META_APP_SECRET ?? "",
  metaOAuthRedirectUri:
    process.env.META_OAUTH_REDIRECT_URI ?? "https://www.performcreative.io/api/meta/callback",
  /** AutoEdit Python service URL (organic video pipeline). Phase 1: local, Phase 3: Docker. */
  autoEditApiUrl: process.env.AUTOEDIT_API_URL ?? "",
  /** Allowed base directory for local file paths (organic video pipeline). */
  localMediaBasePath: process.env.LOCAL_MEDIA_BASE_PATH ?? "",
  /** Creative Analytics OS — Meta Marketing API (read-only ads + insights) */
  metaAccessToken: process.env.META_ACCESS_TOKEN ?? "",
  /** Comma-separated list of ad account IDs (e.g. "act_123,act_456") */
  metaAdAccountIds: process.env.META_AD_ACCOUNT_IDS ?? "",
  metaGraphApiVersion: process.env.META_GRAPH_API_VERSION ?? "v22.0",
  /** Creative Analytics OS — Hyros reporting API (read-only attribution) */
  hyrosApiKey: process.env.HYROS_API_KEY ?? "",
  hyrosBaseUrl: process.env.HYROS_BASE_URL ?? "https://api.hyros.com/v1/api/v1.0",
  /** Sync cadence + lookback windows */
  analyticsSyncIntervalMinutes: parseInt(process.env.ANALYTICS_SYNC_INTERVAL_MINUTES ?? "60", 10),
  analyticsBackfillLookbackDays: parseInt(process.env.ANALYTICS_BACKFILL_LOOKBACK_DAYS ?? "90", 10),
  analyticsRollingLookbackDays: parseInt(process.env.ANALYTICS_ROLLING_LOOKBACK_DAYS ?? "14", 10),
};
