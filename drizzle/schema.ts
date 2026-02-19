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
  pipelineType: mysqlEnum("pipelineType", ["video", "static"]).notNull(),
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
