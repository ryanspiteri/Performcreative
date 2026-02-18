import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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