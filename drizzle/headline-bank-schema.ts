import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Headline Bank
 * 
 * Stores proven winning headlines from Motion analytics or manual entry.
 * Used by Iterate Winners pipeline to generate variations based on YOUR data, not AI guesses.
 */
export const headlineBank = sqliteTable("headline_bank", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  
  // Core headline data
  headline: text("headline").notNull(), // e.g., "LOST WEIGHT LOOKS HEAVIER", "CORTISOL BELLY GONE"
  subheadline: text("subheadline"), // Optional subheadline
  
  // Performance metrics
  rating: integer("rating").notNull().default(3), // 1-5 stars (based on ROAS or manual rating)
  roas: text("roas"), // e.g., "0.87", "1.25" (stored as text to preserve decimals)
  spend: text("spend"), // e.g., "A$5,223.83"
  weeksActive: integer("weeks_active"), // How many weeks this headline has been on leaderboard
  
  // Source tracking
  source: text("source").notNull().default("manual"), // "manual", "motion_api", "ai_generated"
  motionTaskId: text("motion_task_id"), // If from Motion, store original task ID
  motionCreativeName: text("motion_creative_name"), // Full creative name from Motion
  
  // Categorization
  product: text("product"), // "Hyperburn", "Thermosleep", etc.
  angle: text("angle"), // "transformation", "urgency", "social_proof", "curiosity", etc.
  format: text("format"), // "static", "video", "ugc"
  
  // Metadata
  notes: text("notes"), // User notes about this headline
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export type HeadlineBank = typeof headlineBank.$inferSelect;
export type NewHeadlineBank = typeof headlineBank.$inferInsert;
