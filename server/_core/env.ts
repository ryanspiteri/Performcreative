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
  APP_URL: process.env.APP_URL ?? "https://www.performcreative.io",
  /** AutoEdit Python service URL (organic video pipeline). Phase 1: local, Phase 3: Docker. */
  autoEditApiUrl: process.env.AUTOEDIT_API_URL ?? "",
  /** Allowed base directory for local file paths (organic video pipeline). */
  localMediaBasePath: process.env.LOCAL_MEDIA_BASE_PATH ?? "",
};
