import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  canvaAccessToken: text("canvaAccessToken"),
  canvaRefreshToken: text("canvaRefreshToken"),
  canvaTokenExpiresAt: timestamp("canvaTokenExpiresAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Active ONEST products */
export const ACTIVE_PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control", "Protein + Collagen", "Creatine", "HyperPump", "AminoLoad", "Marine Collagen", "SuperGreens", "Whey ISO Pro"] as const;
export type ActiveProduct = typeof ACTIVE_PRODUCTS[number];

export const pipelineRuns = mysqlTable("pipeline_runs", {
  id: int("id").autoincrement().primaryKey(),
  pipelineType: mysqlEnum("pipelineType", ["video", "static", "iteration"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  product: varchar("product", { length: 64 }).notNull(),
  priority: mysqlEnum("priority", ["Low", "Medium", "High", "Urgent"]).default("Medium").notNull(),
  triggerSource: varchar("triggerSource", { length: 64 }).default("manual").notNull(),
  foreplayAdId: varchar("foreplayAdId", { length: 256 }),
  foreplayAdTitle: text("foreplayAdTitle"),
  foreplayAdBrand: text("foreplayAdBrand"),
  videoUrl: text("videoUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  transcript: text("transcript"),
  visualAnalysis: text("visualAnalysis"),
  scriptsJson: json("scriptsJson"),
  clickupTasksJson: json("clickupTasksJson"),
  staticAdImages: json("staticAdImages"),
  staticAnalysis: text("staticAnalysis"),
  generatedImageUrl: text("generatedImageUrl"),
  staticStage: varchar("staticStage", { length: 64 }),
  staticBrief: text("staticBrief"),
  staticBriefReview: json("staticBriefReview"),
  creativeOptions: json("creativeOptions"),
  userSelections: json("userSelections"),
  briefOptionsJson: json("briefOptionsJson"),
  staticCreativeReview: json("staticCreativeReview"),
  teamApprovalStatus: mysqlEnum("teamApprovalStatus", ["pending", "approved", "rejected"]),
  teamApprovalNotes: text("teamApprovalNotes"),
  videoBrief: text("videoBrief"),
  videoBriefReview: json("videoBriefReview"),
  videoStage: varchar("videoStage", { length: 64 }),
  videoBriefOptions: json("videoBriefOptions"),
  iterationSourceUrl: text("iterationSourceUrl"),
  /** own_ad = user's winning ad; competitor_ad = Foreplay static (adapt for ONEST) */
  iterationSourceType: mysqlEnum("iterationSourceType", ["own_ad", "competitor_ad"]).default("own_ad"),
  /** When competitor_ad: concept = adapt concept/angle; style = replicate visual style, swap product+copy */
  iterationAdaptationMode: mysqlEnum("iterationAdaptationMode", ["concept", "style"]),
  iterationAnalysis: text("iterationAnalysis"),
  iterationBrief: text("iterationBrief"),
  iterationStage: varchar("iterationStage", { length: 64 }),
  iterationVariations: json("iterationVariations"),
  creativityLevel: mysqlEnum("creativityLevel", ["SAFE", "BOLD", "WILD"]).default("BOLD"),
  aspectRatio: varchar("aspectRatio", { length: 16 }),
  variationTypes: text("variationTypes"),
  variationCount: int("variationCount"),
  parentRunId: int("parentRunId"),
  variationLayer: mysqlEnum("variationLayer", ["parent", "child"]).default("parent"),
  variationType: varchar("variationType", { length: 64 }),
  videoSourceType: mysqlEnum("videoSourceType", ["competitor", "winning_ad"]).default("competitor"),
  videoDuration: int("videoDuration").default(60),
  videoStyleConfig: json("videoStyleConfig"),
  videoUploadUrl: text("videoUploadUrl"),
  videoFunnelStage: mysqlEnum("videoFunnelStage", ["cold", "warm", "retargeting", "retention"]).default("cold"),
  videoArchetypes: json("videoArchetypes"),
  imageModel: mysqlEnum("imageModel", ["nano_banana_pro", "nano_banana_2"]).default("nano_banana_pro"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type InsertPipelineRun = typeof pipelineRuns.$inferInsert;

/**
 * Product render images uploaded by the team.
 * The pipeline pulls from here instead of hardcoded URLs.
 */
export const productRenders = mysqlTable("product_renders", {
  id: int("id").autoincrement().primaryKey(),
  product: varchar("product", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 64 }).default("image/png").notNull(),
  fileSize: int("fileSize"),
  /** When true, this render is used as the default for the product in pipelines. One per product. */
  isDefault: int("isDefault").default(0).notNull(), // 1 = default, 0 = not (MySQL has no boolean)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ProductRender = typeof productRenders.$inferSelect;
export type InsertProductRender = typeof productRenders.$inferInsert;

/**
 * Product information hub — stores editable product data
 * that the AI pipeline uses for briefs and scripts.
 */
export const productInfo = mysqlTable("product_info", {
  id: int("id").autoincrement().primaryKey(),
  product: varchar("product", { length: 64 }).notNull().unique(),
  ingredients: text("ingredients"),
  benefits: text("benefits"),
  claims: text("claims"),
  targetAudience: text("targetAudience"),
  keySellingPoints: text("keySellingPoints"),
  flavourVariants: text("flavourVariants"),
  pricing: text("pricing"),
  additionalNotes: text("additionalNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductInfo = typeof productInfo.$inferSelect;
export type InsertProductInfo = typeof productInfo.$inferInsert;

/**
 * Locally cached Foreplay creatives.
 * Auto-synced hourly and on manual trigger.
 * foreplayAdId is unique to prevent duplicates.
 */
export const foreplayCreatives = mysqlTable("foreplay_creatives", {
  id: int("id").autoincrement().primaryKey(),
  foreplayAdId: varchar("foreplayAdId", { length: 256 }).notNull().unique(),
  type: mysqlEnum("type", ["VIDEO", "STATIC"]).notNull(),
  board: varchar("board", { length: 64 }).notNull(), // "inspo" or "static_inspo"
  title: text("title"),
  brandName: varchar("brandName", { length: 256 }),
  thumbnailUrl: text("thumbnailUrl"),
  imageUrl: text("imageUrl"),
  mediaUrl: text("mediaUrl"),
  mediaType: varchar("mediaType", { length: 64 }),
  platform: varchar("platform", { length: 64 }),
  description: text("description"),
  headline: text("headline"),
  displayFormat: varchar("displayFormat", { length: 64 }),
  transcription: text("transcription"),
  foreplayCreatedAt: varchar("foreplayCreatedAt", { length: 128 }),
  isNew: int("isNew").default(1).notNull(), // 1 = new, 0 = seen
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ForeplayCreative = typeof foreplayCreatives.$inferSelect;
export type InsertForeplayCreative = typeof foreplayCreatives.$inferInsert;

/**
 * Background images uploaded by the team for static ad compositing.
 * Used instead of AI-generated backgrounds for consistent quality.
 */
export const backgrounds = mysqlTable("backgrounds", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  category: varchar("category", { length: 64 }).notNull(), // e.g. "Dark", "Gradient", "Studio", "Colourful", "Abstract"
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  url: text("url").notNull(),
  mimeType: varchar("mimeType", { length: 64 }).default("image/png").notNull(),
  fileSize: int("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Background = typeof backgrounds.$inferSelect;
export type InsertBackground = typeof backgrounds.$inferInsert;

/**
 * UGC Clone Engine — Uploaded winning UGC videos for cloning.
 * Stores original video, configuration, and extracted structure.
 */
export const ugcUploads = mysqlTable("ugc_uploads", {
  id: int("id").autoincrement().primaryKey(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  videoUrl: text("videoUrl").notNull(),
  product: varchar("product", { length: 64 }).notNull(),
  audienceTag: varchar("audienceTag", { length: 128 }),
  desiredOutputVolume: int("desiredOutputVolume").notNull(), // Number of variants requested
  status: mysqlEnum("status", ["uploaded", "transcribing", "structure_extracted", "blueprint_approved", "generating_variants", "completed", "failed"]).default("uploaded").notNull(),
  transcript: text("transcript"),
  structureBlueprint: json("structureBlueprint"), // { hook, body, cta, timestamps, pacing }
  blueprintApprovedAt: timestamp("blueprintApprovedAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UgcUpload = typeof ugcUploads.$inferSelect;
export type InsertUgcUpload = typeof ugcUploads.$inferInsert;

/**
 * UGC Clone Engine — Generated script variants from a UGC upload.
 * Each variant is a controlled mutation of the original structure.
 */
export const ugcVariants = mysqlTable("ugc_variants", {
  id: int("id").autoincrement().primaryKey(),
  uploadId: int("uploadId").notNull(), // FK to ugcUploads
  variantNumber: int("variantNumber").notNull(), // 1, 2, 3, ... N
  actorArchetype: varchar("actorArchetype", { length: 128 }).notNull(), // e.g. "fitness enthusiast", "busy mum", "athlete"
  voiceTone: varchar("voiceTone", { length: 64 }).notNull(), // e.g. "energetic", "calm", "authoritative"
  energyLevel: mysqlEnum("energyLevel", ["low", "medium", "high"]).notNull(),
  scriptText: text("scriptText").notNull(),
  hookVariation: text("hookVariation"),
  ctaVariation: text("ctaVariation"),
  runtime: int("runtime"), // Estimated runtime in seconds
  status: mysqlEnum("status", ["generated", "awaiting_approval", "approved", "rejected", "pushed_to_clickup"]).default("generated").notNull(),
  clickupTaskId: varchar("clickupTaskId", { length: 256 }),
  clickupTaskUrl: text("clickupTaskUrl"),
  approvedAt: timestamp("approvedAt"),
  rejectedAt: timestamp("rejectedAt"),
  pushedToClickupAt: timestamp("pushedToClickupAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UgcVariant = typeof ugcVariants.$inferSelect;
export type InsertUgcVariant = typeof ugcVariants.$inferInsert;

/**
 * Headline Bank — Stores proven winning headlines from Motion analytics or manual entry.
 * Used by Iterate Winners pipeline to generate variations based on YOUR data, not AI guesses.
 */
export const headlineBank = mysqlTable("headline_bank", {
  id: int("id").autoincrement().primaryKey(),
  headline: text("headline").notNull(),
  subheadline: text("subheadline"),
  rating: int("rating").notNull().default(3), // 1-5 stars
  roas: varchar("roas", { length: 16 }),
  spend: varchar("spend", { length: 32 }),
  weeksActive: int("weeksActive"),
  source: varchar("source", { length: 32 }).notNull().default("manual"), // manual, motion_api, ai_generated
  motionTaskId: varchar("motionTaskId", { length: 256 }),
  motionCreativeName: text("motionCreativeName"),
  product: varchar("product", { length: 64 }),
  angle: varchar("angle", { length: 64 }),
  format: varchar("format", { length: 32 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HeadlineBank = typeof headlineBank.$inferSelect;
export type InsertHeadlineBank = typeof headlineBank.$inferInsert;

/**
 * UGC Clone Engine — Face Swap Jobs.
 * Tracks Magic Hour character swap jobs for UGC variants.
 */
export const faceSwapJobs = mysqlTable("face_swap_jobs", {
  id: int("id").autoincrement().primaryKey(),
  ugcVariantId: int("ugcVariantId"), // FK to ugcVariants (optional — can be standalone)
  sourceVideoUrl: text("sourceVideoUrl").notNull(), // Original UGC video URL
  portraitUrl: text("portraitUrl").notNull(), // Reference portrait URL (S3)
  portraitValidation: json("portraitValidation"), // { passed, checks: [{name, passed, note}] }
  voiceId: varchar("voiceId", { length: 128 }), // ElevenLabs voice ID
  voiceoverScript: text("voiceoverScript"), // Script text for voiceover
  voiceoverUrl: text("voiceoverUrl"), // Generated ElevenLabs audio URL (S3)
  magicHourJobId: varchar("magicHourJobId", { length: 256 }), // Magic Hour job ID
  magicHourStatus: varchar("magicHourStatus", { length: 64 }), // queued | processing | complete | failed
  faceSwapVideoUrl: text("faceSwapVideoUrl"), // Face-swapped video URL (from Magic Hour)
  outputVideoUrl: text("outputVideoUrl"), // Final merged video URL (S3)
  creditsCharged: int("creditsCharged"), // Magic Hour credits used
  estimatedCostUsd: varchar("estimatedCostUsd", { length: 16 }), // e.g. "$1.08"
  status: mysqlEnum("status", ["pending", "validating", "generating_voice", "swapping", "merging", "completed", "failed"]).default("pending").notNull(),
  clickupTaskId: varchar("clickupTaskId", { length: 256 }),
  clickupTaskUrl: text("clickupTaskUrl"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FaceSwapJob = typeof faceSwapJobs.$inferSelect;
export type InsertFaceSwapJob = typeof faceSwapJobs.$inferInsert;

// ============================================================
// ORGANIC CONTENT PIPELINE — Tables
// ============================================================

/**
 * Organic content runs — separate from ad pipeline_runs.
 * Tracks organic video, caption, and visual content generation.
 */
export const organicRuns = mysqlTable("organic_runs", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["organic_video", "caption", "visual_content"]).notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  /** Current pipeline stage for organic_video type */
  stage: varchar("stage", { length: 64 }),
  /** Content strategy metadata */
  contentPillar: varchar("contentPillar", { length: 64 }),
  contentPurpose: varchar("contentPurpose", { length: 64 }),
  contentFormat: varchar("contentFormat", { length: 32 }),
  topic: text("topic"),
  /** Organic video pipeline fields */
  videoInputPath: text("videoInputPath"),
  videoInputType: mysqlEnum("videoInputType", ["local", "url"]).default("local"),
  autoEditOutputUrl: text("autoEditOutputUrl"),
  transcription: json("transcription"),
  transcriptionEdited: json("transcriptionEdited"),
  subtitleStyle: varchar("subtitleStyle", { length: 32 }).default("tiktok_bold"),
  subtitledVideoUrl: text("subtitledVideoUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  /** Caption fields (shared across types) */
  captionInstagram: text("captionInstagram"),
  captionTiktok: text("captionTiktok"),
  captionLinkedin: text("captionLinkedin"),
  /** Visual content fields */
  slideCount: int("slideCount"),
  slidesJson: json("slidesJson"),
  product: varchar("product", { length: 64 }),
  /** Tracking */
  errorMessage: text("errorMessage"),
  clickupTaskId: varchar("clickupTaskId", { length: 256 }),
  clickupTaskUrl: text("clickupTaskUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type OrganicRun = typeof organicRuns.$inferSelect;
export type InsertOrganicRun = typeof organicRuns.$inferInsert;

/**
 * Caption examples — few-shot training data for the Caption Generator.
 * Stores Ryan's manually written captions as examples for the AI to reference.
 */
export const captionExamples = mysqlTable("caption_examples", {
  id: int("id").autoincrement().primaryKey(),
  pillar: varchar("pillar", { length: 64 }).notNull(),
  purpose: varchar("purpose", { length: 64 }).notNull(),
  topic: varchar("topic", { length: 256 }).notNull(),
  platform: varchar("platform", { length: 32 }).notNull(), // instagram, tiktok, linkedin
  captionText: text("captionText").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CaptionExample = typeof captionExamples.$inferSelect;
export type InsertCaptionExample = typeof captionExamples.$inferInsert;
