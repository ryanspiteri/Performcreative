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
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Active ONEST products */
export const ACTIVE_PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control"] as const;
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
