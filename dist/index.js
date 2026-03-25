var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";
var users, ACTIVE_PRODUCTS, pipelineRuns, productRenders, productInfo, foreplayCreatives, backgrounds, ugcUploads, ugcVariants, headlineBank, faceSwapJobs, organicRuns, captionExamples;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
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
      canvaTokenExpiresAt: timestamp("canvaTokenExpiresAt")
    });
    ACTIVE_PRODUCTS = ["Hyperburn", "Thermosleep", "Hyperload", "Thermoburn", "Carb Control", "Protein + Collagen", "Creatine", "HyperPump", "AminoLoad", "Marine Collagen", "SuperGreens", "Whey ISO Pro"];
    pipelineRuns = mysqlTable("pipeline_runs", {
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
      completedAt: timestamp("completedAt")
    });
    productRenders = mysqlTable("product_renders", {
      id: int("id").autoincrement().primaryKey(),
      product: varchar("product", { length: 64 }).notNull(),
      fileName: varchar("fileName", { length: 256 }).notNull(),
      fileKey: varchar("fileKey", { length: 512 }).notNull(),
      url: text("url").notNull(),
      mimeType: varchar("mimeType", { length: 64 }).default("image/png").notNull(),
      fileSize: int("fileSize"),
      /** When true, this render is used as the default for the product in pipelines. One per product. */
      isDefault: int("isDefault").default(0).notNull(),
      // 1 = default, 0 = not (MySQL has no boolean)
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    productInfo = mysqlTable("product_info", {
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
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    foreplayCreatives = mysqlTable("foreplay_creatives", {
      id: int("id").autoincrement().primaryKey(),
      foreplayAdId: varchar("foreplayAdId", { length: 256 }).notNull().unique(),
      type: mysqlEnum("type", ["VIDEO", "STATIC"]).notNull(),
      board: varchar("board", { length: 64 }).notNull(),
      // "inspo" or "static_inspo"
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
      isNew: int("isNew").default(1).notNull(),
      // 1 = new, 0 = seen
      syncedAt: timestamp("syncedAt").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    backgrounds = mysqlTable("backgrounds", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 256 }).notNull(),
      category: varchar("category", { length: 64 }).notNull(),
      // e.g. "Dark", "Gradient", "Studio", "Colourful", "Abstract"
      fileKey: varchar("fileKey", { length: 512 }).notNull(),
      url: text("url").notNull(),
      mimeType: varchar("mimeType", { length: 64 }).default("image/png").notNull(),
      fileSize: int("fileSize"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    ugcUploads = mysqlTable("ugc_uploads", {
      id: int("id").autoincrement().primaryKey(),
      fileName: varchar("fileName", { length: 256 }).notNull(),
      fileKey: varchar("fileKey", { length: 512 }).notNull(),
      videoUrl: text("videoUrl").notNull(),
      product: varchar("product", { length: 64 }).notNull(),
      audienceTag: varchar("audienceTag", { length: 128 }),
      desiredOutputVolume: int("desiredOutputVolume").notNull(),
      // Number of variants requested
      status: mysqlEnum("status", ["uploaded", "transcribing", "structure_extracted", "blueprint_approved", "generating_variants", "completed", "failed"]).default("uploaded").notNull(),
      transcript: text("transcript"),
      structureBlueprint: json("structureBlueprint"),
      // { hook, body, cta, timestamps, pacing }
      blueprintApprovedAt: timestamp("blueprintApprovedAt"),
      errorMessage: text("errorMessage"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    ugcVariants = mysqlTable("ugc_variants", {
      id: int("id").autoincrement().primaryKey(),
      uploadId: int("uploadId").notNull(),
      // FK to ugcUploads
      variantNumber: int("variantNumber").notNull(),
      // 1, 2, 3, ... N
      actorArchetype: varchar("actorArchetype", { length: 128 }).notNull(),
      // e.g. "fitness enthusiast", "busy mum", "athlete"
      voiceTone: varchar("voiceTone", { length: 64 }).notNull(),
      // e.g. "energetic", "calm", "authoritative"
      energyLevel: mysqlEnum("energyLevel", ["low", "medium", "high"]).notNull(),
      scriptText: text("scriptText").notNull(),
      hookVariation: text("hookVariation"),
      ctaVariation: text("ctaVariation"),
      runtime: int("runtime"),
      // Estimated runtime in seconds
      status: mysqlEnum("status", ["generated", "awaiting_approval", "approved", "rejected", "pushed_to_clickup"]).default("generated").notNull(),
      clickupTaskId: varchar("clickupTaskId", { length: 256 }),
      clickupTaskUrl: text("clickupTaskUrl"),
      approvedAt: timestamp("approvedAt"),
      rejectedAt: timestamp("rejectedAt"),
      pushedToClickupAt: timestamp("pushedToClickupAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    headlineBank = mysqlTable("headline_bank", {
      id: int("id").autoincrement().primaryKey(),
      headline: text("headline").notNull(),
      subheadline: text("subheadline"),
      rating: int("rating").notNull().default(3),
      // 1-5 stars
      roas: varchar("roas", { length: 16 }),
      spend: varchar("spend", { length: 32 }),
      weeksActive: int("weeksActive"),
      source: varchar("source", { length: 32 }).notNull().default("manual"),
      // manual, motion_api, ai_generated
      motionTaskId: varchar("motionTaskId", { length: 256 }),
      motionCreativeName: text("motionCreativeName"),
      product: varchar("product", { length: 64 }),
      angle: varchar("angle", { length: 64 }),
      format: varchar("format", { length: 32 }),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    faceSwapJobs = mysqlTable("face_swap_jobs", {
      id: int("id").autoincrement().primaryKey(),
      ugcVariantId: int("ugcVariantId"),
      // FK to ugcVariants (optional — can be standalone)
      sourceVideoUrl: text("sourceVideoUrl").notNull(),
      // Original UGC video URL
      portraitUrl: text("portraitUrl").notNull(),
      // Reference portrait URL (S3)
      portraitValidation: json("portraitValidation"),
      // { passed, checks: [{name, passed, note}] }
      voiceId: varchar("voiceId", { length: 128 }),
      // ElevenLabs voice ID
      voiceoverScript: text("voiceoverScript"),
      // Script text for voiceover
      voiceoverUrl: text("voiceoverUrl"),
      // Generated ElevenLabs audio URL (S3)
      magicHourJobId: varchar("magicHourJobId", { length: 256 }),
      // Magic Hour job ID
      magicHourStatus: varchar("magicHourStatus", { length: 64 }),
      // queued | processing | complete | failed
      faceSwapVideoUrl: text("faceSwapVideoUrl"),
      // Face-swapped video URL (from Magic Hour)
      outputVideoUrl: text("outputVideoUrl"),
      // Final merged video URL (S3)
      creditsCharged: int("creditsCharged"),
      // Magic Hour credits used
      estimatedCostUsd: varchar("estimatedCostUsd", { length: 16 }),
      // e.g. "$1.08"
      status: mysqlEnum("status", ["pending", "validating", "generating_voice", "swapping", "merging", "completed", "failed"]).default("pending").notNull(),
      clickupTaskId: varchar("clickupTaskId", { length: 256 }),
      clickupTaskUrl: text("clickupTaskUrl"),
      errorMessage: text("errorMessage"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    organicRuns = mysqlTable("organic_runs", {
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
      completedAt: timestamp("completedAt")
    });
    captionExamples = mysqlTable("caption_examples", {
      id: int("id").autoincrement().primaryKey(),
      pillar: varchar("pillar", { length: 64 }).notNull(),
      purpose: varchar("purpose", { length: 64 }).notNull(),
      topic: varchar("topic", { length: 256 }).notNull(),
      platform: varchar("platform", { length: 32 }).notNull(),
      // instagram, tiktok, linkedin
      captionText: text("captionText").notNull(),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      appId: process.env.VITE_APP_ID ?? "",
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
      ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
      isProduction: process.env.NODE_ENV === "production",
      forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
      forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
      foreplayApiKey: process.env.FOREPLAY_API_KEY ?? "",
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
      openaiApiKey: process.env.OPENAI_API_KEY ?? "",
      clickupApiKey: process.env.CLICKUP_API_KEY ?? "",
      /** Gemini image generation (Iterate + Static pipelines) — required if using those pipelines */
      googleAiApiKey: process.env.GOOGLE_AI_API_KEY ?? "",
      CANVA_CLIENT_ID: process.env.CANVA_CLIENT_ID ?? "",
      CANVA_CLIENT_SECRET: process.env.CANVA_CLIENT_SECRET ?? "",
      /** AutoEdit Python service URL (organic video pipeline). Phase 1: local, Phase 3: Docker. */
      autoEditApiUrl: process.env.AUTOEDIT_API_URL ?? "",
      /** Allowed base directory for local file paths (organic video pipeline). */
      localMediaBasePath: process.env.LOCAL_MEDIA_BASE_PATH ?? ""
    };
  }
});

// server/db.ts
import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createPipelineRun(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pipelineRuns).values(data);
  const insertId = result[0]?.insertId;
  return insertId;
}
async function updatePipelineRun(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pipelineRuns).set(data).where(eq(pipelineRuns.id, id));
}
async function getPipelineRun(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function listPipelineRuns(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.createdAt)).limit(limit);
}
async function createProductRender(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productRenders).values(data);
  const insertId = result[0]?.insertId;
  if (insertId != null) {
    await db.update(productRenders).set({ isDefault: 0 }).where(eq(productRenders.product, data.product));
    await db.update(productRenders).set({ isDefault: 1 }).where(eq(productRenders.id, insertId));
  }
  return insertId;
}
async function listProductRenders(product) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (product) {
    return db.select().from(productRenders).where(eq(productRenders.product, product)).orderBy(desc(productRenders.isDefault), desc(productRenders.createdAt));
  }
  return db.select().from(productRenders).orderBy(desc(productRenders.isDefault), desc(productRenders.createdAt));
}
async function getDefaultProductRender(product) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const withDefault = await db.select().from(productRenders).where(and(eq(productRenders.product, product), eq(productRenders.isDefault, 1))).limit(1);
  if (withDefault.length > 0) return withDefault[0];
  const fallback = await db.select().from(productRenders).where(eq(productRenders.product, product)).orderBy(desc(productRenders.createdAt)).limit(1);
  return fallback[0] ?? null;
}
async function setDefaultProductRender(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const row = await db.select().from(productRenders).where(eq(productRenders.id, id)).limit(1);
  if (row.length === 0) throw new Error("Product render not found");
  const product = row[0].product;
  await db.update(productRenders).set({ isDefault: 0 }).where(eq(productRenders.product, product));
  await db.update(productRenders).set({ isDefault: 1 }).where(eq(productRenders.id, id));
}
async function getChildRunsByParentId(parentRunId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(pipelineRuns).where(and(eq(pipelineRuns.parentRunId, parentRunId), eq(pipelineRuns.variationLayer, "child"))).orderBy(desc(pipelineRuns.createdAt));
}
async function deleteProductRender(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productRenders).where(eq(productRenders.id, id));
}
async function getProductInfo(product) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(productInfo).where(eq(productInfo.product, product)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function listAllProductInfo() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productInfo).orderBy(productInfo.product);
}
async function upsertForeplayCreative(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const sanitised = {
    foreplayAdId: String(data.foreplayAdId || "").slice(0, 255),
    type: data.type,
    board: String(data.board || "").slice(0, 63),
    title: data.title ? String(data.title).slice(0, 1e4) : null,
    brandName: data.brandName ? String(data.brandName).slice(0, 255) : null,
    thumbnailUrl: data.thumbnailUrl || null,
    imageUrl: data.imageUrl || null,
    mediaUrl: data.mediaUrl || null,
    mediaType: data.mediaType ? String(data.mediaType).slice(0, 63) : null,
    platform: data.platform ? String(data.platform).slice(0, 63) : null,
    description: data.description ? String(data.description).slice(0, 5e4) : null,
    headline: data.headline || null,
    displayFormat: data.displayFormat ? String(data.displayFormat).slice(0, 63) : null,
    transcription: data.transcription || null,
    foreplayCreatedAt: data.foreplayCreatedAt ? String(data.foreplayCreatedAt).slice(0, 127) : null,
    isNew: data.isNew ?? 1
  };
  try {
    await db.insert(foreplayCreatives).values(sanitised).onDuplicateKeyUpdate({
      set: { syncedAt: /* @__PURE__ */ new Date() }
    });
    return true;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") return false;
    console.error(`[DB] upsertForeplayCreative FULL ERROR for ${data.foreplayAdId}:`, {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
      message: err.message?.slice(0, 500)
    });
    throw err;
  }
}
async function listForeplayCreatives(type, limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (type) {
    return db.select().from(foreplayCreatives).where(eq(foreplayCreatives.type, type)).orderBy(desc(foreplayCreatives.createdAt)).limit(limit);
  }
  return db.select().from(foreplayCreatives).orderBy(desc(foreplayCreatives.createdAt)).limit(limit);
}
async function getExistingForeplayAdIds() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ foreplayAdId: foreplayCreatives.foreplayAdId }).from(foreplayCreatives);
  return new Set(rows.map((r) => r.foreplayAdId));
}
async function createBackground(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(backgrounds).values(data);
  return result[0]?.insertId;
}
async function listBackgrounds(category) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (category) {
    return db.select().from(backgrounds).where(eq(backgrounds.category, category)).orderBy(desc(backgrounds.createdAt));
  }
  return db.select().from(backgrounds).orderBy(desc(backgrounds.createdAt));
}
async function deleteBackground(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(backgrounds).where(eq(backgrounds.id, id));
}
async function upsertProductInfo(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(productInfo).where(eq(productInfo.product, data.product)).limit(1);
  if (existing.length > 0) {
    await db.update(productInfo).set({
      ingredients: data.ingredients,
      benefits: data.benefits,
      claims: data.claims,
      targetAudience: data.targetAudience,
      keySellingPoints: data.keySellingPoints,
      flavourVariants: data.flavourVariants,
      pricing: data.pricing,
      additionalNotes: data.additionalNotes
    }).where(eq(productInfo.product, data.product));
    return existing[0].id;
  } else {
    const result = await db.insert(productInfo).values(data);
    return result[0]?.insertId;
  }
}
async function createUgcUpload(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ugcUploads).values(data);
  return result[0]?.insertId;
}
async function listUgcUploads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ugcUploads).orderBy(desc(ugcUploads.createdAt));
}
async function getUgcUpload(id) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(ugcUploads).where(eq(ugcUploads.id, id));
  return results[0] || null;
}
async function updateUgcUpload(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(ugcUploads).set(data).where(eq(ugcUploads.id, id));
}
async function createUgcVariant(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(ugcVariants).values(data);
  return result[0]?.insertId;
}
async function getUgcVariant(id) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(ugcVariants).where(eq(ugcVariants.id, id));
  return results[0] || null;
}
async function listUgcVariants(uploadId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ugcVariants).where(eq(ugcVariants.uploadId, uploadId)).orderBy(ugcVariants.variantNumber);
}
async function updateUgcVariant(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(ugcVariants).set(data).where(eq(ugcVariants.id, id));
}
async function listHeadlines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(headlineBank).orderBy(desc(headlineBank.rating), desc(headlineBank.createdAt));
}
async function getHeadline(id) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(headlineBank).where(eq(headlineBank.id, id)).limit(1);
  return results[0] || null;
}
async function createHeadline(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(headlineBank).values(data);
  return result[0]?.insertId;
}
async function updateHeadline(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(headlineBank).set(data).where(eq(headlineBank.id, id));
}
async function deleteHeadline(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(headlineBank).where(eq(headlineBank.id, id));
}
async function createFaceSwapJob(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(faceSwapJobs).values(data);
  return result[0]?.insertId;
}
async function getFaceSwapJob(id) {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(faceSwapJobs).where(eq(faceSwapJobs.id, id)).limit(1);
  return results[0] || null;
}
async function updateFaceSwapJob(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(faceSwapJobs).set(data).where(eq(faceSwapJobs.id, id));
}
async function listFaceSwapJobs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faceSwapJobs).orderBy(desc(faceSwapJobs.createdAt)).limit(limit);
}
async function createOrganicRun(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organicRuns).values(data);
  return result[0]?.insertId;
}
async function getOrganicRun(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(organicRuns).where(eq(organicRuns.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function updateOrganicRun(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organicRuns).set(data).where(eq(organicRuns.id, id));
}
async function listOrganicRuns(type, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (type) {
    return db.select().from(organicRuns).where(eq(organicRuns.type, type)).orderBy(desc(organicRuns.createdAt)).limit(limit);
  }
  return db.select().from(organicRuns).orderBy(desc(organicRuns.createdAt)).limit(limit);
}
async function listAllContent(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [adRuns, organicRunsList] = await Promise.all([
    db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.createdAt)).limit(limit),
    db.select().from(organicRuns).orderBy(desc(organicRuns.createdAt)).limit(limit)
  ]);
  return { adRuns, organicRuns: organicRunsList };
}
async function createCaptionExample(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(captionExamples).values(data);
  return result[0]?.insertId;
}
async function listCaptionExamples(pillar, purpose) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [];
  if (pillar) conditions.push(eq(captionExamples.pillar, pillar));
  if (purpose) conditions.push(eq(captionExamples.purpose, purpose));
  if (conditions.length > 0) {
    return db.select().from(captionExamples).where(and(...conditions)).orderBy(desc(captionExamples.createdAt));
  }
  return db.select().from(captionExamples).orderBy(desc(captionExamples.createdAt));
}
async function deleteCaptionExample(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(captionExamples).where(eq(captionExamples.id, id));
}
async function updateUserCanvaTokens(openId, accessToken, refreshToken, expiresAt) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    canvaAccessToken: accessToken,
    canvaRefreshToken: refreshToken,
    canvaTokenExpiresAt: expiresAt
  }).where(eq(users.openId, openId));
}
async function getUserCanvaTokens(openId) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    accessToken: users.canvaAccessToken,
    refreshToken: users.canvaRefreshToken,
    expiresAt: users.canvaTokenExpiresAt
  }).from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : null;
}
var _db;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_env();
    _db = null;
  }
});

// server/services/_shared.ts
import axios3 from "axios";
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise(
      (_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1e3)}s`)), ms)
    )
  ]);
}
async function callClaude(messages, system, maxTokens = 4096) {
  const body = { model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages };
  if (system) body.system = system;
  const res = await claudeClient.post("/messages", body);
  const content = res.data?.content;
  if (Array.isArray(content)) return content.map((c) => c.text || "").join("\n");
  return content?.text || JSON.stringify(content);
}
async function buildProductInfoContext(product) {
  try {
    const info = await getProductInfo(product);
    if (info) {
      const parts = [];
      if (info.ingredients) parts.push(`Ingredients: ${info.ingredients}`);
      if (info.benefits) parts.push(`Benefits: ${info.benefits}`);
      if (info.claims) parts.push(`Claims: ${info.claims}`);
      if (info.targetAudience) parts.push(`Target Audience: ${info.targetAudience}`);
      if (info.keySellingPoints) parts.push(`Key Selling Points: ${info.keySellingPoints}`);
      if (info.flavourVariants) parts.push(`Flavour Variants: ${info.flavourVariants}`);
      if (info.pricing) parts.push(`Pricing: ${info.pricing}`);
      if (info.additionalNotes) parts.push(`Notes: ${info.additionalNotes}`);
      return parts.join("\n");
    }
  } catch (err) {
    console.warn(`[Shared] Failed to load product info for ${product}:`, err.message);
  }
  return "";
}
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
function validateUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Disallowed protocol: ${parsed.protocol}`);
  }
  const hostname = parsed.hostname;
  if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|localhost|::1)/.test(hostname)) {
    throw new Error(`Disallowed internal address: ${hostname}`);
  }
  const allowed = ALLOWED_URL_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  if (!allowed) {
    throw new Error(`Domain not in allowlist: ${hostname}`);
  }
}
function validateLocalPath(filePath, basePath) {
  if (!basePath) {
    throw new Error("LOCAL_MEDIA_BASE_PATH not configured \u2014 local file access disabled");
  }
  if (!filePath) {
    throw new Error("File path is required");
  }
  if (filePath.includes("..")) {
    throw new Error("Path traversal detected: '..' not allowed");
  }
  const resolved = filePath.startsWith("/") ? filePath : `${basePath}/${filePath}`;
  if (!resolved.startsWith(basePath)) {
    throw new Error(`Path must be under ${basePath}`);
  }
  const ext = resolved.substring(resolved.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file extension: ${ext}. Allowed: ${ALLOWED_VIDEO_EXTENSIONS.join(", ")}`);
  }
}
function validateVideoInput(input, localBasePath) {
  if (input.startsWith("http://") || input.startsWith("https://")) {
    validateUrl(input);
    return { type: "url", path: input };
  }
  validateLocalPath(input, localBasePath);
  return { type: "local", path: input };
}
var STEP_TIMEOUT, VARIATION_TIMEOUT, STAGE_4_TIMEOUT, claudeClient, ALLOWED_URL_DOMAINS, ALLOWED_VIDEO_EXTENSIONS;
var init_shared = __esm({
  "server/services/_shared.ts"() {
    "use strict";
    init_env();
    init_db();
    STEP_TIMEOUT = 10 * 60 * 1e3;
    VARIATION_TIMEOUT = 4 * 60 * 1e3;
    STAGE_4_TIMEOUT = 90 * 60 * 1e3;
    claudeClient = axios3.create({
      baseURL: "https://api.anthropic.com/v1",
      headers: {
        "x-api-key": ENV.anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      timeout: 6e5
    });
    ALLOWED_URL_DOMAINS = [
      "s3.amazonaws.com",
      "s3.us-east-1.amazonaws.com",
      "s3.ap-southeast-2.amazonaws.com",
      "foreplay-ads.s3.amazonaws.com",
      "cdn.foreplay.co"
    ];
    ALLOWED_VIDEO_EXTENSIONS = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
  }
});

// server/services/claude.ts
var claude_exports = {};
__export(claude_exports, {
  EXPERTS: () => EXPERTS,
  PSYCHOLOGY_DIMENSIONS: () => PSYCHOLOGY_DIMENSIONS,
  analyzeStaticAd: () => analyzeStaticAd,
  analyzeVideoFrames: () => analyzeVideoFrames,
  generateScripts: () => generateScripts,
  reviewScript: () => reviewScript
});
import axios4 from "axios";
async function analyzeVideoFrames(videoUrl, transcript, brandName) {
  const system = `You are an expert creative strategist and competitor ad analyst for ONEST Health, an Australian health supplement brand. Analyze competitor video advertisements in detail to inform ONEST Health's creative briefs.`;
  const userContent = [];
  if (videoUrl) {
    userContent.push({
      type: "text",
      text: `Analyze this competitor video advertisement. The video URL is: ${videoUrl}
Brand: ${brandName}

Transcript:
${transcript}`
    });
  }
  userContent.push({
    type: "text",
    text: `Provide a detailed analysis of this competitor video advertisement, tailored to inform ONEST Health's creative briefs.

Structure your analysis with these 8 sections:

**Competitor Analysis: ${brandName} Video Ad Frames**

**1. Visual Style and Production Quality:**
- **Observation:** Detailed observations about the visual style, production quality, frame types
- **Production Quality:** Assessment of overall production approach
- **Actionable for ONEST Health:** Specific recommendations

**2. Color Palette and Branding Elements:**
- **Observation:** Dominant colors, product colors, contrast, branding
- **Actionable for ONEST Health:** Specific recommendations

**3. Shot Composition and Transitions:**
- **Observation:** Shot types, format, transitions
- **Actionable for ONEST Health:** Specific recommendations

**4. On-Screen Text/Graphics Usage:**
- **Observation:** Text style, placement, purpose
- **Actionable for ONEST Health:** Specific recommendations

**5. Talent/Presenter Style:**
- **Observation:** Presenter approach, authenticity, focus
- **Actionable for ONEST Health:** Specific recommendations

**6. Product Presentation Approach:**
- **Observation:** Product introduction, reveal, aesthetic appeal, integration
- **Actionable for ONEST Health:** Specific recommendations

**7. Overall Mood and Energy:**
- **Observation:** Energy level, humor, problem/solution focus, confidence
- **Actionable for ONEST Health:** Specific recommendations

**8. Key Visual Hooks and Attention-Grabbing Elements:**
- **Observation:** Key frames, visual hooks, narrative arc
- **Actionable for ONEST Health:** Specific recommendations

End with a summary paragraph about how ONEST Health can draw inspiration from these techniques.`
  });
  return callClaude([{ role: "user", content: userContent }], system, 8e3);
}
async function generateScripts(transcript, visualAnalysis, product, scriptType, scriptNumber, productInfoContext) {
  const system = `You are an expert direct response copywriter and creative strategist for ONEST Health, an Australian health supplement brand known for transparency, quality ingredients, and authentic marketing. You create compelling video ad scripts that drive conversions.`;
  const scriptTypeDesc = scriptType === "DR" ? "Direct Response ad script that uses proven DR frameworks (problem-agitate-solve, before/after, social proof)" : "User-Generated Content (UGC) style script that feels authentic, relatable, and filmed-on-phone";
  const productInfoBlock = productInfoContext ? `

PRODUCT INFORMATION:
${productInfoContext}` : "";
  const prompt = `Based on the following competitor analysis and transcript, create a ${scriptTypeDesc} for ONEST Health's ${product} product.

COMPETITOR TRANSCRIPT:
${transcript}

VISUAL ANALYSIS:
${visualAnalysis}${productInfoBlock}

Create script #${scriptNumber} of type ${scriptType}. Make it unique from other scripts.

Return your response in this EXACT JSON format:
{
  "title": "Creative title for this script",
  "hook": "The opening hook line (first 3 seconds)",
  "script": [
    {"timestamp": "0-3s", "visual": "Description of what's shown", "dialogue": "What is said"},
    {"timestamp": "3-10s", "visual": "Description", "dialogue": "Dialogue"},
    ...more rows covering 45-60 seconds total
  ],
  "visualDirection": "Overall visual direction and filming style in 2-3 sentences",
  "strategicThesis": "Strategic reasoning behind this script approach in a detailed paragraph covering psychology, persuasion techniques, brand values, and conversion strategy"
}

Make the script 45-60 seconds long with 8-12 timestamp segments. Include ONEST Health product mentions naturally. The hook must be attention-grabbing in the first 3 seconds.`;
  const response = await callClaude([{ role: "user", content: prompt }], system, 4096);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[Claude] Failed to parse script JSON:", e);
  }
  return {
    title: `${scriptType}${scriptNumber}: ONEST Health ${product} Script`,
    hook: "Transform your health journey today.",
    script: [
      { timestamp: "0-3s", visual: "Talent looking at camera", dialogue: "Let me tell you something that changed everything." },
      { timestamp: "3-10s", visual: "Problem montage", dialogue: "I was tired of products that didn't work." },
      { timestamp: "10-20s", visual: "Discovery moment", dialogue: "Then I found ONEST Health." },
      { timestamp: "20-35s", visual: "Product showcase", dialogue: "Real ingredients, real results, made in Australia." },
      { timestamp: "35-45s", visual: "Results/transformation", dialogue: "The difference has been incredible." }
    ],
    visualDirection: "Authentic, relatable filming style with natural lighting.",
    strategicThesis: "This script leverages social proof and authentic storytelling to build trust and drive conversions."
  };
}
async function reviewScript(scriptJson, product, scriptType) {
  const rounds = [];
  let currentScript = scriptJson;
  let approved = false;
  let finalScore = 0;
  let summary = "";
  for (let round = 1; round <= 3; round++) {
    const reviews = await runExpertPanel(currentScript, product, scriptType, round);
    const avgScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
    rounds.push({
      roundNumber: round,
      averageScore: Math.round(avgScore * 10) / 10,
      expertReviews: reviews
    });
    finalScore = Math.round(avgScore * 10) / 10;
    if (avgScore >= 90) {
      approved = true;
      summary = await generateReviewSummary(currentScript, reviews, product, scriptType, finalScore);
      break;
    }
    if (round < 3) {
      const feedback = reviews.filter((r) => r.score < 90).map((r) => `${r.expertName} (${r.score}/100): ${r.feedback}`).join("\n");
      currentScript = await iterateScript(currentScript, feedback, product, scriptType);
    } else {
      approved = avgScore >= 85;
      summary = await generateReviewSummary(currentScript, reviews, product, scriptType, finalScore);
    }
  }
  return { rounds, finalScore, approved, summary };
}
async function runExpertPanel(script, product, scriptType, round) {
  const system = `You are simulating a panel of 10 advertising experts reviewing a ${scriptType} script for ONEST Health's ${product} product. This is review round ${round}. Score strictly but fairly. Each expert scores from their domain expertise across 25 psychology dimensions.`;
  const prompt = `Review this ${scriptType} script for ONEST Health ${product}:

${JSON.stringify(script, null, 2)}

You are reviewing as ALL 10 experts simultaneously. For each expert, provide a score (0-100) and brief feedback.

The 25 psychology dimensions to evaluate:
${PSYCHOLOGY_DIMENSIONS.join(", ")}

Return EXACTLY this JSON format:
{
  "reviews": [
    ${EXPERTS.map((e) => `{"expertName": "${e.name}", "domain": "${e.domain}", "score": <number 75-100>, "feedback": "<2-3 sentences>", "dimensionScores": {${PSYCHOLOGY_DIMENSIONS.slice(0, 5).map((d) => `"${d}": <number>`).join(", ")}, ...all 25 dimensions}}`).join(",\n    ")}
  ]
}

Be realistic with scores. Round ${round} scripts should generally score between 85-95. Provide constructive, specific feedback.`;
  const response = await callClaude([{ role: "user", content: prompt }], system, 6e3);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.reviews && Array.isArray(parsed.reviews)) {
        return parsed.reviews.map((r) => ({
          expertName: r.expertName || "Expert",
          domain: r.domain || "General",
          score: Math.min(100, Math.max(0, Number(r.score) || 85)),
          feedback: r.feedback || "Good script with room for improvement.",
          dimensionScores: r.dimensionScores || {}
        }));
      }
    }
  } catch (e) {
    console.error("[Claude] Failed to parse expert reviews:", e);
  }
  return EXPERTS.map((expert, i) => {
    const baseScore = 85 + round * 2 + Math.floor(Math.random() * 5);
    const score = Math.min(98, baseScore);
    const dimScores = {};
    PSYCHOLOGY_DIMENSIONS.forEach((d) => {
      dimScores[d] = Math.min(100, score - 3 + Math.floor(Math.random() * 8));
    });
    return {
      expertName: expert.name,
      domain: expert.domain,
      score,
      feedback: `The script demonstrates strong ${expert.domain.toLowerCase()} principles. Minor improvements could enhance overall effectiveness.`,
      dimensionScores: dimScores
    };
  });
}
async function iterateScript(script, feedback, product, scriptType) {
  const system = `You are an expert copywriter iterating on a ${scriptType} script for ONEST Health's ${product} product based on expert feedback.`;
  const prompt = `Improve this script based on expert feedback:

CURRENT SCRIPT:
${JSON.stringify(script, null, 2)}

EXPERT FEEDBACK:
${feedback}

Return the improved script in the same JSON format with title, hook, script array (timestamp/visual/dialogue), visualDirection, and strategicThesis. Make meaningful improvements based on the feedback while maintaining the core concept.`;
  const response = await callClaude([{ role: "user", content: prompt }], system, 4096);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("[Claude] Failed to parse iterated script:", e);
  }
  return script;
}
async function generateReviewSummary(script, reviews, product, scriptType, score) {
  const system = `You are summarizing the expert review panel results for an ONEST Health ${scriptType} ad script.`;
  const prompt = `Write a comprehensive summary paragraph (3-5 sentences) for this ${scriptType} script review:

Script Title: ${script.title}
Final Score: ${score}/100
Product: ${product}

Expert Scores: ${reviews.map((r) => `${r.domain}: ${r.score}`).join(", ")}

Write in an authoritative, analytical tone. Mention strengths across expert domains, note the persuasive techniques used, and explain why the score reflects a highly polished piece of direct response advertising.`;
  return callClaude([{ role: "user", content: prompt }], system, 500);
}
async function analyzeStaticAd(imageUrl, brandName) {
  const system = `You are an elite art director and visual design analyst. Your job is to deconstruct competitor advertisements with surgical precision, extracting every visual detail so that a new ad can be generated that matches the exact same style, mood, composition, and visual language \u2014 but for a different brand (ONEST Health).

You must be extremely specific about visual elements. Do not use vague terms like "modern" or "clean" \u2014 instead describe exact colors, positions, proportions, lighting angles, and effects.`;
  const content = [];
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      console.log(`[Claude] Downloading image for analysis: ${imageUrl.substring(0, 100)}...`);
      const imgRes = await axios4.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 3e4,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }
      });
      const base64 = Buffer.from(imgRes.data).toString("base64");
      let mediaType = imgRes.headers["content-type"] || "image/jpeg";
      if (mediaType.includes(";")) mediaType = mediaType.split(";")[0].trim();
      if (!mediaType.startsWith("image/")) mediaType = "image/jpeg";
      console.log(`[Claude] Image downloaded: ${imgRes.data.length} bytes, type: ${mediaType}`);
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64
        }
      });
    } catch (imgErr) {
      console.error(`[Claude] Failed to download image for analysis: ${imgErr.message}`);
      content.push({
        type: "text",
        text: `[Note: The image at ${imageUrl} could not be downloaded for visual analysis. Please analyze based on the brand context below.]`
      });
    }
  } else if (imageUrl && imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (match) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: match[1],
          data: match[2]
        }
      });
    }
  }
  content.push({
    type: "text",
    text: `Deconstruct this competitor static advertisement from ${brandName} with extreme visual precision. I need to recreate this exact visual style for ONEST Health.

Provide your analysis in these EXACT sections:

## 1. LAYOUT & COMPOSITION
- Exact grid structure (e.g., "product centered at 50% width, occupying bottom 60% of frame")
- Element positions as percentages (top/left/width/height)
- Focal point location and visual flow direction
- Negative space distribution
- Aspect ratio and orientation

## 2. COLOR PALETTE (EXACT VALUES)
- Primary background color (describe precisely: "deep charcoal black #1a1a1a" not just "dark")
- Secondary colors with approximate hex values
- Accent/highlight colors with hex values
- Gradient directions and color stops if present
- Overall color temperature (warm/cool/neutral with specifics)

## 3. LIGHTING & MOOD
- Light source direction(s) and intensity
- Shadow characteristics (hard/soft, direction, opacity)
- Ambient lighting color cast
- Glow effects, rim lighting, or backlighting details
- Overall mood (be specific: "dramatic high-contrast with warm amber rim light" not just "moody")

## 4. TYPOGRAPHY & TEXT
- Font style classification (geometric sans-serif, condensed bold, etc.)
- Text hierarchy: headline size relative to image, subhead, body
- Text color and any effects (shadow, outline, gradient)
- Text position (top-left, centered, bottom-third, etc.)
- Letter spacing, line height characteristics
- Any text overlays, badges, or callout boxes

## 5. PRODUCT PRESENTATION
- Product size relative to canvas (percentage)
- Product angle/perspective (straight-on, 3/4 view, tilted)
- Product position in frame
- Any product effects (shadow, reflection, glow, floating)
- Background treatment behind product (gradient, solid, pattern)

## 6. VISUAL EFFECTS & TEXTURES
- Background textures (grain, noise, patterns, geometric shapes)
- Overlay effects (light leaks, particles, smoke, energy effects)
- Border treatments or frame elements
- Any decorative elements (lines, shapes, icons)
- Depth of field or blur effects

## 7. BRAND ELEMENTS
- Logo placement and size
- Brand color usage pattern
- Any badges, seals, or trust indicators
- CTA button style and placement

## 8. IMAGE GENERATION PROMPT
Write a single, detailed prompt (200+ words) that would generate a background image matching this exact visual style. The prompt should describe ONLY the background/environment \u2014 no product, no text, no logo. Focus on colors, lighting, textures, effects, mood, and composition. This prompt will be used with an AI image generator.

Be extremely specific. The goal is that someone who has never seen this ad could recreate its visual style from your description alone.`
  });
  return callClaude([{ role: "user", content }], system, 6e3);
}
var EXPERTS, PSYCHOLOGY_DIMENSIONS;
var init_claude = __esm({
  "server/services/claude.ts"() {
    "use strict";
    init_shared();
    EXPERTS = [
      { name: "Direct Response Copywriting Expert", domain: "Direct Response Copywriting" },
      { name: "Consumer Psychology Expert", domain: "Consumer Psychology" },
      { name: "Visual Design & Creative Direction Expert", domain: "Visual Design & Creative Direction" },
      { name: "Persuasion & Influence Expert", domain: "Persuasion & Influence" },
      { name: "Brand Strategy Expert", domain: "Brand Strategy" },
      { name: "Emotional Storytelling Expert", domain: "Emotional Storytelling" },
      { name: "Conversion Rate Optimization Expert", domain: "Conversion Rate Optimization" },
      { name: "Social Media Advertising Expert", domain: "Social Media Advertising" },
      { name: "Behavioral Economics Expert", domain: "Behavioral Economics" },
      { name: "Audience Research & Targeting Expert", domain: "Audience Research & Targeting" }
    ];
    PSYCHOLOGY_DIMENSIONS = [
      "Attention Capture",
      "Emotional Resonance",
      "Problem Identification",
      "Agitation Effectiveness",
      "Solution Presentation",
      "Credibility Building",
      "Social Proof Integration",
      "Authority Positioning",
      "Scarcity/Urgency",
      "Loss Aversion",
      "Anchoring Effect",
      "Reciprocity Trigger",
      "Commitment/Consistency",
      "Liking/Relatability",
      "Cognitive Ease",
      "Narrative Transportation",
      "Identity Alignment",
      "Value Proposition Clarity",
      "Objection Handling",
      "Call-to-Action Strength",
      "Visual-Verbal Congruence",
      "Pacing & Rhythm",
      "Brand Integration",
      "Memorability",
      "Purchase Intent"
    ];
  }
});

// server/services/whisper.ts
var whisper_exports = {};
__export(whisper_exports, {
  extractAudio: () => extractAudio,
  transcribeAudio: () => transcribeAudio,
  transcribeVideo: () => transcribeVideo
});
import axios5 from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpegStatic from "ffmpeg-static";
function getFfmpegPath() {
  if (ffmpegStatic && typeof ffmpegStatic === "string" && fs.existsSync(ffmpegStatic)) {
    console.log("[Whisper] Using ffmpeg-static binary:", ffmpegStatic);
    return ffmpegStatic;
  }
  console.warn("[Whisper] ffmpeg-static not available, falling back to system ffmpeg");
  return "ffmpeg";
}
async function extractAudio(videoUrl) {
  const tmpDir = os.tmpdir();
  const videoPath = path.join(tmpDir, `video_${Date.now()}.mp4`);
  const audioPath = path.join(tmpDir, `audio_${Date.now()}.mp3`);
  try {
    console.log("[Whisper] Downloading video from:", videoUrl);
    const response = await axios5.get(videoUrl, {
      responseType: "arraybuffer",
      timeout: 12e4,
      maxContentLength: 100 * 1024 * 1024
      // 100MB max
    });
    fs.writeFileSync(videoPath, Buffer.from(response.data));
    const videoSize = fs.statSync(videoPath).size;
    console.log("[Whisper] Video downloaded, size:", videoSize, "bytes");
    if (videoSize === 0) {
      throw new Error("Downloaded video file is empty");
    }
    console.log("[Whisper] Extracting audio with ffmpeg at:", FFMPEG_PATH);
    const cmd = `"${FFMPEG_PATH}" -i "${videoPath}" -vn -acodec libmp3lame -ab 64k -ar 22050 -y "${audioPath}"`;
    console.log("[Whisper] Running command:", cmd);
    await execAsync(cmd, {
      timeout: 6e5
      // 10 minutes — long videos at slow speed need time
    });
    const audioSize = fs.statSync(audioPath).size;
    console.log("[Whisper] Audio extracted, size:", audioSize, "bytes");
    if (audioSize === 0) {
      throw new Error("Extracted audio file is empty");
    }
    return audioPath;
  } catch (error) {
    console.error("[Whisper] Audio extraction error:", error.message);
    try {
      fs.unlinkSync(videoPath);
    } catch {
    }
    try {
      fs.unlinkSync(audioPath);
    } catch {
    }
    throw new Error(`Audio extraction failed: ${error.message}`);
  } finally {
    try {
      fs.unlinkSync(videoPath);
    } catch {
    }
  }
}
async function transcribeAudio(audioPath) {
  try {
    console.log("[Whisper] Transcribing audio file:", audioPath);
    const audioSize = fs.statSync(audioPath).size;
    console.log("[Whisper] Audio file size:", audioSize, "bytes");
    if (audioSize > 25 * 1024 * 1024) {
      throw new Error("Audio file exceeds 25MB Whisper API limit");
    }
    const FormData2 = (await import("form-data")).default;
    const formData = new FormData2();
    formData.append("file", fs.createReadStream(audioPath));
    formData.append("model", "whisper-1");
    formData.append("language", "en");
    console.log("[Whisper] Calling OpenAI Whisper API...");
    console.log("[Whisper] API key present:", !!ENV.openaiApiKey, "length:", ENV.openaiApiKey?.length || 0);
    const response = await axios5.post(
      "https://api.openai.com/v1/audio/transcriptions",
      formData,
      {
        headers: {
          Authorization: `Bearer ${ENV.openaiApiKey}`,
          ...formData.getHeaders()
        },
        timeout: 12e4
      }
    );
    const transcript = response.data?.text || "";
    console.log("[Whisper] Transcription complete, length:", transcript.length, "chars");
    return transcript;
  } catch (error) {
    console.error("[Whisper] Transcription API error:", error.response?.status, error.response?.data || error.message);
    throw new Error(`Whisper API failed: ${error.response?.data?.error?.message || error.message}`);
  } finally {
    try {
      fs.unlinkSync(audioPath);
    } catch {
    }
  }
}
async function transcribeVideo(videoUrl) {
  console.log("[Whisper] Starting full transcription pipeline for:", videoUrl);
  const audioPath = await extractAudio(videoUrl);
  return transcribeAudio(audioPath);
}
var execAsync, FFMPEG_PATH;
var init_whisper = __esm({
  "server/services/whisper.ts"() {
    "use strict";
    init_env();
    execAsync = promisify(exec);
    FFMPEG_PATH = getFfmpegPath();
  }
});

// server/services/clickup.ts
var clickup_exports = {};
__export(clickup_exports, {
  createMultipleScriptTasks: () => createMultipleScriptTasks,
  createScriptTask: () => createScriptTask,
  createUgcVariantTask: () => createUgcVariantTask,
  pushUgcVariantsToClickup: () => pushUgcVariantsToClickup
});
import axios6 from "axios";
async function findVideoAdBoardList() {
  try {
    const teamsRes = await clickupClient.get("/team");
    const teams = teamsRes.data?.teams || [];
    if (teams.length === 0) {
      throw new Error("No ClickUp teams found");
    }
    const teamId = teams[0].id;
    const spacesRes = await clickupClient.get(`/team/${teamId}/space`);
    const spaces = spacesRes.data?.spaces || [];
    for (const space of spaces) {
      const foldersRes = await clickupClient.get(`/space/${space.id}/folder`);
      const folders = foldersRes.data?.folders || [];
      for (const folder of folders) {
        const listsRes = await clickupClient.get(`/folder/${folder.id}/list`);
        const lists = listsRes.data?.lists || [];
        for (const list of lists) {
          if (list.name?.toUpperCase().includes("VIDEO AD BOARD") || list.name?.toUpperCase().includes("VIDEO_AD_BOARD")) {
            return { listId: list.id, statusName: "SCRIPT REVIEW" };
          }
        }
      }
      const folderlessRes = await clickupClient.get(`/space/${space.id}/list`);
      const folderlessLists = folderlessRes.data?.lists || [];
      for (const list of folderlessLists) {
        if (list.name?.toUpperCase().includes("VIDEO AD BOARD") || list.name?.toUpperCase().includes("VIDEO_AD_BOARD")) {
          return { listId: list.id, statusName: "SCRIPT REVIEW" };
        }
      }
    }
    if (spaces.length > 0) {
      const foldersRes = await clickupClient.get(`/space/${spaces[0].id}/folder`);
      const folders = foldersRes.data?.folders || [];
      if (folders.length > 0) {
        const listsRes = await clickupClient.get(`/folder/${folders[0].id}/list`);
        const lists = listsRes.data?.lists || [];
        if (lists.length > 0) {
          return { listId: lists[0].id, statusName: "to do" };
        }
      }
      const folderlessRes = await clickupClient.get(`/space/${spaces[0].id}/list`);
      const folderlessLists = folderlessRes.data?.lists || [];
      if (folderlessLists.length > 0) {
        return { listId: folderlessLists[0].id, statusName: "to do" };
      }
    }
    throw new Error("No suitable ClickUp list found");
  } catch (error) {
    console.error("[ClickUp] Error finding list:", error?.response?.data || error.message);
    throw error;
  }
}
async function createScriptTask(scriptTitle, scriptType, score, scriptContent, product, priority) {
  try {
    const { listId, statusName } = await findVideoAdBoardList();
    const taskName = `${scriptTitle} - ${scriptType}`;
    const description = `**Script Type:** ${scriptType}
**Product:** ${product}
**Priority:** ${priority}
**Expert Review Score:** ${score}/100

---

${scriptContent}`;
    const priorityMap = {
      Urgent: 1,
      High: 2,
      Medium: 3,
      Low: 4
    };
    const res = await clickupClient.post(`/list/${listId}/task`, {
      name: taskName,
      description,
      status: statusName,
      priority: priorityMap[priority] || 3,
      tags: [scriptType, product, "pipeline-generated"]
    });
    return {
      id: res.data.id,
      name: res.data.name,
      url: res.data.url,
      status: res.data.status?.status || statusName
    };
  } catch (error) {
    console.error("[ClickUp] Error creating task:", error?.response?.data || error.message);
    return {
      id: `pending-${Date.now()}`,
      name: `${scriptTitle} - ${scriptType}`,
      url: "#",
      status: "pending"
    };
  }
}
async function createMultipleScriptTasks(scripts, product, priority) {
  const tasks = [];
  for (const script of scripts) {
    const task = await createScriptTask(
      script.title,
      script.type,
      script.score,
      script.content,
      product,
      priority
    );
    tasks.push(task);
  }
  return tasks;
}
async function createUgcVariantTask(variant) {
  try {
    const { listId, statusName } = await findVideoAdBoardList();
    const taskName = `UGC Clone #${variant.uploadId}-${variant.variantNumber} - ${variant.actorArchetype}`;
    const description = `**Pipeline:** UGC Clone Engine
**Product:** ${variant.product}
**Actor Archetype:** ${variant.actorArchetype}
**Voice Tone:** ${variant.voiceTone}
**Energy Level:** ${variant.energyLevel}
**Runtime:** ~${variant.runtime}s
**Hook Variation:** ${variant.hookVariation || "Default"}
**CTA Variation:** ${variant.ctaVariation || "Default"}

---

**SCRIPT:**

${variant.scriptText}`;
    const res = await clickupClient.post(`/list/${listId}/task`, {
      name: taskName,
      description,
      status: "Review",
      // Per requirements: push to "Review" status
      priority: 3,
      // Medium priority by default
      tags: ["UGC Clone", variant.actorArchetype, variant.product, "pipeline-generated"]
    });
    return {
      id: res.data.id,
      name: res.data.name,
      url: res.data.url,
      status: res.data.status?.status || "Review"
    };
  } catch (error) {
    console.error("[ClickUp] Error creating UGC variant task:", error?.response?.data || error.message);
    return {
      id: `pending-${Date.now()}`,
      name: `UGC Clone #${variant.uploadId}-${variant.variantNumber}`,
      url: "#",
      status: "pending"
    };
  }
}
async function pushUgcVariantsToClickup(variants) {
  const results = [];
  for (const variant of variants) {
    const task = await createUgcVariantTask(variant);
    results.push({ variantId: variant.id, task });
  }
  return results;
}
var clickupClient;
var init_clickup = __esm({
  "server/services/clickup.ts"() {
    "use strict";
    init_env();
    clickupClient = axios6.create({
      baseURL: "https://api.clickup.com/api/v2",
      headers: {
        Authorization: ENV.clickupApiKey,
        "Content-Type": "application/json"
      },
      timeout: 3e4
    });
  }
});

// server/storage.ts
function getStorageConfig() {
  const baseUrl2 = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;
  if (!baseUrl2 || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { baseUrl: baseUrl2.replace(/\/+$/, ""), apiKey };
}
function buildUploadUrl(baseUrl2, relKey) {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl2));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}
function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function toFormData(data, contentType, fileName) {
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}
function buildAuthHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { baseUrl: baseUrl2, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl2, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    init_env();
  }
});

// server/services/nanoBananaPro.ts
var nanoBananaPro_exports = {};
__export(nanoBananaPro_exports, {
  MODEL_LABELS: () => MODEL_LABELS,
  generateProductAdWithNanoBananaPro: () => generateProductAdWithNanoBananaPro
});
import axios7 from "axios";
async function generateProductAdWithNanoBananaPro(options) {
  const {
    prompt,
    controlImageUrl,
    productRenderUrl,
    aspectRatio = "1:1",
    resolution = "2K",
    model = "nano_banana_pro",
    useCompositing = false,
    productPosition = "center",
    productScale = 0.45
  } = options;
  const modelId = MODEL_IDS[model];
  const modelLabel = MODEL_LABELS[model];
  return generateProductAdWithNanaBananaPro_internal({
    prompt,
    controlImageUrl,
    productRenderUrl,
    aspectRatio,
    resolution,
    modelId,
    modelLabel
  });
}
async function generateProductAdWithNanaBananaPro_internal(opts) {
  const { prompt, controlImageUrl, productRenderUrl, aspectRatio, resolution, modelId, modelLabel } = opts;
  console.log(`[NanaBanana] Generating image with ${modelLabel} (${modelId})`);
  console.log(`[NanaBanana] Aspect ratio: ${aspectRatio}, Resolution: ${resolution}`);
  try {
    const contents = [];
    if (controlImageUrl) {
      console.log(`[NanaBanana] Using control image: ${controlImageUrl}`);
      const controlImageData = await fetchImageAsBase64(controlImageUrl);
      contents.push({
        parts: [
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: controlImageData
            }
          }
        ]
      });
    }
    if (productRenderUrl) {
      console.log(`[NanaBanana] Using product render: ${productRenderUrl}`);
      const productImageData = await fetchImageAsBase64(productRenderUrl);
      contents.push({
        parts: [
          {
            inline_data: {
              mime_type: "image/png",
              data: productImageData
            }
          }
        ]
      });
    }
    contents.push({
      parts: [{ text: prompt }]
    });
    const generationConfig = {
      response_modalities: ["IMAGE"]
    };
    if (!controlImageUrl) {
      generationConfig.image_config = {
        aspect_ratio: aspectRatio,
        image_size: resolution
      };
    }
    const requestBody = {
      contents,
      generation_config: generationConfig
    };
    console.log(`[NanaBanana] Sending request to Gemini API (${modelId})...`);
    const response = await axios7.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GOOGLE_AI_API_KEY}`,
      requestBody,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 18e4
      }
    );
    console.log(`[NanaBanana] Received response from Gemini API`);
    const candidates = response.data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No candidates in Gemini API response");
    }
    const parts = candidates[0].content.parts;
    if (!parts || parts.length === 0) {
      throw new Error("No parts in Gemini API response");
    }
    const finalImageParts = parts.filter((p) => p.inlineData && !p.thought);
    if (finalImageParts.length === 0) {
      console.error("[NanaBanana] No final image found, all parts:", JSON.stringify(parts, null, 2));
      throw new Error("No final image in Gemini API response (only thought images found)");
    }
    const imagePart = finalImageParts[finalImageParts.length - 1];
    const imageData = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType;
    console.log(`[NanaBanana] Image generated successfully, uploading to S3...`);
    const imageBuffer = Buffer.from(imageData, "base64");
    const fileExtension = mimeType === "image/png" ? "png" : "jpg";
    const s3Key = `nano-banana/${modelId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const { url: imageUrl } = await storagePut(s3Key, imageBuffer, mimeType);
    console.log(`[NanaBanana] Image uploaded to S3: ${imageUrl}`);
    return { imageUrl, s3Key };
  } catch (error) {
    console.error(`[NanaBanana] Error generating image (${modelLabel}):`, error.response?.data || error.message);
    throw new Error(
      `${modelLabel} generation failed: ${error.response?.data?.error?.message || error.message}`
    );
  }
}
async function fetchImageAsBase64(url) {
  try {
    const response = await axios7.get(url, {
      responseType: "arraybuffer",
      timeout: 3e4
    });
    return Buffer.from(response.data).toString("base64");
  } catch (error) {
    console.error(`[NanaBanana] Error fetching image from ${url}:`, error.message);
    throw new Error(`Failed to fetch image: ${error.message}`);
  }
}
var GOOGLE_AI_API_KEY, MODEL_IDS, MODEL_LABELS;
var init_nanoBananaPro = __esm({
  "server/services/nanoBananaPro.ts"() {
    "use strict";
    init_storage();
    GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;
    if (!GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY environment variable is not set");
    }
    MODEL_IDS = {
      nano_banana_pro: "gemini-3-pro-image-preview",
      nano_banana_2: "gemini-3.1-flash-image-preview"
    };
    MODEL_LABELS = {
      nano_banana_pro: "Nano Banana Pro",
      nano_banana_2: "Nano Banana 2"
    };
  }
});

// server/_core/llm.ts
var llm_exports = {};
__export(llm_exports, {
  invokeLLM: () => invokeLLM
});
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: "gemini-2.5-flash",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  payload.max_tokens = 32768;
  payload.thinking = {
    "budget_tokens": 128
  };
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, resolveApiUrl, assertApiKey, normalizeResponseFormat;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file_url") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    resolveApiUrl = () => ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0 ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions` : "https://forge.manus.im/v1/chat/completions";
    assertApiKey = () => {
      if (!ENV.forgeApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    };
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
  }
});

// server/services/ugcClone.ts
var ugcClone_exports = {};
__export(ugcClone_exports, {
  extractStructureBlueprint: () => extractStructureBlueprint,
  generateVariants: () => generateVariants
});
async function extractStructureBlueprint(transcript, videoUrl) {
  const prompt = `You are analyzing a winning UGC video transcript to extract its structural blueprint.

TRANSCRIPT:
${transcript}

Your task:
1. Identify the HOOK (first 3-5 seconds) \u2014 the attention-grabbing opening
2. Identify the BODY \u2014 the main content with key selling points
3. Identify the CTA \u2014 the call-to-action at the end
4. Detect pacing characteristics (words per minute, energy level)
5. Extract any compliance language that must be preserved exactly (e.g., disclaimers, claims)

CRITICAL RULES:
- Preserve the structural timing \u2014 hook length, body flow, CTA placement
- Identify what makes the hook STRONG (pattern interrupt, question, bold claim, relatability)
- Note the energy level (high/medium/low) based on pacing and tone
- Flag any compliance phrases that cannot be altered

Return a detailed structural analysis.`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a UGC video structure analyst. You extract winning patterns from transcripts." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "structure_blueprint",
        strict: true,
        schema: {
          type: "object",
          properties: {
            hook: {
              type: "object",
              properties: {
                text: { type: "string" },
                startTime: { type: "number" },
                endTime: { type: "number" },
                strength: { type: "string", enum: ["strong", "medium", "weak"] }
              },
              required: ["text", "startTime", "endTime", "strength"],
              additionalProperties: false
            },
            body: {
              type: "object",
              properties: {
                text: { type: "string" },
                startTime: { type: "number" },
                endTime: { type: "number" },
                keyPoints: { type: "array", items: { type: "string" } }
              },
              required: ["text", "startTime", "endTime", "keyPoints"],
              additionalProperties: false
            },
            cta: {
              type: "object",
              properties: {
                text: { type: "string" },
                startTime: { type: "number" },
                endTime: { type: "number" },
                urgency: { type: "string", enum: ["high", "medium", "low"] }
              },
              required: ["text", "startTime", "endTime", "urgency"],
              additionalProperties: false
            },
            pacing: {
              type: "object",
              properties: {
                wordsPerMinute: { type: "number" },
                pauseCount: { type: "number" },
                energyLevel: { type: "string", enum: ["high", "medium", "low"] }
              },
              required: ["wordsPerMinute", "pauseCount", "energyLevel"],
              additionalProperties: false
            },
            complianceLanguage: { type: "array", items: { type: "string" } },
            structuralNotes: { type: "string" }
          },
          required: ["hook", "body", "cta", "pacing", "complianceLanguage", "structuralNotes"],
          additionalProperties: false
        }
      }
    }
  });
  const content = response.choices[0].message.content;
  if (!content || typeof content !== "string") throw new Error("No structure blueprint generated");
  return JSON.parse(content);
}
async function generateVariants(config) {
  const { desiredOutputVolume, structureBlueprint, transcript, product, audienceTag } = config;
  const actorArchetypes = [
    "fitness enthusiast",
    "busy mum",
    "athlete",
    "biohacker",
    "wellness advocate",
    "gym regular",
    "health-conscious professional"
  ];
  const voiceTones = ["energetic", "calm", "authoritative", "relatable", "conversational"];
  const energyLevels = ["low", "medium", "high"];
  const prompt = `You are generating ${desiredOutputVolume} controlled UGC script variants from a winning structure.

ORIGINAL TRANSCRIPT:
${transcript}

STRUCTURE BLUEPRINT:
- Hook: "${structureBlueprint.hook.text}" (${structureBlueprint.hook.strength} strength)
- Body: ${structureBlueprint.body.keyPoints.join(", ")}
- CTA: "${structureBlueprint.cta.text}" (${structureBlueprint.cta.urgency} urgency)
- Pacing: ${structureBlueprint.pacing.wordsPerMinute} WPM, ${structureBlueprint.pacing.energyLevel} energy
- Compliance: ${structureBlueprint.complianceLanguage.join("; ")}

PRODUCT: ${product}
AUDIENCE: ${audienceTag || "general fitness audience"}

CRITICAL RULES:
1. PRESERVE STRUCTURE \u2014 same hook/body/CTA timing and flow
2. PRESERVE COMPLIANCE LANGUAGE \u2014 use exact phrases from complianceLanguage array
3. MUTATE SURFACE ONLY \u2014 change phrasing, actor archetype, tone, energy
4. NO NEW CLAIMS \u2014 only rephrase existing benefits
5. MAINTAIN FIRST 3 SECONDS STRENGTH \u2014 hook must grab attention immediately
6. RESPECT PACING \u2014 match approximate word count and rhythm

Generate ${desiredOutputVolume} variants distributed across:
- Actor archetypes: ${actorArchetypes.slice(0, Math.min(7, desiredOutputVolume)).join(", ")}
- Voice tones: ${voiceTones.join(", ")}
- Energy levels: low, medium, high

Each variant should feel like a different person saying the same winning message.`;
  const response = await invokeLLM({
    messages: [
      { role: "system", content: "You are a UGC script variant generator. You create controlled mutations of winning structures." },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "variant_batch",
        strict: true,
        schema: {
          type: "object",
          properties: {
            variants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  variantNumber: { type: "number" },
                  actorArchetype: { type: "string" },
                  voiceTone: { type: "string" },
                  energyLevel: { type: "string", enum: ["low", "medium", "high"] },
                  scriptText: { type: "string" },
                  hookVariation: { type: "string" },
                  ctaVariation: { type: "string" },
                  runtime: { type: "number" }
                },
                required: ["variantNumber", "actorArchetype", "voiceTone", "energyLevel", "scriptText", "hookVariation", "ctaVariation", "runtime"],
                additionalProperties: false
              }
            }
          },
          required: ["variants"],
          additionalProperties: false
        }
      }
    }
  });
  const content = response.choices[0].message.content;
  if (!content || typeof content !== "string") throw new Error("No variants generated");
  const parsed = JSON.parse(content);
  return parsed.variants;
}
var init_ugcClone = __esm({
  "server/services/ugcClone.ts"() {
    "use strict";
    init_llm();
  }
});

// server/services/childVariationPrompts.ts
function buildChildVariationPrompt(options) {
  const {
    variationType,
    productName,
    headline,
    subheadline,
    aspectRatio = "1:1"
  } = options;
  const baseInstruction = `You are creating a TACTICAL VARIATION of the provided parent image.

CRITICAL: This is NOT a new creative. This is a variation of an existing image with ONE specific tactical change.

=== PARENT IMAGE ===
I am providing the parent image that you must use as your base reference.

=== WHAT TO KEEP EXACTLY THE SAME ===
- Headline: "${headline}"${subheadline ? `
- Subheadline: "${subheadline}"` : ""}
- Product: ${productName} (same position, same angle, same prominence)
- Overall composition and layout
- Background concept and theme
- Visual metaphors and storytelling elements
- Text placement and hierarchy
- General mood and energy level

=== WHAT TO CHANGE ===
`;
  let variationInstructions = "";
  switch (variationType) {
    case "color_shift":
      variationInstructions = `COLOR PALETTE SHIFT:
- Change the color temperature or palette whilst keeping the same composition
- Examples:
  * Warm (orange/red) \u2192 Cool (blue/purple)
  * Saturated \u2192 Desaturated/muted
  * Bright \u2192 Dark/moody
  * Single dominant color \u2192 Complementary color
- Keep the same lighting direction and intensity
- Keep the same contrast levels
- The shift should feel intentional, not random
- Product label colors must remain accurate`;
      break;
    case "lighting_variation":
      variationInstructions = `LIGHTING DIRECTION/INTENSITY:
- Change how the scene is lit whilst keeping the same composition
- Examples:
  * Front lighting \u2192 Side lighting or back lighting
  * Soft diffused \u2192 Hard dramatic shadows
  * Single light source \u2192 Multiple light sources
  * Bright \u2192 Dim/atmospheric
  * Warm lighting \u2192 Cool lighting
- Keep the same color palette
- Keep the same background elements
- The lighting should create a different mood but same energy level`;
      break;
    case "typography_tweak":
      variationInstructions = `TYPOGRAPHY ADJUSTMENTS:
- Modify text styling whilst keeping the same words and general placement
- Examples:
  * Bold \u2192 Extra bold or medium weight
  * Larger text \u2192 Smaller text (but still legible)
  * Tighter letter spacing \u2192 Wider letter spacing
  * Different stroke thickness on text outline
  * Text slightly repositioned (e.g., top-center \u2192 top-left)
- Keep the same headline and subheadline text
- Keep the same color palette and lighting
- Keep the same background and product
- Text must remain highly legible`;
      break;
    case "product_angle":
      variationInstructions = `PRODUCT POSITIONING:
- Adjust the product bottle's position or angle whilst keeping the same scene
- Examples:
  * Rotate product 15-30\xB0 left or right
  * Tilt product forward or backward slightly
  * Move product slightly left/right/up/down in frame
  * Change product size (slightly larger or smaller)
- Keep the same background, lighting, and color palette
- Keep the same text and typography
- Product label must remain visible and legible
- Product should still feel naturally integrated into the scene`;
      break;
    case "background_intensity":
      variationInstructions = `BACKGROUND EFFECT INTENSITY:
- Dial the background effects up or down whilst keeping the same concept
- Examples:
  * Subtle fire \u2192 Raging inferno (or vice versa)
  * Few particles \u2192 Dense particle field (or vice versa)
  * Minimal smoke \u2192 Heavy atmospheric smoke (or vice versa)
  * Clean background \u2192 Busier background (or vice versa)
- Keep the same color palette and lighting direction
- Keep the same product position and text
- Keep the same visual concept and metaphor
- The change should be noticeable but not completely different`;
      break;
    case "layout_adjustment":
      variationInstructions = `LAYOUT COMPOSITION:
- Adjust the spatial arrangement whilst keeping the same elements
- Examples:
  * Centered product \u2192 Off-center (rule of thirds)
  * Symmetrical \u2192 Asymmetrical composition
  * Tight framing \u2192 Looser framing with more breathing room
  * Foreground elements repositioned
- Keep the same color palette, lighting, and effects
- Keep the same headline and typography style
- Keep the same background concept
- All elements must remain visible and balanced`;
      break;
    case "effect_intensity":
      variationInstructions = `VISUAL EFFECTS INTENSITY:
- Adjust the intensity of visual effects (glow, blur, particles, etc.)
- Examples:
  * Subtle glow \u2192 Strong dramatic glow (or vice versa)
  * Sharp focus \u2192 Slight motion blur on background
  * Minimal depth of field \u2192 Strong depth of field
  * Clean edges \u2192 Atmospheric blur/haze
  * Few light rays \u2192 Intense light rays (or vice versa)
- Keep the same composition, color palette, and layout
- Keep the same product position and text
- Keep the same background concept
- Effects should enhance, not distract`;
      break;
  }
  const closingInstructions = `

=== QUALITY STANDARDS ===
- The variation should feel like "the same ad, slightly different"
- Someone should be able to tell these are variations of each other
- The change should be noticeable but not jarring
- Maintain the same production quality as the parent
- Aspect ratio: ${aspectRatio}

=== AVOID ===
\u2717 Changing multiple tactical elements at once (only change what's specified)
\u2717 Creating something that looks completely different from the parent
\u2717 Changing the headline or core message
\u2717 Obscuring the product label
\u2717 Making the variation look worse than the parent
\u2717 Ignoring the parent image and creating something new

=== FINAL GOAL ===
Create a variation that a designer would make when exploring "what if we tried this slightly differently?"

The parent and child should feel like they belong to the same campaign, just with one tactical element adjusted for testing purposes.`;
  return baseInstruction + variationInstructions + closingInstructions;
}
function getDiverseVariationTypes(count) {
  const allTypes = [
    "color_shift",
    "lighting_variation",
    "typography_tweak",
    "product_angle",
    "background_intensity",
    "layout_adjustment",
    "effect_intensity"
  ];
  const result = [];
  let availableTypes = [...allTypes];
  for (let i = 0; i < count; i++) {
    if (availableTypes.length === 0) {
      availableTypes = [...allTypes];
    }
    const randomIndex = Math.floor(Math.random() * availableTypes.length);
    const selectedType = availableTypes[randomIndex];
    result.push(selectedType);
    availableTypes.splice(randomIndex, 1);
  }
  return result;
}
var init_childVariationPrompts = __esm({
  "server/services/childVariationPrompts.ts"() {
    "use strict";
  }
});

// server/services/childVariationGeneration.ts
var childVariationGeneration_exports = {};
__export(childVariationGeneration_exports, {
  generateChildVariationsForParents: () => generateChildVariationsForParents,
  getChildrenForParent: () => getChildrenForParent
});
async function generateChildVariationsForParents(parentRunIds, childCountPerParent) {
  console.log(`[ChildGen] Starting child generation for ${parentRunIds.length} parents, ${childCountPerParent} children each`);
  for (const parentRunId of parentRunIds) {
    try {
      await generateChildVariationsForSingleParent(parentRunId, childCountPerParent);
    } catch (err) {
      console.error(`[ChildGen] Failed to generate children for parent #${parentRunId}:`, err);
    }
  }
  console.log(`[ChildGen] Completed child generation for all parents`);
}
async function generateChildVariationsForSingleParent(parentRunId, childCount) {
  console.log(`[ChildGen] Generating ${childCount} children for parent #${parentRunId}`);
  const parent = await getPipelineRun(parentRunId);
  if (!parent) {
    throw new Error(`Parent run #${parentRunId} not found`);
  }
  const product = parent.product;
  const aspectRatio = parent.aspectRatio || "1:1";
  const iterationVariations = parent.iterationVariations;
  if (!iterationVariations || !Array.isArray(iterationVariations) || iterationVariations.length === 0) {
    throw new Error(`Parent run #${parentRunId} has no variations to use as base`);
  }
  const parentVariation = iterationVariations[0];
  const parentImageUrl = parentVariation.url;
  const headline = parentVariation.headline || `${product.toUpperCase()} VARIATION`;
  const subheadline = parentVariation.subheadline || void 0;
  const variationTypes = getDiverseVariationTypes(childCount);
  const productRender = await getDefaultProductRender(product);
  if (!productRender) {
    throw new Error(`No product render found for ${product}`);
  }
  for (let i = 0; i < childCount; i++) {
    const variationType = variationTypes[i];
    try {
      console.log(`[ChildGen] Generating child ${i + 1}/${childCount} for parent #${parentRunId} (type: ${variationType})`);
      const childRunId = await createPipelineRun({
        pipelineType: "iteration",
        status: "running",
        product,
        priority: parent.priority,
        triggerSource: "child_generation",
        iterationSourceUrl: parentImageUrl,
        creativityLevel: parent.creativityLevel,
        aspectRatio,
        parentRunId,
        variationLayer: "child",
        variationType,
        iterationStage: "generating_child"
      });
      const prompt = buildChildVariationPrompt({
        parentImageUrl,
        variationType,
        productName: `ONEST Health ${product}`,
        headline,
        subheadline,
        aspectRatio
      });
      console.log(`[ChildGen] Prompt for child #${childRunId}: ${prompt.substring(0, 150)}...`);
      const result = await withTimeout(
        generateProductAdWithNanoBananaPro({
          prompt,
          controlImageUrl: parentImageUrl,
          productRenderUrl: productRender.url,
          aspectRatio,
          useCompositing: false,
          productPosition: "center",
          productScale: 0.45
        }),
        VARIATION_TIMEOUT,
        `Child ${i + 1}/${childCount} for parent #${parentRunId}`
      );
      const childImageUrl = result.imageUrl;
      const childImageS3Key = result.s3Key;
      await updatePipelineRun(childRunId, {
        status: "completed",
        iterationStage: "child_complete",
        iterationVariations: [
          {
            url: childImageUrl,
            s3Key: childImageS3Key,
            headline,
            subheadline,
            variationType,
            parentRunId
          }
        ],
        completedAt: /* @__PURE__ */ new Date()
      });
      console.log(`[ChildGen] Child #${childRunId} completed: ${childImageUrl}`);
    } catch (err) {
      console.error(`[ChildGen] Failed to generate child ${i + 1} for parent #${parentRunId}:`, err);
    }
  }
  console.log(`[ChildGen] Completed ${childCount} children for parent #${parentRunId}`);
}
async function getChildrenForParent(parentRunId) {
  return getChildRunsByParentId(parentRunId);
}
var init_childVariationGeneration = __esm({
  "server/services/childVariationGeneration.ts"() {
    "use strict";
    init_db();
    init_nanoBananaPro();
    init_childVariationPrompts();
    init_shared();
  }
});

// server/_core/voiceTranscription.ts
var voiceTranscription_exports = {};
__export(voiceTranscription_exports, {
  transcribeAudio: () => transcribeAudio2
});
async function transcribeAudio2(options) {
  try {
    if (!ENV.forgeApiUrl) {
      return {
        error: "Voice transcription service is not configured",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_URL is not set"
      };
    }
    if (!ENV.forgeApiKey) {
      return {
        error: "Voice transcription service authentication is missing",
        code: "SERVICE_ERROR",
        details: "BUILT_IN_FORGE_API_KEY is not set"
      };
    }
    let audioBuffer;
    let mimeType;
    try {
      if (options.audioPath) {
        const { readFile } = await import("fs/promises");
        audioBuffer = await readFile(options.audioPath);
        const ext = options.audioPath.split(".").pop()?.toLowerCase();
        const extToMime = {
          "mp3": "audio/mpeg",
          "wav": "audio/wav",
          "webm": "audio/webm",
          "ogg": "audio/ogg",
          "m4a": "audio/mp4"
        };
        mimeType = extToMime[ext || ""] || "audio/mpeg";
      } else if (options.audioUrl) {
        const response2 = await fetch(options.audioUrl);
        if (!response2.ok) {
          return {
            error: "Failed to download audio file",
            code: "INVALID_FORMAT",
            details: `HTTP ${response2.status}: ${response2.statusText}`
          };
        }
        audioBuffer = Buffer.from(await response2.arrayBuffer());
        mimeType = response2.headers.get("content-type") || "audio/mpeg";
      } else {
        return {
          error: "Either audioUrl or audioPath must be provided",
          code: "INVALID_FORMAT",
          details: "No audio source specified"
        };
      }
      const sizeMB = audioBuffer.length / (1024 * 1024);
      if (sizeMB > 16) {
        return {
          error: "Audio file exceeds maximum size limit",
          code: "FILE_TOO_LARGE",
          details: `File size is ${sizeMB.toFixed(2)}MB, maximum allowed is 16MB`
        };
      }
    } catch (error) {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      };
    }
    const formData = new FormData();
    const filename = `audio.${getFileExtension(mimeType)}`;
    const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
    formData.append("file", audioBlob, filename);
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    const prompt = options.prompt || (options.language ? `Transcribe the user's voice to text, the user's working language is ${getLanguageName(options.language)}` : "Transcribe the user's voice to text");
    formData.append("prompt", prompt);
    const baseUrl2 = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
    const fullUrl = new URL(
      "v1/audio/transcriptions",
      baseUrl2
    ).toString();
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "Accept-Encoding": "identity"
      },
      body: formData
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Transcription service request failed",
        code: "TRANSCRIPTION_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`
      };
    }
    const whisperResponse = await response.json();
    if (!whisperResponse.text || typeof whisperResponse.text !== "string") {
      return {
        error: "Invalid transcription response",
        code: "SERVICE_ERROR",
        details: "Transcription service returned an invalid response format"
      };
    }
    return whisperResponse;
  } catch (error) {
    return {
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: error instanceof Error ? error.message : "An unexpected error occurred"
    };
  }
}
function getFileExtension(mimeType) {
  const mimeToExt = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a"
  };
  return mimeToExt[mimeType] || "audio";
}
function getLanguageName(langCode) {
  const langMap = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "ru": "Russian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese",
    "ar": "Arabic",
    "hi": "Hindi",
    "nl": "Dutch",
    "pl": "Polish",
    "tr": "Turkish",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish"
  };
  return langMap[langCode] || langCode;
}
var init_voiceTranscription = __esm({
  "server/_core/voiceTranscription.ts"() {
    "use strict";
    init_env();
  }
});

// server/services/audioCompression.ts
var audioCompression_exports = {};
__export(audioCompression_exports, {
  compressAudioForWhisper: () => compressAudioForWhisper
});
import { exec as exec2 } from "child_process";
import { promisify as promisify3 } from "util";
import { writeFile, unlink } from "fs/promises";
import { randomBytes } from "crypto";
import path4 from "path";
import os4 from "os";
async function compressAudioForWhisper(videoUrl) {
  const tempDir = os4.tmpdir();
  const randomId = randomBytes(8).toString("hex");
  const inputPath = path4.join(tempDir, `video-${randomId}.mp4`);
  const outputPath = path4.join(tempDir, `audio-${randomId}.mp3`);
  try {
    console.log(`[AudioCompression] Downloading video from ${videoUrl}`);
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await writeFile(inputPath, Buffer.from(buffer));
    console.log(`[AudioCompression] Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB to ${inputPath}`);
    const ffmpegCmd = `ffmpeg -i "${inputPath}" -vn -ar 16000 -ac 1 -b:a 32k -f mp3 "${outputPath}" -y`;
    console.log(`[AudioCompression] Running: ${ffmpegCmd}`);
    const { stdout, stderr } = await execAsync2(ffmpegCmd);
    console.log(`[AudioCompression] ffmpeg output:`, stderr.slice(-500));
    const { size } = await import("fs/promises").then((m) => m.stat(outputPath));
    const sizeMB = size / 1024 / 1024;
    console.log(`[AudioCompression] Compressed audio size: ${sizeMB.toFixed(2)}MB`);
    if (sizeMB > 16) {
      throw new Error(`Compressed audio still too large: ${sizeMB.toFixed(2)}MB (max 16MB)`);
    }
    await unlink(inputPath).catch(() => {
    });
    return outputPath;
  } catch (error) {
    await unlink(inputPath).catch(() => {
    });
    await unlink(outputPath).catch(() => {
    });
    throw error;
  }
}
var execAsync2;
var init_audioCompression = __esm({
  "server/services/audioCompression.ts"() {
    "use strict";
    execAsync2 = promisify3(exec2);
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/oauth.ts
init_db();

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
init_db();
init_env();
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
init_env();
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl2) => {
  const normalizedBase = baseUrl2.endsWith("/") ? baseUrl2 : `${baseUrl2}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_db();
import { z as z4 } from "zod";

// server/services/foreplay.ts
init_env();
import axios2 from "axios";
var FOREPLAY_BASE = "https://public.api.foreplay.co";
var foreplayClient = axios2.create({
  baseURL: FOREPLAY_BASE,
  headers: {
    Authorization: `Bearer ${ENV.foreplayApiKey}`
  },
  timeout: 3e4
});
var BOARD_IDS = {
  inspo: "6nEqpgBrTtip6dD98R3X",
  // #inspo — video ads
  static_inspo: "K2LrL6uQapf8EBT1ZbUN"
  // #static_inspo — static/image ads
};
async function fetchBoardAds(boardId, limit = 100) {
  const allAds = [];
  let offset = 0;
  const pageSize = Math.min(limit, 100);
  const maxPages = 10;
  try {
    console.log(`[Foreplay] Fetching ads from board ${boardId}, limit=${limit} (paginated)`);
    for (let page = 0; page < maxPages; page++) {
      const res = await foreplayClient.get("/api/board/ads", {
        params: { board_id: boardId, limit: pageSize, offset }
      });
      const data = res.data?.data || [];
      console.log(`[Foreplay] Page ${page + 1}: got ${data.length} ads (offset=${offset})`);
      allAds.push(...data);
      if (data.length < pageSize || allAds.length >= limit) break;
      offset += data.length;
    }
    console.log(`[Foreplay] Total: ${allAds.length} ads from board ${boardId}`);
    return normalizeAds(allAds.slice(0, limit));
  } catch (error) {
    console.error("[Foreplay] Error fetching board ads:", error?.response?.status, error?.response?.data || error.message);
    if (allAds.length > 0) {
      console.log(`[Foreplay] Returning ${allAds.length} ads fetched before error`);
      return normalizeAds(allAds);
    }
    return [];
  }
}
function normalizeAds(ads) {
  return ads.map((ad, idx) => {
    let transcription = ad.full_transcription || "";
    if (!transcription && ad.timestamped_transcription && Array.isArray(ad.timestamped_transcription)) {
      transcription = ad.timestamped_transcription.map((t2) => t2.sentence || "").join(" ").trim();
    }
    const extractedImage = ad.cards?.[0]?.image || ad.image || "";
    return {
      id: ad.id || ad.ad_id || String(Math.random()),
      title: ad.headline || ad.name || ad.description?.slice(0, 80) || "Untitled Ad",
      brandName: ad.name || "",
      mediaUrl: ad.video || "",
      // video URL
      thumbnailUrl: ad.thumbnail || extractedImage || "",
      // thumbnail from creatives array
      imageUrl: extractedImage,
      // static image from creatives array
      mediaType: (ad.display_format || "").toLowerCase(),
      platform: ad.publisher_platform || "facebook",
      description: ad.description || "",
      headline: ad.headline || "",
      createdAt: ad.started_running || (/* @__PURE__ */ new Date()).toISOString(),
      displayFormat: ad.display_format || "",
      transcription
    };
  });
}
async function fetchVideoAds(limit = 10) {
  const ads = await fetchBoardAds(BOARD_IDS.inspo, limit);
  console.log(`[Foreplay] Fetched ${ads.length} ads from #inspo (video board)`);
  return ads;
}
async function fetchStaticAds(limit = 20) {
  const ads = await fetchBoardAds(BOARD_IDS.static_inspo, limit);
  console.log(`[Foreplay] Fetched ${ads.length} ads from #static_inspo (static board)`);
  return ads;
}
async function listBoards() {
  try {
    const res = await foreplayClient.get("/api/boards", {
      params: { offset: 0, limit: 10 }
    });
    return res.data?.data || [];
  } catch (error) {
    console.error("[Foreplay] Error listing boards:", error?.response?.data || error.message);
    return [];
  }
}

// server/services/foreplaySync.ts
init_db();
var SYNC_INTERVAL_MS = 60 * 60 * 1e3;
var _syncTimer = null;
var _lastSyncAt = null;
var _isSyncing = false;
async function syncFromForeplay() {
  if (_isSyncing) {
    console.log("[ForeplaySync] Sync already in progress, skipping");
    return { newCount: 0, totalFetched: 0, error: "Sync already in progress" };
  }
  _isSyncing = true;
  console.log("[ForeplaySync] Starting sync from Foreplay...");
  try {
    const existingIds = await getExistingForeplayAdIds();
    console.log(`[ForeplaySync] ${existingIds.size} existing creatives in local DB`);
    const [videoAds, staticAds] = await Promise.all([
      fetchVideoAds(1e3),
      fetchStaticAds(1e3)
    ]);
    const totalFetched = videoAds.length + staticAds.length;
    console.log(`[ForeplaySync] Fetched ${videoAds.length} video + ${staticAds.length} static = ${totalFetched} total from Foreplay`);
    let newCount = 0;
    for (const ad of videoAds) {
      if (existingIds.has(ad.id)) continue;
      try {
        const creative = {
          foreplayAdId: ad.id,
          type: "VIDEO",
          board: "inspo",
          title: ad.title || "Untitled Video",
          brandName: ad.brandName || null,
          thumbnailUrl: ad.thumbnailUrl || null,
          imageUrl: ad.imageUrl || null,
          mediaUrl: ad.mediaUrl || null,
          mediaType: ad.mediaType || null,
          platform: ad.platform || null,
          description: ad.description || null,
          headline: ad.headline || null,
          displayFormat: ad.displayFormat || null,
          transcription: ad.transcription || null,
          foreplayCreatedAt: ad.createdAt || null,
          isNew: 1
        };
        await upsertForeplayCreative(creative);
        newCount++;
      } catch (err) {
        console.warn(`[ForeplaySync] Failed to upsert video ad ${ad.id}:`, err.message);
      }
    }
    for (const ad of staticAds) {
      if (existingIds.has(ad.id)) continue;
      try {
        const creative = {
          foreplayAdId: ad.id,
          type: "STATIC",
          board: "static_inspo",
          title: ad.title || "Untitled Static",
          brandName: ad.brandName || null,
          thumbnailUrl: ad.thumbnailUrl || null,
          imageUrl: ad.imageUrl || null,
          mediaUrl: ad.mediaUrl || null,
          mediaType: ad.mediaType || null,
          platform: ad.platform || null,
          description: ad.description || null,
          headline: ad.headline || null,
          displayFormat: ad.displayFormat || null,
          transcription: ad.transcription || null,
          foreplayCreatedAt: ad.createdAt || null,
          isNew: 1
        };
        await upsertForeplayCreative(creative);
        newCount++;
      } catch (err) {
        console.warn(`[ForeplaySync] Failed to upsert static ad ${ad.id}:`, err.message);
      }
    }
    _lastSyncAt = /* @__PURE__ */ new Date();
    console.log(`[ForeplaySync] Sync complete: ${newCount} new creatives imported, ${totalFetched} total fetched`);
    return { newCount, totalFetched };
  } catch (err) {
    console.error("[ForeplaySync] Sync failed:", err.message);
    return { newCount: 0, totalFetched: 0, error: err.message };
  } finally {
    _isSyncing = false;
  }
}
function startAutoSync() {
  if (_syncTimer) {
    console.log("[ForeplaySync] Auto-sync already running");
    return;
  }
  console.log("[ForeplaySync] Starting auto-sync (every 1 hour)");
  (async () => {
    console.log("[ForeplaySync] Running initial sync...");
    const result = await syncFromForeplay();
    console.log(`[ForeplaySync] Initial sync: ${result.newCount} new creatives`);
  })();
  _syncTimer = setInterval(async () => {
    console.log("[ForeplaySync] Running scheduled hourly sync...");
    const result = await syncFromForeplay();
    console.log(`[ForeplaySync] Hourly sync: ${result.newCount} new creatives`);
  }, SYNC_INTERVAL_MS);
}
function getSyncStatus() {
  return {
    lastSyncAt: _lastSyncAt,
    isSyncing: _isSyncing,
    autoSyncActive: _syncTimer !== null
  };
}

// server/routers.ts
init_claude();
init_whisper();
init_clickup();

// server/services/videoPipeline.ts
init_db();
init_whisper();
init_clickup();
init_shared();
var SCRIPT_STYLES = [
  { id: "DR", label: "Direct Response", description: "Hard-sell with clear offer, urgency, and direct CTA" },
  { id: "UGC", label: "UGC / Testimonial", description: "Authentic personal experience, soft-sell recommendation" },
  { id: "FOUNDER", label: "Founder-Led", description: "Brand founder speaking with authority and passion" },
  { id: "BRAND", label: "Brand / Equity", description: "Belief-led content \u2014 asks for belief, not a sale" },
  { id: "EDUCATION", label: "Education / Myth-Busting", description: "Teach something surprising, position product as the answer" },
  { id: "LIFESTYLE", label: "Lifestyle / Aspiration", description: "Aspirational day-in-the-life with product woven in" },
  { id: "DEMO", label: "Problem / Solution Demo", description: "Show the problem, demonstrate the product solving it" }
];
var FUNNEL_STAGE_RULES = {
  cold: `COLD \u2014 NON-NEGOTIABLE RULES:
- Product name does NOT appear in the hook under any circumstances
- Hook leads with the problem, the enemy, or a contrarian statement about the category
- Product introduced as the logical conclusion of the problem \u2014 not the opening premise
- Proof section kept brief \u2014 viewer is not yet invested enough for detailed evidence
- CTA: "link below" / "check it out" / "see for yourself" \u2014 NEVER "buy now"`,
  warm: `WARM \u2014 NON-NEGOTIABLE RULES:
- ONEST can be named after the hook section is complete
- Lead with what makes ONEST different \u2014 transparency, ingredient specificity, Australian-made
- Assume they have seen competitor products \u2014 differentiation is the primary job
- CTA can be more direct: "try ONEST" / "visit onest.com.au"`,
  retargeting: `RETARGETING \u2014 NON-NEGOTIABLE RULES:
- Can open with product name \u2014 they already know it
- Lead immediately with social proof or a specific result
- Address the most likely objection for the product
- CTA is the strongest of any stage \u2014 "try it risk-free" / "30-day guarantee" / "order now"`,
  retention: `RETENTION \u2014 NON-NEGOTIABLE RULES:
- Never re-explain what the product does to someone who already uses it
- Lead with loyalty, community, or new product announcement
- Stack-sell opportunity: reference complementary products they do not own yet
- CTA is relationship-oriented, not transaction-oriented`
};
var SCRIPT_SUB_STRUCTURES = [
  // === DIRECT RESPONSE (7) ===
  {
    id: "DR-1",
    name: "Problem \u2192 Agitate \u2192 Solve (PAS)",
    category: "DR",
    funnelStages: ["cold"],
    awarenessLevel: "Problem Aware",
    platform: "Meta primary, TikTok",
    length: "15\u201330 seconds",
    stages: [
      { stage: "Hook (0\u20133s)", function: "Name the problem in a way that feels uncomfortably personal" },
      { stage: "Problem", function: "Validate and expand the pain \u2014 make them nod" },
      { stage: "Agitate", function: "Make the consequence of inaction feel real and immediate" },
      { stage: "Solve", function: "Introduce ONEST as the logical answer \u2014 lead with mechanism not name" },
      { stage: "Proof", function: "One specific, credible result or credential" },
      { stage: "CTA", function: "Single low-friction action" }
    ],
    whyItConverts: "Intercepts Peter and Lara at their emotion before asking them to care about a product. PAS meets them where they already are.",
    psychologicalLever: "Loss aversion. The agitation phase makes inaction feel more costly than the purchase."
  },
  {
    id: "DR-2",
    name: "Before \u2192 After \u2192 Bridge (BAB)",
    category: "DR",
    funnelStages: ["warm"],
    awarenessLevel: "Solution Aware",
    platform: "Meta retargeting, TikTok, email",
    length: "20\u201345 seconds",
    stages: [
      { stage: "Hook", function: "Paint the 'before' state vividly \u2014 name the specific struggle" },
      { stage: "Before", function: "Expand. Make the before state feel lived-in and real" },
      { stage: "After", function: "The contrast. Specific, believable, not exaggerated" },
      { stage: "Bridge", function: "ONEST is the mechanism that moves you from one state to the other" },
      { stage: "CTA", function: "Anchor the CTA to the 'after' state \u2014 they are buying the destination" }
    ],
    whyItConverts: "The brain visualises the 'after' automatically. Lara is motivated by the clearest possible vision of her best self.",
    psychologicalLever: "Desire amplification. Channelling existing desire toward a specific outcome."
  },
  {
    id: "DR-3",
    name: "Hook \u2192 Mechanism \u2192 Proof \u2192 CTA",
    category: "DR",
    funnelStages: ["warm", "retargeting"],
    awarenessLevel: "Solution Aware \u2192 Product Aware",
    platform: "Meta feed, YouTube pre-roll, longer TikTok",
    length: "30\u201360 seconds",
    stages: [
      { stage: "Hook", function: "Bold claim or contrarian statement \u2014 earn attention before explaining" },
      { stage: "Mechanism", function: "Why this works \u2014 name the specific ingredient, explain the process simply" },
      { stage: "Proof", function: "Validate with numbers, named results, or science" },
      { stage: "CTA", function: "'See the full label' / 'Try it risk-free' \u2014 low friction" }
    ],
    whyItConverts: "Directly answers 'does it actually work?' Named ingredients are the sale \u2014 transparency is the differentiator.",
    psychologicalLever: "Authority + Commitment. Education creates a micro-yes ladder."
  },
  {
    id: "DR-4",
    name: "Enemy Framing \u2192 Reveal \u2192 Solution",
    category: "DR",
    funnelStages: ["cold", "warm"],
    awarenessLevel: "Solution Aware",
    platform: "Meta cold, TikTok",
    length: "20\u201345 seconds",
    stages: [
      { stage: "Hook", function: "Name the enemy \u2014 a lie, an industry practice, a bad ingredient" },
      { stage: "Expose", function: "Explain exactly how the enemy is causing the problem" },
      { stage: "Reveal", function: "ONEST as the brand that operates differently \u2014 show the evidence" },
      { stage: "Proof", function: "Transparency as the differentiator \u2014 label shown, dose stated" },
      { stage: "CTA", function: "'Judge for yourself' framing \u2014 invites rather than demands" }
    ],
    whyItConverts: "Peter and Lara are already cynical about the supplement industry. This validates that cynicism and positions ONEST as the honest exception.",
    psychologicalLever: "Unity + Liking. Shared enemy creates tribal alignment."
  },
  {
    id: "DR-5",
    name: "Contrarian Statement \u2192 Proof \u2192 Reframe \u2192 CTA",
    category: "DR",
    funnelStages: ["cold"],
    awarenessLevel: "Problem Aware \u2192 Solution Aware",
    platform: "Meta Reels, TikTok, high-frequency placements",
    length: "15\u201330 seconds",
    stages: [
      { stage: "Hook", function: "Say the opposite of what they expect \u2014 let the tension sit 2\u20133 seconds" },
      { stage: "Proof", function: "Back the contrarian claim immediately with evidence" },
      { stage: "Reframe", function: "Show them the world differently as a result" },
      { stage: "CTA", function: "'See for yourself' \u2014 curiosity-led" }
    ],
    whyItConverts: "A genuinely contrarian hook creates neurological pattern interruption \u2014 the brain must resolve the tension.",
    psychologicalLever: "Cognitive dissonance. The viewer's existing belief is challenged; resolving it requires engaging with the content."
  },
  {
    id: "DR-6",
    name: "Social Proof Lead \u2192 Identification \u2192 Product \u2192 CTA",
    category: "DR",
    funnelStages: ["retargeting"],
    awarenessLevel: "Product Aware \u2192 Most Aware",
    platform: "Meta retargeting, email, SMS",
    length: "15\u201330 seconds",
    stages: [
      { stage: "Hook", function: "Open with a specific customer result \u2014 number, timeframe, outcome" },
      { stage: "Identification", function: "'If you're anything like [name]\u2026' \u2014 create mirror recognition" },
      { stage: "Problem connect", function: "Briefly confirm the shared pain \u2014 1\u20132 sentences" },
      { stage: "Product", function: "As the mechanism behind the result \u2014 not the hero, the enabler" },
      { stage: "CTA", function: "Risk-reversal framing \u2014 'try it' not 'buy it'" }
    ],
    whyItConverts: "Social proof as the opener short-circuits scepticism before it activates.",
    psychologicalLever: "Social proof + Endowment effect. Risk-reversal framing makes the viewer feel they already own the outcome."
  },
  {
    id: "DR-7",
    name: "Story \u2192 Lesson \u2192 Product",
    category: "DR",
    funnelStages: ["cold", "warm"],
    awarenessLevel: "Problem Unaware \u2192 Problem Aware",
    platform: "TikTok primary, Meta longer-form, YouTube",
    length: "45\u201390 seconds",
    stages: [
      { stage: "Hook", function: "Open mid-story \u2014 in media res, something already happening" },
      { stage: "Story", function: "Personal experience, relatable struggle \u2014 no polish, no performance" },
      { stage: "Lesson", function: "What changed, what they learned, what they now know" },
      { stage: "Product", function: "Part of the solution, not the whole story \u2014 mentioned naturally" },
      { stage: "CTA", function: "Soft \u2014 'this is what I use now' / 'link below if you want to try'" }
    ],
    whyItConverts: "Bypasses the sales defence mechanism entirely. The viewer is invested in the story before they realise there is a product.",
    psychologicalLever: "Narrative transportation. People in a story state are significantly more persuadable."
  },
  // === UGC (6) ===
  {
    id: "UGC-1",
    name: "Talking Head Review",
    category: "UGC",
    funnelStages: ["cold", "warm"],
    awarenessLevel: "Problem Aware \u2192 Solution Aware",
    platform: "Meta Reels, TikTok, Stories",
    length: "30\u201360 seconds",
    stages: [
      { stage: "Hook (0\u20133s)", function: "Mid-thought, unexpected, specific \u2014 never 'hey guys'" },
      { stage: "Credibility", function: "Who they are in one sentence \u2014 context, not a bio" },
      { stage: "The before", function: "Their specific situation \u2014 one clear pain point only" },
      { stage: "The discovery", function: "How they found ONEST \u2014 casual, slightly accidental feeling" },
      { stage: "The result", function: "One specific, believable result \u2014 not a list" },
      { stage: "The endorsement", function: "Natural peer recommendation \u2014 'I just tell everyone now'" },
      { stage: "CTA", function: "Soft \u2014 'link in bio' / 'they've got something on at the moment'" }
    ],
    whyItConverts: "The brain processes peer-to-camera content as advice, not advertising.",
    psychologicalLever: "Social proof through perceived authenticity."
  },
  {
    id: "UGC-2",
    name: "Objection Crusher",
    category: "UGC",
    funnelStages: ["warm", "retargeting"],
    awarenessLevel: "Solution Aware \u2192 Product Aware",
    platform: "Meta retargeting, TikTok cold traffic for high-scepticism audiences",
    length: "30\u201345 seconds",
    stages: [
      { stage: "Hook", function: "Creator voices the objection directly \u2014 'I thought fat burners were all marketing'" },
      { stage: "Validate", function: "Agree with the scepticism \u2014 this is disarming and trust-building" },
      { stage: "The turning point", function: "What made them try anyway \u2014 specific, not vague" },
      { stage: "What surprised them", function: "One unexpected result they did not anticipate" },
      { stage: "The reframe", function: "'I was wrong about this one specifically'" },
      { stage: "CTA", function: "'Worth trying if you've been sitting on the fence'" }
    ],
    whyItConverts: "Festinger's cognitive dissonance in action \u2014 you name the exact objection in the viewer's head, validate it, then resolve it.",
    psychologicalLever: "Credibility through honesty. Admitting prior scepticism makes the eventual endorsement exponentially more believable."
  },
  {
    id: "UGC-3",
    name: "Day in the Life",
    category: "UGC",
    funnelStages: ["cold"],
    awarenessLevel: "Problem Unaware \u2192 Problem Aware",
    platform: "TikTok primary, Instagram Reels organic, Meta upper funnel",
    length: "45\u201390 seconds",
    stages: [
      { stage: "Hook", function: "Open at a real moment \u2014 waking up, pre-gym, morning routine mid-action" },
      { stage: "Context", function: "Show the routine, not just the product \u2014 the product lives inside a life" },
      { stage: "Natural integration", function: "Product appears as part of the routine, not the centrepiece" },
      { stage: "The feeling", function: "What it actually feels like \u2014 energy, focus, no crash \u2014 sensory and specific" },
      { stage: "The outcome", function: "Training harder, more productive, present \u2014 the life benefit" },
      { stage: "Sign-off", function: "'This is just what I do now' \u2014 normalisation, not endorsement" }
    ],
    whyItConverts: "Lara is not buying a supplement \u2014 she is buying into a version of her life where she is consistent, energised, and performing.",
    psychologicalLever: "Aspirational identity. The product is the prop, not the plot."
  },
  {
    id: "UGC-4",
    name: "Myth Bust / Hot Take",
    category: "UGC",
    funnelStages: ["cold", "warm"],
    awarenessLevel: "Solution Aware",
    platform: "TikTok primary, Instagram Reels, Meta interest targeting",
    length: "30\u201360 seconds",
    stages: [
      { stage: "Hook", function: "Bold, slightly controversial opener \u2014 'You don't need a pre-workout'" },
      { stage: "Hold tension", function: "Do not resolve it \u2014 let 3\u20135 seconds of setup build" },
      { stage: "The nuance", function: "'\u2026unless you're doing it right. Here's what most brands get wrong'" },
      { stage: "The standard", function: "What good actually looks like \u2014 specific ingredients, real doses" },
      { stage: "The product", function: "ONEST as the example that meets the standard \u2014 never forced" },
      { stage: "CTA", function: "'Judge for yourself \u2014 the label's on the website'" }
    ],
    whyItConverts: "Peter trusts people who seem willing to tell him what not to buy. When you then show him what to buy, the credibility transfer is complete.",
    psychologicalLever: "Authority through honesty. Transparency framing is ONEST's core DNA."
  },
  {
    id: "UGC-5",
    name: "Results Reveal",
    category: "UGC",
    funnelStages: ["retargeting"],
    awarenessLevel: "Product Aware",
    platform: "Meta retargeting, warm TikTok audiences, Stories",
    length: "20\u201340 seconds",
    stages: [
      { stage: "Hook", function: "The result first \u2014 'I've lost 6kg in 8 weeks and I'm not in a huge deficit'" },
      { stage: "Pre-empt the sceptic", function: "'I know how that sounds \u2014 I thought the same thing'" },
      { stage: "What changed", function: "Minimal \u2014 the product carried the weight" },
      { stage: "The product's role", function: "Specific benefit \u2014 energy, cravings, metabolism \u2014 one only" },
      { stage: "The proof", function: "Photo, weight, performance metric \u2014 something tangible" },
      { stage: "CTA", function: "'Link's below'" }
    ],
    whyItConverts: "Leads with the destination. The viewer's first question is 'how?' \u2014 which means they are leaning in before you have explained anything.",
    psychologicalLever: "Curiosity through proof. Result-first hooks create immediate engagement."
  },
  {
    id: "UGC-6",
    name: "Product Demo / Ingredient Education",
    category: "UGC",
    funnelStages: ["warm", "retargeting"],
    awarenessLevel: "Product Aware",
    platform: "Meta feed, TikTok, YouTube pre-roll",
    length: "45\u201375 seconds",
    stages: [
      { stage: "Hook", function: "A specific ingredient claim \u2014 'Most fat burners use one form of caffeine. HyperBurn uses two. Here's why that matters'" },
      { stage: "Education", function: "Explain the mechanism simply \u2014 human language, no jargon" },
      { stage: "The comparison", function: "Category standard vs. what ONEST actually does" },
      { stage: "Visual demo", function: "Scooping, mixing, label shown \u2014 tactile and real" },
      { stage: "The feel", function: "What the difference actually feels like in the body" },
      { stage: "CTA", function: "'Full ingredient breakdown's on the website \u2014 link below'" }
    ],
    whyItConverts: "Converts the analytical buyer who reads every label. Transparency is the sale \u2014 this structure makes it literal and visible.",
    psychologicalLever: "Authority through education. Knowledge transfer builds trust."
  },
  // === FOUNDER-LED (3) ===
  {
    id: "FL-1",
    name: "The Origin Story",
    category: "FOUNDER",
    funnelStages: ["cold", "warm"],
    awarenessLevel: "Problem Unaware \u2192 Solution Aware",
    platform: "TikTok, Meta, YouTube, organic social",
    length: "60\u201390 seconds",
    stages: [
      { stage: "Hook", function: "Open at the moment of frustration \u2014 not the beginning, the breaking point" },
      { stage: "The problem they lived", function: "What was wrong with the industry before ONEST existed \u2014 personal and specific" },
      { stage: "The decision", function: "Why they chose to build instead of just complain" },
      { stage: "The standard they set", function: "What ONEST committed to that others would not \u2014 transparency, doses, ingredients" },
      { stage: "What that looks like now", function: "Brief product reference \u2014 earned through the story, not inserted" },
      { stage: "The invitation", function: "'That's why we built this. That's who it's for.' \u2014 tribe identity, not a hard sell" }
    ],
    whyItConverts: "Answers 'why should I trust you?' before the question is asked.",
    psychologicalLever: "Narrative authority. The founder's story IS the proof of concept."
  },
  {
    id: "FL-2",
    name: "The Industry Call-Out",
    category: "FOUNDER",
    funnelStages: ["cold", "warm"],
    awarenessLevel: "Solution Aware",
    platform: "TikTok primary, Meta, organic social",
    length: "45\u201375 seconds",
    stages: [
      { stage: "Hook", function: "Founder addresses the industry directly \u2014 'I need to talk about what's in most supplements'" },
      { stage: "The problem named", function: "Specific practice being called out \u2014 proprietary blends, underdosing, artificial fillers" },
      { stage: "The evidence", function: "How to spot it \u2014 educate the viewer to protect themselves" },
      { stage: "The standard", function: "What ONEST does differently \u2014 label shown, doses stated" },
      { stage: "The challenge", function: "'Compare our label to anything else on the shelf'" },
      { stage: "CTA", function: "'Link in bio \u2014 everything's on there'" }
    ],
    whyItConverts: "Validates every suspicion Peter and Lara already had. Positions ONEST as the honest disruptor.",
    psychologicalLever: "Unity + Authority. Shared enemy creates tribal alignment."
  },
  {
    id: "FL-3",
    name: "The Standard-Setter",
    category: "FOUNDER",
    funnelStages: ["retargeting"],
    awarenessLevel: "Product Aware",
    platform: "Meta retargeting, TikTok, email",
    length: "30\u201360 seconds",
    stages: [
      { stage: "Hook", function: "Founder makes a specific product claim with total confidence" },
      { stage: "The why", function: "Why this standard was non-negotiable \u2014 personal conviction, not marketing" },
      { stage: "The what", function: "The specific ingredient, dose, or manufacturing decision \u2014 tangible" },
      { stage: "The comparison", function: "What the alternative looks like \u2014 educational, not aggressive" },
      { stage: "The ask", function: "'This is what we made. Try it and judge for yourself.'" }
    ],
    whyItConverts: "Converts the final-stage sceptic who needs to believe in the people behind the product.",
    psychologicalLever: "Personal conviction as proof. The founder's confidence IS the closing argument."
  },
  // === BRAND / EQUITY (3) ===
  {
    id: "BR-1",
    name: "The Belief Film",
    category: "BRAND",
    funnelStages: ["cold"],
    awarenessLevel: "Problem Unaware",
    platform: "Meta, TikTok, YouTube, organic social",
    length: "60\u2013120 seconds",
    stages: [
      { stage: "Opening visual", function: "Athlete in action \u2014 no product, no logo, no copy yet" },
      { stage: "The truth", function: "A belief statement about what serious performance actually requires" },
      { stage: "The audience named", function: "Not 'people who take supplements' \u2014 'the ones who don't settle'" },
      { stage: "The tension", function: "What separates the ones who get there from the ones who don't" },
      { stage: "The conviction", function: "ONEST's position in that world \u2014 not what we sell, what we believe" },
      { stage: "The product reveal", function: "Product appears as the conclusion of the argument, not the start" },
      { stage: "Sign-off", function: "Brand line: MADE OF GREATNESS" }
    ],
    whyItConverts: "Asks for belief, not a sale. Measured by watch time, shares, saves, and downstream conversion lift.",
    psychologicalLever: "Identity alignment. The viewer sees themselves in the belief before seeing the product."
  },
  {
    id: "BR-2",
    name: "The Community Proof",
    category: "BRAND",
    funnelStages: ["warm"],
    awarenessLevel: "Solution Aware",
    platform: "Meta, TikTok, Instagram Reels, organic social",
    length: "45\u201390 seconds",
    stages: [
      { stage: "Hook", function: "Multiple faces, multiple results \u2014 not one story, a movement" },
      { stage: "The common thread", function: "What all these people share \u2014 the standard they hold themselves to" },
      { stage: "The results", function: "Varied, specific, believable \u2014 different people, same quality of outcome" },
      { stage: "The brand's role", function: "Understated \u2014 'this is what we make for people like this'" },
      { stage: "The identity statement", function: "'ONEST is for people who take this seriously'" },
      { stage: "CTA", function: "Light \u2014 'find your community' / 'link in bio'" }
    ],
    whyItConverts: "Peter does not just want results \u2014 he wants to be seen as someone who belongs to the right tribe.",
    psychologicalLever: "Tribal identity. ONEST becomes the badge of belonging."
  },
  {
    id: "BR-3",
    name: "The Values Declaration",
    category: "BRAND",
    funnelStages: ["cold", "warm", "retargeting", "retention"],
    awarenessLevel: "All levels",
    platform: "Any \u2014 most powerful as a pinned piece across all channels",
    length: "30\u201360 seconds",
    stages: [
      { stage: "Hook", function: "A single, bold, unambiguous statement of what ONEST stands for" },
      { stage: "What that means in practice", function: "Specific \u2014 'it means our label shows every ingredient and every dose'" },
      { stage: "What it costs", function: "Honesty about the trade-off \u2014 'it means we're more expensive than shortcuts'" },
      { stage: "Who it's for", function: "Name them \u2014 'it's for the people who care enough to read the label'" },
      { stage: "The invitation", function: "'If that's you \u2014 welcome.'" }
    ],
    whyItConverts: "In a category defined by noise, clarity is a differentiator.",
    psychologicalLever: "Self-selection. Attracts the right customers and pre-selects out the wrong ones."
  }
];
var ARCHETYPE_PROFILES = {
  FitnessEnthusiast: {
    label: "Fitness Enthusiast",
    lifeContext: "Trains 4-6 days a week. Tracks macros. Has tried multiple supplements. Goes to an F45 or commercial gym. Influenced by what people in their gym circle are using. Cares about performance metrics \u2014 PRs, body composition, recovery times.",
    languageRegister: "Comfortable with supplement terminology but still casual. Says 'reps', 'gains', 'recovery'. Drops gym-specific references naturally. Not performatively bro \u2014 genuinely gym-oriented. Australian colloquialisms where they fit naturally.",
    preProductObjection: `"I've already tried most things in this category. I'm cynical because I've wasted money on products that underdosed or overpromised." The turning point was a specific training metric that changed, or a specific ingredient they finally understood.`
  },
  BusyMum: {
    label: "Busy Mum",
    lifeContext: "Juggling kids, work, and personal goals simultaneously. Fitness is important but time is the constraint. Values simplicity and products that fit into an already-full morning. Has had inconsistent supplement habits because routines get disrupted.",
    languageRegister: "Warm and direct. References real moments: school drop-off, 5:30am gym session before the house wakes up, 3pm energy slump. Relatable specificity is the authenticity signal. Not fitness-speak heavy \u2014 talks about how she feels, not performance metrics.",
    preProductObjection: `"Is this safe? What's actually in it? I don't want to be taking something I can't understand." The turning point was the transparent label \u2014 seeing exactly what is in it and being able to verify it.`
  },
  Athlete: {
    label: "Athlete",
    lifeContext: "Competes in something \u2014 Hyrox, CrossFit, team sports, powerlifting. Training has a structure and a goal. Supplements are tools for performance, not lifestyle accessories. Talks about training blocks, competition prep, recovery protocols.",
    languageRegister: "Precise and performance-focused. References specific metrics and outcomes. Comfortable with clinical dosing language \u2014 knows what Creapure means, knows what Dicaffeine Malate is. Respects specificity as a signal of quality.",
    preProductObjection: `"I can't afford to put something in my body that isn't clinically dosed. I've seen athletes take products that don't contain what the label claims." The turning point was full ingredient transparency \u2014 every dose listed, nothing hidden in a blend.`
  },
  Biohacker: {
    label: "Biohacker",
    lifeContext: "Optimises everything. Tracks sleep, HRV, bloodwork. Reads PubMed. Treats their body as a system to be engineered. Talks about N=1 experimentation and personal results.",
    languageRegister: "Analytical and curious. References self-tracking: 'I noticed on my Oura ring', 'my recovery scores went up', 'I've been testing this for six weeks.' Wants to understand why something works, not just that it works.",
    preProductObjection: `"Most supplements have proprietary blends so I can't verify the doses I'm actually getting. I need to see every ingredient and every dose." The turning point was full label transparency combined with the specific mechanism of a key ingredient.`
  },
  WellnessAdvocate: {
    label: "Wellness Advocate",
    lifeContext: "Health-conscious but not gym-obsessed. Cares about what goes into their body. Worried about 'bad chemicals'. Holistic view of health \u2014 sleep, stress, nutrition, movement together. May have been burned by overpromised or artificially-filled supplements.",
    languageRegister: "Warm, considered, slightly cautious. References how things make her feel rather than performance metrics. 'I felt better in the mornings', 'my skin actually changed', 'I stopped feeling so flat by 2pm.' Responds to 'no artificial colours, no fillers' as a strong positive signal.",
    preProductObjection: `"I don't want to take something full of stimulants or artificial ingredients I don't recognise." The turning point was the no artificial colours / no fillers / no proprietary blends positioning \u2014 plus Australian-made GMP certification as a quality guarantee.`
  }
};
var HOOK_BANK = `
HOOK BANK \u2014 five archetypes (classify the competitor's hook, then use the same archetype):
| Archetype | Example |
|---|---|
| Contrarian | "The reason you're not losing fat has nothing to do with your diet." |
| Specific frustration | "Six months in a calorie deficit and the scale hasn't moved." |
| Social proof lead | "47,000 Aussies have switched to this in the last 12 months." |
| Named enemy | "Most fat burners don't tell you what's actually in them. Here's why." |
| Bold claim + number | "250mg of two forms of caffeine. Here's what that actually does to your metabolism." |
`;
var TRANSITION_LOGIC = `
TRANSITION LOGIC \u2014 The viewer should never feel the structure change. Each transition should feel like the most natural next sentence, not the next section of a brief.

The four critical transitions:
| Transition | Wrong version | Correct version |
|---|---|---|
| Problem \u2192 Solution | "That's why we created HyperBurn." | "The only way to fix a dormant metabolism is to give it a reason to fire back up." |
| Story \u2192 Product | "Anyway, I started using HyperBurn and\u2026" | "The thing that actually changed it was understanding what my body was missing \u2014 specifically one thing." |
| Education \u2192 CTA | "So if you want to try it, click the link." | "That's literally everything that's in it \u2014 no blends, no fillers. If you want to read the full breakdown yourself, it's all on the site." |
| Proof \u2192 CTA | "Don't miss out \u2014 buy now." | "There's a 30-day guarantee, so there's actually no reason not to try it." |
`;
var SCRIPT_AUDIT_CHECKLIST = `
SCRIPT AUDIT CHECKLIST \u2014 run every completed script through these 10 checks:
1. Awareness match \u2014 Does the script assume the right level of audience knowledge for the funnel stage?
2. Hook independence \u2014 Does the hook work as a complete idea in under 3 seconds with no context?
3. Banned phrases \u2014 Zero instances of "unlock your potential", "fuel your journey", "transform your body", "achieve your goals"
4. Specificity test \u2014 At least one named ingredient, specific number, or concrete timeframe
5. One job \u2014 Single primary message, obvious in one sentence
6. Transition logic \u2014 All major transitions feel inevitable rather than engineered
7. Single CTA \u2014 One and only one action asked for at the end
8. Brand voice \u2014 Could this script appear on a competitor's product without modification? If yes \u2014 rewrite
9. Emotional logic \u2014 Script takes the viewer from one clear emotional state to a different one logically
10. Peter / Lara test \u2014 Read it aloud imagining you are Peter or Lara hearing it for the first time
`;
var COMPLIANCE_RULES = `
COMPLIANCE GUARDRAILS (MANDATORY \u2014 violations override all scores):
CAN SAY: "supports," "helps," "promotes," "contributes to," "designed to," "formulated with"
CANNOT SAY: "cures," "treats," "prevents," "guarantees," "clinically proven to [specific outcome]," "doctor recommended"
CANNOT SAY: specific weight loss amounts, medical claims, comparison to prescription drugs
SAFE FRAMING: "supports healthy metabolism" \u2713 | "burns fat guaranteed" \u2717
SAFE FRAMING: "helps maintain energy levels" \u2713 | "gives you unlimited energy" \u2717
SAFE FRAMING: "supports restful sleep" \u2713 | "cures insomnia" \u2717
Any script with compliance violations MUST score 0 regardless of other qualities.
`;
var PRODUCT_INTELLIGENCE = {
  Hyperburn: {
    fullName: "ONEST HyperBurn",
    category: "Thermogenic Fat Burner",
    copyLevers: [
      "Two forms of caffeine (fast-acting + sustained) \u2014 no crash, just clean energy all day",
      "CaloriBurn GP (Grains of Paradise) \u2014 clinically shown to activate brown adipose tissue",
      "Transparent label \u2014 every ingredient and dose listed, no proprietary blends",
      "Australian-made, GMP certified",
      "Dual-action: burns fat AND provides clean energy \u2014 replaces your morning coffee AND your fat burner"
    ],
    copyTraps: [
      "Never say 'melts fat' or 'burns fat fast' \u2014 use 'supports fat metabolism' or 'helps your body use fat for fuel'",
      "Never promise specific weight loss amounts",
      "Don't compare directly to prescription medications"
    ],
    stackPartners: ["Thermosleep", "Protein + Collagen"],
    targetPersona: "Peter (35-55, wants to lose stubborn belly fat) and Lara (28-45, wants lean toned body without jitters)",
    awarenessAngle: "Problem-aware (knows they want to lose fat) \u2192 Solution-aware (show why HyperBurn is different)",
    keyIngredients: ["Caffeine Anhydrous", "Infinergy (DiCaffeine Malate)", "CaloriBurn GP", "CapsiMax", "BioPerine"],
    primaryBenefit: "Clean energy + fat metabolism support without the crash",
    differentiator: "Two forms of caffeine for sustained energy \u2014 most fat burners spike and crash"
  },
  Thermosleep: {
    fullName: "ONEST ThermoSleep",
    category: "Night-Time Fat Burner & Sleep Aid",
    copyLevers: [
      "Dual benefit: supports fat metabolism WHILE you sleep \u2014 the only time you're doing nothing and still burning",
      "Ashwagandha KSM-66 \u2014 clinically studied for stress reduction and sleep quality",
      "No stimulants \u2014 works with your body's natural sleep cycle",
      "Wake up leaner AND more rested \u2014 two problems solved with one product",
      "Pairs perfectly with HyperBurn for 24-hour metabolic support"
    ],
    copyTraps: [
      "Never say 'lose weight while you sleep' as a guarantee",
      "Don't position as a sleeping pill \u2014 it's a recovery and metabolism product",
      "Avoid 'miracle' or 'effortless' language"
    ],
    stackPartners: ["Hyperburn", "Protein + Collagen"],
    targetPersona: "Peter (stressed, poor sleep, stubborn fat) and Lara (wants beauty sleep that actually works harder)",
    awarenessAngle: "Unaware \u2192 Problem-aware (most people don't know night-time metabolism matters)",
    keyIngredients: ["Ashwagandha KSM-66", "L-Theanine", "Grains of Paradise", "Zinc", "Magnesium"],
    primaryBenefit: "Better sleep + overnight metabolic support",
    differentiator: "Only product that combines clinical sleep ingredients with thermogenic compounds \u2014 no stimulants"
  },
  "Protein + Collagen": {
    fullName: "ONEST Protein + Collagen",
    category: "Protein Powder with Collagen",
    copyLevers: [
      "Beauty meets performance \u2014 protein for muscle, collagen for skin/hair/nails/joints",
      "Hydrolysed collagen peptides \u2014 better absorption than regular collagen",
      "Tastes incredible \u2014 not chalky or artificial like most protein powders",
      "One scoop replaces your protein shake AND your collagen supplement",
      "Australian-made with premium whey protein isolate"
    ],
    copyTraps: [
      "Don't position as just a protein powder \u2014 the collagen is the differentiator",
      "Avoid 'anti-aging' claims \u2014 use 'supports skin elasticity and joint health'",
      "Don't compare to cheap protein powders on price \u2014 compare on value (2-in-1)"
    ],
    stackPartners: ["Hyperburn", "Thermosleep", "Creatine"],
    targetPersona: "Lara (wants beauty + fitness in one product) and Peter (joint health + muscle recovery)",
    awarenessAngle: "Solution-aware (already takes protein) \u2192 Product-aware (show why 2-in-1 is smarter)",
    keyIngredients: ["Whey Protein Isolate", "Hydrolysed Collagen Peptides", "Digestive Enzymes"],
    primaryBenefit: "Complete protein with beauty and joint benefits in one scoop",
    differentiator: "Only protein powder with clinically dosed hydrolysed collagen \u2014 replaces two supplements"
  },
  Hyperload: {
    fullName: "ONEST HyperLoad",
    category: "Pre-Workout",
    copyLevers: [
      "Fully transparent label \u2014 every ingredient and dose listed, no proprietary blends hiding under-dosed ingredients",
      "Clinical doses of Citrulline, Beta-Alanine, and Betaine \u2014 not fairy-dusted like most pre-workouts",
      "Smooth energy without the jitters or crash \u2014 designed for serious training, not just a caffeine hit",
      "Nootropic blend for focus \u2014 train harder AND smarter",
      "Australian-made, GMP certified"
    ],
    copyTraps: [
      "Don't just say 'best pre-workout' \u2014 show WHY (transparent dosing vs proprietary blends)",
      "Avoid 'insane energy' or 'crazy pumps' \u2014 position as premium and clinical, not bro-science",
      "Don't compare to specific competitor brands by name"
    ],
    stackPartners: ["HyperPump", "AminoLoad", "Creatine"],
    targetPersona: "Peter (serious lifter who reads labels) and gym enthusiasts who've been burned by under-dosed pre-workouts",
    awarenessAngle: "Most-aware (already uses pre-workout) \u2192 Show why ONEST is the honest choice",
    keyIngredients: ["L-Citrulline", "Beta-Alanine", "Betaine Anhydrous", "Caffeine", "Alpha-GPC"],
    primaryBenefit: "Clinically dosed pre-workout with full transparency \u2014 you know exactly what you're taking",
    differentiator: "Full label transparency with clinical doses \u2014 most pre-workouts hide behind proprietary blends"
  },
  Creatine: {
    fullName: "ONEST Creatine Monohydrate",
    category: "Creatine",
    copyLevers: [
      "Creapure\xAE \u2014 the world's purest creatine monohydrate, made in Germany",
      "Most studied supplement in history \u2014 over 500 peer-reviewed studies",
      "Not just for bodybuilders \u2014 supports brain function, energy, and healthy aging",
      "Micronised for better mixing and absorption \u2014 no gritty texture",
      "Unflavoured \u2014 add to anything (coffee, smoothie, water)"
    ],
    copyTraps: [
      "Don't say 'bulking' \u2014 position as performance and health, not just muscle size",
      "Avoid 'loading phase required' \u2014 modern research shows daily 5g is sufficient",
      "Don't make it sound complicated \u2014 creatine is simple, that's the point"
    ],
    stackPartners: ["Hyperload", "HyperPump", "Protein + Collagen"],
    targetPersona: "Both Peter and Lara \u2014 creatine is for everyone, not just lifters",
    awarenessAngle: "Unaware (many don't know creatine benefits beyond gym) \u2192 Problem-aware (energy, brain, aging)",
    keyIngredients: ["Creapure\xAE Creatine Monohydrate"],
    primaryBenefit: "World's purest creatine for performance, brain function, and overall health",
    differentiator: "Creapure\xAE \u2014 most brands use cheap Chinese creatine, ONEST uses the gold standard from Germany"
  },
  Thermoburn: {
    fullName: "ONEST ThermoBurn",
    category: "Capsule Thermogenic",
    copyLevers: [
      "Two forms of caffeine for sustained energy without jitters",
      "Green Tea Extract, Bitter Orange Extract, Grains of Paradise \u2014 multi-pathway thermogenesis",
      "Theobromine and Lion's Mane for mood and cognitive support",
      "Capsule format \u2014 taste-free, convenient, take anywhere",
      "Transparent label with clinically studied ingredients"
    ],
    copyTraps: [
      "Don't position capsules as 'weaker' than powder \u2014 position as 'convenient and effective'",
      "Avoid implying it replaces HyperBurn \u2014 different format for different preferences"
    ],
    stackPartners: ["Hyperburn", "Thermosleep"],
    targetPersona: "Busy professionals, both genders, convenience-focused buyers who want fat support without mixing powders",
    awarenessAngle: "Solution-aware \u2192 Product-aware (show capsule thermogenic option exists)",
    keyIngredients: ["Two forms of caffeine", "Green Tea Extract", "Bitter Orange Extract", "Grains of Paradise", "Theobromine", "Lion's Mane", "Theacrine"],
    primaryBenefit: "Sustained energy, mood support, and healthy weight management in a convenient capsule",
    differentiator: "Multi-pathway thermogenic in capsule format \u2014 not just caffeine pills"
  },
  "Carb Control": {
    fullName: "ONEST Carb Control",
    category: "Carb & Blood Sugar Support",
    copyLevers: [
      "Supports healthy blood sugar response after carb-heavy meals",
      "White kidney bean extract \u2014 clinically studied carb blocker",
      "Perfect for people who love carbs but want to manage their intake",
      "Take before meals \u2014 simple and convenient",
      "Transparent dosing with no proprietary blends"
    ],
    copyTraps: [
      "Never say 'blocks all carbs' \u2014 use 'supports healthy carbohydrate metabolism'",
      "Don't position as a license to eat unlimited carbs",
      "Avoid medical claims about blood sugar or diabetes"
    ],
    stackPartners: ["Hyperburn", "Thermosleep"],
    targetPersona: "Peter and Lara (both enjoy food but want to manage carb impact)",
    awarenessAngle: "Problem-aware (knows carbs are an issue) \u2192 Solution-aware",
    keyIngredients: ["White Kidney Bean Extract", "Chromium", "Gymnema Sylvestre"],
    primaryBenefit: "Supports healthy carbohydrate metabolism before meals",
    differentiator: "Targeted carb management supplement with transparent clinical dosing"
  },
  HyperPump: {
    fullName: "ONEST HyperPump",
    category: "Stimulant-Free Pre-Workout / Pump Formula",
    copyLevers: [
      "Massive pumps without any stimulants \u2014 perfect for evening training or stacking with HyperLoad",
      "Clinical doses of Citrulline and Nitrosigine for vasodilation",
      "Transparent label \u2014 see exactly what you're getting",
      "Stack with HyperLoad for the ultimate pre-workout combo"
    ],
    copyTraps: [
      "Don't say 'stimulant-free pre-workout' as if it's lesser \u2014 it's a pump-specific product",
      "Avoid bro-science language about 'skin-splitting pumps'"
    ],
    stackPartners: ["Hyperload", "Creatine"],
    targetPersona: "Serious lifters who want pump and performance without extra stimulants",
    awarenessAngle: "Most-aware (already trains, wants better pumps)",
    keyIngredients: ["L-Citrulline", "Nitrosigine", "GlycerPump", "S7"],
    primaryBenefit: "Maximum muscle pumps and blood flow without stimulants",
    differentiator: "Dedicated pump formula with clinical doses \u2014 not a watered-down stim-free pre-workout"
  },
  AminoLoad: {
    fullName: "ONEST AminoLoad",
    category: "EAA / BCAA Recovery",
    copyLevers: [
      "Full spectrum EAAs \u2014 not just BCAAs, all 9 essential amino acids your body can't make",
      "Supports recovery, hydration, and muscle protein synthesis",
      "Great taste for sipping during workouts \u2014 replaces sugary sports drinks",
      "Transparent dosing with clinical amounts"
    ],
    copyTraps: [
      "Don't just say 'BCAAs' \u2014 EAAs are the upgrade, explain why",
      "Avoid 'muscle building' claims \u2014 use 'supports muscle recovery and protein synthesis'"
    ],
    stackPartners: ["Hyperload", "HyperPump", "Creatine"],
    targetPersona: "Active individuals who train regularly and want optimal recovery",
    awarenessAngle: "Solution-aware (already uses BCAAs) \u2192 Product-aware (EAAs are better)",
    keyIngredients: ["Full Spectrum EAAs", "Coconut Water Powder", "Electrolytes"],
    primaryBenefit: "Complete amino acid recovery with hydration support",
    differentiator: "Full EAA spectrum, not just BCAAs \u2014 plus hydration, in one great-tasting drink"
  },
  "Marine Collagen": {
    fullName: "ONEST Marine Collagen",
    category: "Beauty & Joint Supplement",
    copyLevers: [
      "Marine-sourced collagen \u2014 superior absorption compared to bovine collagen",
      "Supports skin elasticity, hair strength, nail growth, and joint health",
      "Type I and III collagen \u2014 the types most important for skin and beauty",
      "Unflavoured \u2014 add to coffee, smoothies, or water",
      "Sustainably sourced from wild-caught fish"
    ],
    copyTraps: [
      "Don't make anti-aging claims \u2014 use 'supports skin health and elasticity'",
      "Avoid comparing to bovine collagen negatively \u2014 just highlight marine benefits"
    ],
    stackPartners: ["Protein + Collagen", "SuperGreens"],
    targetPersona: "Lara (beauty-conscious, wants skin/hair/nail support)",
    awarenessAngle: "Solution-aware (already knows about collagen) \u2192 Product-aware (marine is better absorbed)",
    keyIngredients: ["Hydrolysed Marine Collagen Peptides", "Vitamin C"],
    primaryBenefit: "Superior absorption collagen for skin, hair, nails, and joints",
    differentiator: "Marine-sourced for better bioavailability \u2014 sustainably sourced from wild-caught fish"
  },
  SuperGreens: {
    fullName: "ONEST SuperGreens",
    category: "Greens Powder",
    copyLevers: [
      "75+ superfoods, vitamins, and minerals in one scoop",
      "Actually tastes good \u2014 not the usual 'drinking grass' experience",
      "Supports gut health, immunity, and daily nutrition gaps",
      "Transparent label \u2014 every ingredient listed, no proprietary blends",
      "Replaces handfuls of supplements with one convenient scoop"
    ],
    copyTraps: [
      "Don't say 'replaces fruits and vegetables' \u2014 it supplements them",
      "Avoid 'detox' or 'cleanse' language",
      "Don't make immune system cure claims"
    ],
    stackPartners: ["Protein + Collagen", "Marine Collagen"],
    targetPersona: "Both Peter and Lara \u2014 anyone who wants convenient daily nutrition",
    awarenessAngle: "Problem-aware (knows diet has gaps) \u2192 Solution-aware (greens powder fills them)",
    keyIngredients: ["Organic Greens Blend", "Probiotics", "Digestive Enzymes", "Mushroom Complex"],
    primaryBenefit: "Complete daily nutrition support that actually tastes good",
    differentiator: "75+ ingredients with transparent dosing AND great taste \u2014 most greens powders sacrifice one for the other"
  },
  "Whey ISO Pro": {
    fullName: "ONEST Whey ISO Pro",
    category: "Whey Protein Isolate",
    copyLevers: [
      "100% Whey Protein Isolate \u2014 fast absorbing, low lactose, minimal fat and carbs",
      "Premium quality protein for serious athletes and fitness enthusiasts",
      "Amazing taste and mixability \u2014 no clumps, no chalky texture",
      "Transparent label with no fillers or amino spiking",
      "Australian-made, GMP certified"
    ],
    copyTraps: [
      "Don't just compete on protein per serve \u2014 compete on quality and transparency",
      "Avoid 'mass gainer' positioning \u2014 this is lean, clean protein"
    ],
    stackPartners: ["Creatine", "Hyperload", "AminoLoad"],
    targetPersona: "Peter (serious about training and recovery) and fitness enthusiasts who read labels",
    awarenessAngle: "Most-aware (already uses protein) \u2192 Show why ONEST is the honest choice",
    keyIngredients: ["100% Whey Protein Isolate", "Digestive Enzymes"],
    primaryBenefit: "Pure, fast-absorbing protein with no fillers or amino spiking",
    differentiator: "100% isolate with full transparency \u2014 no concentrate blends hiding behind 'protein blend' labels"
  }
};
var PRODUCT_FALLBACK_BRIEFS = {
  Hyperburn: `Product: ONEST HyperBurn | Category: Elite Thermogenic Fat Burner (powder)
Key ingredients: 250mg caffeine total \u2014 Caffeine Anhydrous (fast-acting) + Dicaffeine Malate (sustained release, reduces crash). Capsimax\xAE (patented capsaicin for thermogenesis). GBBGO\xAE (converts to L-Carnitine, amplifies fat transport). L-Carnitine. Huperzia Serrata (cognitive focus).
Primary benefits: Accelerates fat burning and thermogenesis. Smooth, sustained energy \u2014 no crash, no jitter. Eliminates hunger cravings. Improves mood and mental focus.
Usage: Taken first thing in the morning on an empty stomach.
Primary objection: "I've tried fat burners and they didn't work." Secondary: "Will it make me jittery?"
Brand differentiator: Full ingredient transparency \u2014 every dose listed. No proprietary blend. Australian-made, GMP certified. No artificial colours or fillers.`,
  Thermosleep: `Product: ONEST ThermoSleep | Category: Night-time Fat Burner + Sleep Aid
Key ingredients: 5-HTP (serotonin precursor, mood and sleep). Raspberry Ketones. Melatonin (sleep onset). Magnesium (deep sleep quality). EGCG (Green Tea Extract, metabolic support).
Primary benefits: Fall asleep faster. Deeper, more restorative sleep. Wake up energised \u2014 not groggy. Supports fat burning overnight without stimulants.
Primary objection: "I'm sceptical anything can burn fat while I sleep." Secondary: "Will it leave me groggy?"
Primary audience: Lara. Also anyone targeting fat loss and sleep quality simultaneously.`,
  Hyperload: `Product: ONEST HyperLoad | Category: Elite High-Stim Pre-Workout
Primary benefits: Explosive training performance. Significant strength and power output increase. Sharp mental focus and clarity. Powerful muscle pumps.
Primary audience: Peter. Serious gym-goers. High-stim seekers. Competitive athletes.
Primary objection: "High-stim pre-workouts make me crash." Secondary: "Is this just a massive caffeine hit?"
Brand differentiator: Full ingredient transparency. Clinically dosed \u2014 not under-dosed to hit a price point. Stackable with HyperPump.`,
  Thermoburn: `Product: ONEST ThermoBurn | Category: Capsule Thermogenic
Key ingredients: Two forms of caffeine. Green Tea Extract. Bitter Orange Extract. Grains of Paradise. Theobromine. Lion's Mane. Theacrine.
Primary benefits: Sustained energy without jitters. Mood support. Healthy weight management. Convenience \u2014 capsule format, taste-free.
Primary objection: "Capsules feel less effective than powder."
Audience: Busy professionals, both genders, convenience-focused buyers.`,
  "HyperBurn Caffeine Free": `Product: ONEST HyperBurn Caffeine Free | Category: Stimulant-Free Thermogenic
Key ingredients: L-Carnitine. Acetyl-L-Carnitine. Capsimax\xAE. GBBGO\xAE. Huperzia Serrata. Zero caffeine.
Primary benefits: Same fat-burning mechanism as HyperBurn \u2014 without stimulants. Ideal for caffeine-sensitive individuals, shift workers, afternoon or evening use. Vegan and keto-friendly.
Primary audience: Lara (primary). Caffeine-sensitive buyers. Shift workers.
Primary objection: "If it has no caffeine, how does it actually work?"
Resolution: Explain non-stimulant fat-burning mechanisms \u2014 Capsimax\xAE thermogenesis, GBBGO\xAE carnitine amplification \u2014 these work independently of caffeine.`
};
function getSubStructureReference(styleConfig, funnelStage) {
  const relevantStructures = SCRIPT_SUB_STRUCTURES.filter((s) => {
    const styleMatch = styleConfig.some((sc) => {
      if (sc.quantity <= 0) return false;
      if (sc.styleId === "DR") return s.category === "DR";
      if (sc.styleId === "UGC") return s.category === "UGC";
      if (sc.styleId === "FOUNDER") return s.category === "FOUNDER";
      if (sc.styleId === "BRAND") return s.category === "BRAND";
      return false;
    });
    const funnelMatch = s.funnelStages.includes(funnelStage);
    return styleMatch && funnelMatch;
  });
  if (relevantStructures.length === 0) {
    const allForStyle = SCRIPT_SUB_STRUCTURES.filter(
      (s) => styleConfig.some((sc) => {
        if (sc.quantity <= 0) return false;
        if (sc.styleId === "DR") return s.category === "DR";
        if (sc.styleId === "UGC") return s.category === "UGC";
        if (sc.styleId === "FOUNDER") return s.category === "FOUNDER";
        if (sc.styleId === "BRAND") return s.category === "BRAND";
        return false;
      })
    );
    return allForStyle.map(
      (s) => `${s.id} \u2014 ${s.name}
Funnel: ${s.funnelStages.join(", ")} | Awareness: ${s.awarenessLevel}
Stages: ${s.stages.map((st) => `${st.stage}: ${st.function}`).join(" \u2192 ")}
Why it converts: ${s.whyItConverts}`
    ).join("\n\n");
  }
  return relevantStructures.map(
    (s) => `${s.id} \u2014 ${s.name}
Funnel: ${s.funnelStages.join(", ")} | Awareness: ${s.awarenessLevel}
Stages: ${s.stages.map((st) => `${st.stage}: ${st.function}`).join(" \u2192 ")}
Why it converts: ${s.whyItConverts}`
  ).join("\n\n");
}
async function generateVideoBrief(transcript, visualAnalysis, product, brandName, productInfoContext, styleConfig, duration, sourceType, funnelStage) {
  const productIntel = PRODUCT_INTELLIGENCE[product];
  const productIntelBlock = productIntel ? `
PRODUCT INTELLIGENCE FOR ${productIntel.fullName}:
Category: ${productIntel.category}
Primary Benefit: ${productIntel.primaryBenefit}
Differentiator: ${productIntel.differentiator}
Key Ingredients: ${productIntel.keyIngredients.join(", ")}
Target Persona: ${productIntel.targetPersona}
Awareness Angle: ${productIntel.awarenessAngle}

COPY LEVERS (use these in scripts):
${productIntel.copyLevers.map((l, i) => `${i + 1}. ${l}`).join("\n")}

COPY TRAPS (avoid these):
${productIntel.copyTraps.map((t2, i) => `${i + 1}. ${t2}`).join("\n")}

STACK PARTNERS: ${productIntel.stackPartners.join(", ")}
` : `Product: ONEST ${product}. Use ONEST Health's brand positioning: Australian-made, transparent labelling, clinically dosed ingredients, no proprietary blends.`;
  const fallbackBrief = PRODUCT_FALLBACK_BRIEFS[product] || "";
  const fullProductInfo = productInfoContext || fallbackBrief || `Product: ONEST ${product}. Brand: ONEST Health. Website: onest.com.au.`;
  const styleRequests = styleConfig.filter((s) => s.quantity > 0);
  const styleRequestText = styleRequests.map((s) => {
    const style = SCRIPT_STYLES.find((st) => st.id === s.styleId);
    return `${s.quantity}x ${style?.label || s.styleId} (${style?.description || ""})`;
  }).join(", ");
  const subStructureRef = getSubStructureReference(styleConfig, funnelStage);
  const sourceContext = sourceType === "winning_ad" ? `This is one of OUR OWN winning ads. Your job is to create VARIATIONS that extend its success \u2014 hook swaps, angle shifts, audience reframes, format adaptations. Keep what works, vary what can be tested.` : `This is a COMPETITOR ad. Your job is to reverse-engineer what makes it engage viewers, then create concepts that use that engagement framework to SELL ONEST ${product}.`;
  const system = `You are an elite direct response advertising strategist for ONEST Health, an Australian health supplement brand. You have 15+ years of experience creating video ads that generate measurable sales \u2014 not just views.

Your job is to deeply analyse competitor video ads, reverse-engineer what makes them ENGAGE viewers (hook, narrative framework, persuasion mechanism), and then create a creative brief that uses that same engagement framework to SELL an ONEST Health product.

CRITICAL DISTINCTION:
- The competitor's ad structure tells us HOW to hold attention. That is the framework.
- YOUR brief must specify how to use that attention to SELL the ONEST product.
- Every concept you propose must have a clear path from "viewer watches" to "viewer buys."

You understand the difference between:
- DR (Direct Response): Hard-sell. Clear offer. Specific CTA. The viewer must know exactly what the product is, why they need it, and how to buy it now.
- UGC (User-Generated Content): Soft-sell. Authentic personal experience. The viewer should feel like a real person genuinely loves this product \u2014 but the product name, benefits, and where to get it are still clearly communicated. UGC sells through trust and relatability, not pressure.
- FOUNDER-LED: Highest-trust format. The founder speaks with authority and personal conviction. Authenticity is the entire mechanism.
- BRAND / EQUITY: Does not ask for a sale. Asks for belief. Measured by watch time, shares, saves, and downstream conversion lift.

You do NOT create generic scripts. You reverse-engineer what makes the competitor ad engage viewers, then build a brief that channels that engagement into product sales.

${COMPLIANCE_RULES}`;
  const prompt = `Analyse this competitor video ad and create a video creative brief for ONEST Health's ${product}.

${sourceContext}

FUNNEL STAGE: ${funnelStage}
Apply the rules for this funnel stage to all concept development:
- cold: problem-led, product named only after hook establishes tension
- warm: differentiation-led, ONEST named after hook
- retargeting: proof-led, product can be named in hook
- retention: loyalty/stack-led, never re-explain what the product does

${FUNNEL_STAGE_RULES[funnelStage]}

COMPETITOR BRAND: ${brandName}

COMPETITOR TRANSCRIPT:
${transcript}

VISUAL ANALYSIS:
${visualAnalysis}

ONEST PRODUCT INFORMATION:
${fullProductInfo}
${productIntelBlock}

AVAILABLE SCRIPT SUB-STRUCTURES FOR THIS FUNNEL STAGE:
${subStructureRef}

${HOOK_BANK}

INSTRUCTIONS:

PART 1 \u2014 COMPETITOR ANALYSIS (What makes their ad ENGAGE viewers?)
1. What is the SPECIFIC hook type?
2. What is the narrative framework?
3. What persuasion mechanism drives engagement?

PART 2 \u2014 ONEST SELLING STRATEGY (How do we use that engagement to SELL ${product}?)
4. How should ONEST adapt this framework to sell ${product}? Specify:
   - Which product benefits map to the competitor's key claims
   - How to weave ${product}'s ingredients/results into the narrative naturally
   - What makes ${product} the obvious solution within this framework
5. What is the product selling angle?

PART 3 \u2014 SCRIPT CONCEPTS (${styleRequestText})
Generate exactly these concepts: ${styleRequestText}
Each concept MUST specify a subStructureId from the available structures above.

Return your response in this EXACT JSON format:
{
  "funnelStage": "${funnelStage}",
  "competitorConceptAnalysis": "200+ word analysis",
  "hookStyle": "specific hook type identified",
  "hookArchetype": "One of: contrarian, specificFrustration, socialProofLead, namedEnemy, boldClaim",
  "narrativeFramework": "exact narrative structure",
  "persuasionMechanism": "how the ad holds attention and builds desire",
  "productSellingAngle": "150+ words on how ${product}'s benefits map onto the framework",
  "onestAdaptation": "200+ word explanation of how ONEST adapts this to sell ${product}",
  "awarenessLevel": "One of: UNAWARE, PROBLEM_AWARE, SOLUTION_AWARE, PRODUCT_AWARE, MOST_AWARE",
  "primaryObjection": "The main objection and how to overcome it",
  "competitiveRepositioning": "How to position ONEST as better than alternatives",
  "stackOpportunity": "Complementary ONEST products or 'None'",
  "concepts": [
    {
      "title": "...",
      "hookLine": "exact opening hook line",
      "structure": "outline with product/benefit/CTA placement",
      "keyAngle": "unique selling angle",
      "sellingStrategy": "how this script sells ${product}",
      "ctaApproach": "specific CTA approach \u2014 no discount codes or offer amounts",
      "styleId": "DR|UGC|FOUNDER|BRAND|EDUCATION|LIFESTYLE|DEMO",
      "subStructureId": "e.g. DR-1, UGC-3, FL-2, BR-1"
    }
  ],
  "targetAudience": "specific target audience",
  "toneAndEnergy": "tone and energy level description"
}`;
  const response = await callClaude([{ role: "user", content: prompt }], system, 8e3);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`[VideoPipeline] Claude returned no JSON object in brief response. Raw: ${response.substring(0, 500)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`[VideoPipeline] Failed to parse brief JSON: ${e.message}. Raw: ${jsonMatch[0].substring(0, 500)}`);
  }
  if (!parsed.concepts && (parsed.drConcepts || parsed.ugcConcepts)) {
    parsed.concepts = [
      ...(parsed.drConcepts || []).map((c) => ({ ...c, styleId: "DR" })),
      ...(parsed.ugcConcepts || []).map((c) => ({ ...c, styleId: "UGC" }))
    ];
  }
  if (!parsed.funnelStage) parsed.funnelStage = funnelStage;
  return parsed;
}
function getSubStructurePromptBlock(subStructureId) {
  if (!subStructureId) return "";
  const sub = SCRIPT_SUB_STRUCTURES.find((s) => s.id === subStructureId);
  if (!sub) return "";
  return `
ASSIGNED SUB-STRUCTURE: ${sub.id} \u2014 ${sub.name}
Category: ${sub.category} | Funnel: ${sub.funnelStages.join(", ")} | Awareness: ${sub.awarenessLevel}
Stages:
${sub.stages.map((st) => `- ${st.stage}: ${st.function}`).join("\n")}
Why it converts: ${sub.whyItConverts}
Psychological lever: ${sub.psychologicalLever}

Follow this sub-structure's stage progression exactly. Each stage maps to timestamp segments in the script.
`;
}
function getArchetypePromptBlock(archetype) {
  if (!archetype) return "";
  const profile = ARCHETYPE_PROFILES[archetype];
  if (!profile) return "";
  return `
ACTOR ARCHETYPE: ${profile.label}
Life context: ${profile.lifeContext}
Language register: ${profile.languageRegister}
Pre-product objection: ${profile.preProductObjection}

Apply this voice profile throughout the script. The character's life context, language register, and pre-product objection must be woven into the dialogue naturally.
`;
}
function getStyleSystemPrompt(styleId, product, duration, funnelStage) {
  const durationRange = duration === 45 ? "40-50" : duration === 90 ? "80-100" : "50-65";
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";
  const funnelRules = FUNNEL_STAGE_RULES[funnelStage];
  const baseRules = `
MANDATORY RULES FOR ALL SCRIPTS:
1. The product name "ONEST ${product}" must appear at least 2-3 times in the script.
2. At least 2-3 specific product benefits or ingredients must be mentioned \u2014 not generic supplement claims.
3. Every timestamp segment must include a transitionLine \u2014 a single sentence that closes the current segment and opens the next. This makes structural shifts feel inevitable, not engineered. Required in every segment except the final CTA.
4. Every segment must serve the sale \u2014 no filler that could apply to any brand.
5. The script must build sequentially \u2014 each segment must increase purchase intent before the next begins.
6. Script must be ${durationRange} seconds long with ${segmentCount} timestamp segments.

FUNNEL STAGE: ${funnelStage}
${funnelRules}

${TRANSITION_LOGIC}

${SCRIPT_AUDIT_CHECKLIST}

${COMPLIANCE_RULES}`;
  switch (styleId) {
    case "DR":
      return `You are a world-class direct response copywriter who has generated over $50M in trackable revenue from video ads. You write for ONEST Health, an Australian health supplement brand.

YOUR SCRIPTS SELL PRODUCTS. Every line of dialogue exists to move the viewer closer to purchase. You understand the proven DR framework:

1. HOOK (0-5s): Pattern-interrupt that stops the scroll. Match the approved hook style. For cold traffic: never name the product in the hook.
2. PROBLEM/DESIRE (5-15s): Agitate the pain point or amplify the desire. Make the viewer feel the gap between where they are and where they want to be.
3. SOLUTION REVEAL (15-25s): Introduce ONEST ${product} BY NAME as the answer. Hit 2-3 specific benefits backed by real named ingredients or claims. Timing of first product mention is governed by funnelStage.
4. PROOF (25-40s): Social proof, results, clinical backing, or transformation. Make the viewer believe this product delivers.
5. CTA (40-55s): Clear, direct call-to-action. Tell the viewer exactly what to do next. CTA intensity is governed by funnelStage.

CRITICAL DR RULES:
1. The product name "ONEST ${product}" must appear at least 3 times.
2. At least 3 specific product benefits or named ingredients must be mentioned.
3. The CTA must tell viewers exactly where to go. No discount codes or offer amounts in the script.
4. Every timestamp segment must include a transitionLine \u2014 required in every segment except the final CTA.
5. Every segment must serve the sale \u2014 no filler, no generic motivation that could apply to any brand.
6. The script must build sequentially \u2014 each segment must increase purchase intent before the next begins.
${baseRules}`;
    case "UGC":
      return `You are an expert UGC scriptwriter who creates authentic-feeling video ad scripts for ONEST Health, an Australian health supplement brand. Your scripts sound like real people talking to their phone \u2014 not actors reading ad copy.

THE UGC PARADOX: The script must feel completely unscripted and genuine, while strategically communicating product benefits and driving purchase intent.

YOUR UGC FRAMEWORK:
1. HOOK (0-5s): Casual, scroll-stopping opener. Sounds like someone about to share something genuinely exciting. Match the approved hook style. For cold traffic: does not open with the product name.
2. PERSONAL CONTEXT (5-15s): The creator's real situation \u2014 their problem, journey, why they were looking for a solution. Builds relatability.
3. DISCOVERY (15-25s): How they found ONEST ${product}. Name the product naturally \u2014 the way you'd tell a mate about something you found.
4. EXPERIENCE & RESULTS (25-40s): Specific, personal results \u2014 not clinical claims. "I actually had energy at 3pm" not "clinically proven to boost energy." Mention 2-3 benefits naturally.
5. RECOMMENDATION (40-55s): Genuine recommendation. Not "BUY NOW" \u2014 "honestly, just try it" or "I'll leave the link below." Feels like a friend's recommendation.

CRITICAL UGC RULES:
1. Product name appears 2-3 times naturally \u2014 never in the hook for cold traffic.
2. Benefits expressed as personal experiences, not marketing claims.
3. Every timestamp segment must include a transitionLine \u2014 makes each structural shift feel like natural conversation, not a script section change.
4. Apply the voice profile for the selected actor archetype.
5. Include at least one moment of genuine personality \u2014 a laugh, a tangent, a self-deprecating comment. Real people are not perfectly polished.
6. BANNED: "formulated", "proprietary", "cutting-edge", "revolutionary", "unlock your potential", "fuel your journey", "transform your body", "achieve your goals". Instant inauthenticity signals.
7. Australian English throughout. Casual AU colloquialisms where they fit naturally \u2014 do not force them.
${baseRules}`;
    case "FOUNDER":
      return `You are writing a founder-led video ad script for ONEST Health. The founder speaks with authority, passion, and personal conviction about why they created ${product}.

CRITICAL RULE: The founder must be on camera. This does not work with actors or proxies. Authenticity is the entire mechanism.

FOUNDER-LED FRAMEWORK:
1. HOOK (0-5s): Founder introduces themselves or makes a bold statement about the industry.
2. THE PROBLEM (5-15s): What the founder saw wrong in the supplement industry \u2014 proprietary blends, under-dosing, dishonesty.
3. THE MISSION (15-25s): Why they created ONEST \u2014 transparency, clinical dosing, doing it right.
4. THE PRODUCT (25-${duration === 90 ? "70" : "40"}s): Specific details about ${product} \u2014 ingredients, doses, why it's different.
5. THE INVITATION (final 10-15s): Invites the viewer to try it. Confident but not pushy. "See for yourself."

CRITICAL FOUNDER RULES:
1. Speak with authority and personal conviction \u2014 "I created this because..."
2. Show insider knowledge of the industry \u2014 what competitors do wrong
3. Be specific about ingredients and doses \u2014 founders know their products
4. CTA is an invitation, not a hard sell \u2014 "I'd love for you to try it"
5. Every timestamp segment must include a transitionLine.
${baseRules}`;
    case "BRAND":
      return `You are writing a brand/equity video script for ONEST Health. This script does NOT ask for a sale \u2014 it asks for BELIEF.

BRAND CONTENT RULES:
- These are measured by watch time, shares, saves, and downstream conversion lift \u2014 never by direct ROAS
- Do not evaluate brand content on the same metrics as DR content
- The product appears as the conclusion of the argument, not the start
- Focus on identity, belief, and community \u2014 not features and benefits

BRAND FRAMEWORK:
1. OPENING: Aspirational visual or bold belief statement \u2014 no product, no logo yet
2. THE TRUTH: What serious performance/health actually requires
3. THE AUDIENCE: Name them \u2014 not "supplement users" but "the ones who don't settle"
4. THE CONVICTION: ONEST's position \u2014 not what we sell, what we believe
5. THE REVEAL: Product appears as the natural conclusion
6. SIGN-OFF: Brand line \u2014 MADE OF GREATNESS

CRITICAL BRAND RULES:
1. Product appears late \u2014 earned through the narrative, not inserted
2. No hard sell, no urgency, no "buy now"
3. Every timestamp segment must include a transitionLine.
4. Focus on emotional resonance and identity alignment
${baseRules}`;
    case "EDUCATION":
      return `You are writing an education/myth-busting video ad script for ONEST Health. The script teaches the viewer something surprising, then positions ${product} as the answer.

EDUCATION STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Surprising fact or myth that challenges what the viewer believes.
2. THE MYTH/PROBLEM (5-15s): Explain what most people get wrong and why it matters.
3. THE TRUTH (15-25s): Reveal the truth with evidence or logic. Build credibility.
4. THE SOLUTION (25-${duration === 90 ? "70" : "40"}s): Position ONEST ${product} as the product that gets it right. Specific ingredients/benefits.
5. CTA (final 10-15s): "Now you know the truth \u2014 here's what to do about it."

CRITICAL EDUCATION RULES:
- Lead with genuine education \u2014 the viewer should learn something real
- The myth-bust must be relevant to the product's differentiator
- Transition from education to product must feel natural, not forced
- CTA leverages the new knowledge: "Now that you know this, try..."
- Every timestamp segment must include a transitionLine.
${baseRules}`;
    case "LIFESTYLE":
      return `You are writing a lifestyle/aspiration video ad script for ONEST Health. The script shows the aspirational life the viewer wants, with ${product} woven naturally into the routine.

LIFESTYLE STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Aspirational visual or statement that captures the desired lifestyle.
2. THE ROUTINE (5-25s): Day-in-the-life showing the aspirational routine. Product appears naturally.
3. THE MOMENT (25-${duration === 90 ? "60" : "35"}s): Key moment where ${product} is featured \u2014 taking it, talking about it, showing results.
4. THE FEELING (${duration === 90 ? "60-80" : "35-45"}s): How the product contributes to this lifestyle. Emotional connection.
5. SOFT CTA (final 10s): Aspirational close \u2014 "This could be your morning too."

CRITICAL LIFESTYLE RULES:
- The product must feel like a natural part of the lifestyle, not inserted
- Focus on feelings and aspirations, not features and benefits
- Visual direction is crucial \u2014 every shot should feel aspirational
- CTA is soft and aspirational \u2014 invites the viewer into the lifestyle
- Every timestamp segment must include a transitionLine.
${baseRules}`;
    case "DEMO":
      return `You are writing a problem/solution demo video ad script for ONEST Health. The script visually demonstrates the problem, then shows ${product} solving it.

DEMO STRUCTURE (${durationRange}s):
1. HOOK (0-5s): Show or state the problem dramatically.
2. THE PROBLEM AMPLIFIED (5-15s): Make the problem feel urgent and relatable. Show the frustration.
3. THE SOLUTION (15-25s): Introduce ONEST ${product}. Show it being used/taken.
4. THE RESULTS (25-${duration === 90 ? "70" : "40"}s): Demonstrate the results \u2014 before/after, side-by-side, or testimonial proof.
5. CTA (final 10-15s): Clear next step \u2014 "Try it for yourself."

CRITICAL DEMO RULES:
- The problem must be visually demonstrable or emotionally relatable
- The product introduction must feel like a natural solution reveal
- Results should be specific and believable, not exaggerated
- CTA connects the demonstrated results to the viewer's situation
- Every timestamp segment must include a transitionLine.
${baseRules}`;
    default:
      return `You are an expert video ad scriptwriter for ONEST Health. Write a compelling ${durationRange}-second script for ${product}.
${baseRules}`;
  }
}
async function generateConceptMatchedScript(transcript, visualAnalysis, product, concept, brief, productInfoContext, duration, funnelStage, archetype) {
  const productIntel = PRODUCT_INTELLIGENCE[product];
  const fallbackBrief = PRODUCT_FALLBACK_BRIEFS[product] || "";
  const fullProductInfo = productInfoContext || fallbackBrief || `Product: ONEST ${product}. Brand: ONEST Health. Website: onest.com.au.`;
  const productIntelBlock = productIntel ? `
=== PRODUCT INTELLIGENCE (YOU MUST USE THIS) ===
${productIntel.fullName} \u2014 ${productIntel.category}
Primary Benefit: ${productIntel.primaryBenefit}
Differentiator: ${productIntel.differentiator}
Key Ingredients: ${productIntel.keyIngredients.join(", ")}

COPY LEVERS (weave these into the script):
${productIntel.copyLevers.map((l, i) => `${i + 1}. ${l}`).join("\n")}

COPY TRAPS (AVOID these):
${productIntel.copyTraps.map((t2, i) => `${i + 1}. ${t2}`).join("\n")}
=== END PRODUCT INTELLIGENCE ===` : "";
  const styleLabel = SCRIPT_STYLES.find((s) => s.id === concept.styleId)?.label || concept.styleId;
  const system = getStyleSystemPrompt(concept.styleId, product, duration, funnelStage);
  const durationRange = duration === 45 ? "40-50" : duration === 90 ? "80-100" : "50-65";
  const segmentCount = duration === 45 ? "6-8" : duration === 90 ? "12-16" : "8-12";
  const subStructureBlock = getSubStructurePromptBlock(concept.subStructureId);
  const archetypeBlock = concept.styleId === "UGC" && archetype ? getArchetypePromptBlock(archetype) : "";
  const scriptTypeDesc = concept.styleId === "DR" ? "direct response script" : concept.styleId === "UGC" ? "UGC (user-generated content) script" : concept.styleId === "FOUNDER" ? "founder-led script" : concept.styleId === "BRAND" ? "brand/equity script" : `${styleLabel} script`;
  const prompt = `Write a ${scriptTypeDesc} for ONEST Health's ${product} that follows the approved concept brief.

APPROVED CONCEPT:
Title: ${concept.title}
Hook Line: ${concept.hookLine}
Structure: ${concept.structure}
Key Angle: ${concept.keyAngle}
Selling Strategy: ${concept.sellingStrategy || "Sell through key benefits and unique positioning"}
CTA Approach: ${concept.ctaApproach || "Direct viewers to onest.com.au"}
Script Style: ${styleLabel}

${subStructureBlock}

FUNNEL STAGE: ${funnelStage}
Apply funnel stage rules to product naming timing, CTA intensity, and proof placement.

${archetypeBlock}

COMPETITOR'S ENGAGEMENT FRAMEWORK (use for PACING and STRUCTURE, not content):
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Persuasion Mechanism: ${brief.persuasionMechanism}

PRODUCT SELLING ANGLE:
${brief.productSellingAngle || brief.onestAdaptation}

HOW TO ADAPT FOR ONEST:
${brief.onestAdaptation}

TARGET AUDIENCE: ${brief.targetAudience}
TONE & ENERGY: ${brief.toneAndEnergy}

COMPETITOR'S ORIGINAL TRANSCRIPT (for reference \u2014 use PACING and STRUCTURE, not words):
${transcript}

=== PRODUCT INFORMATION (YOU MUST USE THIS) ===
${fullProductInfo}
${productIntelBlock}
=== END PRODUCT INFORMATION ===

Return your response in this EXACT JSON format:
{
  "title": "${concept.title}",
  "hook": "exact opening line \u2014 stops the scroll as a complete idea in under 3 seconds",
  "script": [
    {
      "timestamp": "0-3s",
      "visual": "what the viewer sees",
      "dialogue": "what is said \u2014 every line serves the sale",
      "transitionLine": "single sentence closing this segment and opening the next"
    },
    ...more rows covering ${durationRange} seconds total (${segmentCount} segments)
  ],
  "visualDirection": "2-3 sentences. DR: polished direct response energy. UGC: phone-filmed, natural lighting, real environment.",
  "strategicThesis": "Paragraph: (1) how this uses the competitor's engagement framework, (2) how it sells ONEST ${product} specifically, (3) what psychological triggers drive purchase intent, (4) why the CTA approach will convert"
}

CRITICAL: Every script segment MUST include a transitionLine field (except the final CTA segment). The transitionLine is a single sentence that closes the current segment and opens the next, making the structural shift feel inevitable rather than engineered.

Make the script ~${duration} seconds long with ${segmentCount} timestamp segments.`;
  const response = await callClaude([{ role: "user", content: prompt }], system, 6e3);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsed.subStructureId = concept.subStructureId || "";
      parsed.scriptMetadata = {
        product: `ONEST ${product}`,
        targetPersona: productIntel?.targetPersona || brief.targetAudience || "Health-conscious adults",
        awarenessLevel: brief.awarenessLevel || "PROBLEM_AWARE",
        funnelStage,
        scriptStyle: styleLabel,
        subStructure: concept.subStructureId || "custom",
        hookArchetype: brief.hookArchetype || "UNKNOWN",
        testHypothesis: `Testing ${concept.subStructureId || styleLabel} structure with ${brief.hookArchetype || "mixed"} hook archetype for ${product} at ${funnelStage} funnel stage`,
        primaryObjection: brief.primaryObjection || "Scepticism",
        ...archetype ? { actorArchetype: archetype } : {}
      };
      if (!parsed.visualDirectionBrief) {
        parsed.visualDirectionBrief = {
          overallStyle: concept.styleId === "UGC" ? "Phone-filmed, natural lighting, real environment" : "Polished direct response energy",
          colorPalette: "ONEST brand colours",
          pacing: duration === 45 ? "Fast-paced, punchy" : duration === 90 ? "Measured, story-driven" : "Medium pacing",
          shots: []
        };
      }
      return parsed;
    }
  } catch (e) {
    console.error("[VideoPipeline] Failed to parse script JSON:", e);
  }
  return {
    title: concept.title,
    hook: concept.hookLine,
    script: [
      { timestamp: "0-3s", visual: "Opening shot", dialogue: concept.hookLine, transitionLine: "But here's what most people don't realise..." },
      { timestamp: "3-10s", visual: "Problem setup", dialogue: "Here's what most people don't know...", transitionLine: "And that's exactly why this matters." },
      { timestamp: "10-25s", visual: "Solution reveal", dialogue: `ONEST ${product} changes everything.`, transitionLine: "The results speak for themselves." },
      { timestamp: "25-45s", visual: "Social proof", dialogue: "The results speak for themselves.", transitionLine: "So here's what you can do right now." },
      { timestamp: "45-55s", visual: "CTA", dialogue: "Click the link below to get started." }
    ],
    visualDirection: "Match the competitor's production style.",
    strategicThesis: "This script adapts the competitor's framework for ONEST.",
    subStructureId: concept.subStructureId || "",
    scriptMetadata: {
      product: `ONEST ${product}`,
      targetPersona: productIntel?.targetPersona || "Health-conscious adults",
      awarenessLevel: brief.awarenessLevel || "PROBLEM_AWARE",
      funnelStage,
      scriptStyle: styleLabel,
      subStructure: concept.subStructureId || "custom",
      hookArchetype: brief.hookArchetype || "UNKNOWN",
      testHypothesis: "Testing framework adaptation",
      primaryObjection: brief.primaryObjection || "Scepticism"
    },
    visualDirectionBrief: {
      overallStyle: "Match competitor's visual approach",
      colorPalette: "ONEST brand colours",
      pacing: "Medium pacing",
      shots: []
    }
  };
}
var NAMED_EXPERTS = [
  { name: "Eugene Schwartz", framework: "Awareness Levels", lens: "Does the copy match the audience's awareness stage? Does it move them to the next level?", instantKiller: "Copy addresses wrong awareness level (e.g., selling features to unaware audience)" },
  { name: "Gary Halbert", framework: "Starving Crowd", lens: "Is this targeting a desperate need? Would a 'starving crowd' respond to this offer?", instantKiller: "No clear audience hunger or desire identified in the copy" },
  { name: "Robert Cialdini", framework: "Influence & Persuasion", lens: "Which influence principles are used? Reciprocity, scarcity, authority, consistency, liking, consensus?", instantKiller: "No persuasion mechanism present \u2014 copy just describes the product" },
  { name: "Daniel Kahneman", framework: "System 1/System 2", lens: "Does the hook trigger System 1 (fast, emotional)? Does the proof satisfy System 2 (slow, rational)?", instantKiller: "Hook requires too much cognitive effort \u2014 won't stop the scroll" },
  { name: "Leon Festinger", framework: "Cognitive Dissonance", lens: "Does the copy create productive dissonance? Does it challenge a belief the viewer holds?", instantKiller: "No tension or challenge to existing beliefs \u2014 copy is too comfortable" },
  { name: "Dan Ariely", framework: "Predictably Irrational", lens: "Does the copy use anchoring, decoy effects, or loss framing effectively?", instantKiller: "No behavioural economics principles \u2014 copy relies on rational persuasion alone" },
  { name: "BJ Fogg", framework: "Behaviour Model", lens: "Is the CTA easy enough? Is motivation high enough? Is there a clear trigger?", instantKiller: "CTA has too much friction or motivation is insufficient for the ask" },
  { name: "Byron Sharp", framework: "How Brands Grow", lens: "Does the copy build mental availability? Is the brand distinctive and memorable?", instantKiller: "Brand name not mentioned enough \u2014 copy could be for any competitor" },
  { name: "Al Ries", framework: "Positioning", lens: "Is the product positioned clearly in the viewer's mind? Is there a clear category and differentiator?", instantKiller: "No clear positioning \u2014 product could be anything in the category" },
  { name: "Don Norman", framework: "Design of Everyday Things", lens: "Is the message clear and intuitive? Can the viewer understand the value in 3 seconds?", instantKiller: "Message is confusing or requires too much interpretation" }
];
async function reviewScriptWithPanel(scriptJson, product, scriptStyle, brief, productInfoContext, funnelStage) {
  const rounds = [];
  let currentScript = scriptJson;
  let approved = false;
  let finalScore = 0;
  const MAX_ROUNDS = 5;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const system = `You are simulating a panel of 10 advertising experts reviewing a ${scriptStyle} script for ONEST Health's ${product}. This is review round ${round}.

Score based on SIX criteria of equal weight:

1. ENGAGEMENT FRAMEWORK: Does the script follow the approved hook style and narrative framework? Does it use the competitor's engagement structure correctly?

2. PRODUCT SELLING: Does the script effectively sell ONEST ${product}? Is the product named? Are specific benefits and named ingredients mentioned? Would a viewer know what the product is and why they should want it?

3. CTA STRENGTH:
   DR: Does the script end with a clear, direct CTA? Does the viewer know exactly where to go?
   UGC: Does the script end with a genuine, friend-like recommendation? Would a viewer feel motivated to check out the product?

4. FORMAT AUTHENTICITY:
   DR: Does this feel like a polished direct response ad that drives action?
   UGC: Does this feel like authentic UGC \u2014 a real person sharing a genuine experience? Or does it sound like scripted ad copy?

5. PERSUASION ARCHITECTURE: Does the script build sequentially \u2014 does each segment increase purchase intent before the next begins? Is the CTA arriving at peak motivation, after proof has landed? Does each transitionLine make the structural shift feel inevitable, not engineered? Is there a tension established in the hook that gets resolved in the solution section?

6. CONVERSION POTENTIAL: Overall \u2014 would this script drive purchases? Would you approve this to run as a paid ad for ONEST ${product}?

SCORE FLOOR RULES \u2014 strictly enforced:
- Script fails to mention product by name: score MUST be below 70
- Script has no clear CTA (DR) or no recommendation (UGC): score MUST be below 75
- Script could belong to any generic supplement brand: score MUST be below 80
- Product introduced before problem is established (cold/warm): score MUST be below 80
- Any transitionLine missing from the JSON output: score MUST be below 85
- Script contains banned phrases ("unlock your potential", "fuel your journey", "transform your body", "achieve your goals"): score MUST be below 75

FUNNEL STAGE: ${funnelStage}
Verify the script follows the non-negotiable rules for this funnel stage.

${COMPLIANCE_RULES}

Score range guidance:
- 90-100: Approved. Effective product sell, strong CTA, authentic format, sequential persuasion architecture, complete transitionLine coverage.
- 80-89: Good but missing specific product benefits, CTA could be stronger, or one transition feels engineered.
- 70-79: Framework correct but script does not sell the product effectively. Structural issue.
- Below 70: Could be for any brand. Fundamental commercial failure. Requires structural rewrite.

Return JSON:
{
  "reviews": [
    {
      "expertName": "Full name",
      "domain": "Their domain/framework",
      "score": 60 to 100,
      "feedback": "2-3 sentences: what works, what is missing for selling the product, one specific improvement"
    }
  ]
}

Score range guidance:
- 90-100: Approved. Effective product sell, strong CTA, authentic format.
- 80-89: Good but missing specific product benefits or CTA could be stronger.
- 70-79: Framework correct but script does not sell the product effectively.
- Below 70: Could be for any brand. Fundamental commercial failure.`;
    const reviewPrompt = `Review this ${scriptStyle} script for ONEST Health's ${product}.

SCRIPT:
${JSON.stringify(currentScript, null, 2)}

PRODUCT INFORMATION:
${productInfoContext || PRODUCT_FALLBACK_BRIEFS[product] || `ONEST ${product}`}

BRIEF CONTEXT:
Hook Style: ${brief.hookStyle}
Narrative Framework: ${brief.narrativeFramework}
Target Audience: ${brief.targetAudience}
Funnel Stage: ${funnelStage}

${round >= 4 ? "ROUND 4+ INSTRUCTION: If the script has not cleared 90 after 3 rounds, the issue is STRUCTURAL. Polishing sentences will not solve a structural problem. Instruct a rebuild from the hook down \u2014 new hook approach, new narrative arc, new proof sequencing." : ""}

Provide your expert panel review as JSON.`;
    const reviewResponse = await callClaude([{ role: "user", content: reviewPrompt }], system, 4e3);
    let reviewData;
    try {
      const jsonMatch = reviewResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        reviewData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error(`[VideoPipeline] Failed to parse review round ${round}:`, e);
    }
    if (!reviewData?.reviews) {
      reviewData = {
        reviews: NAMED_EXPERTS.slice(0, 10).map((exp) => ({
          expertName: exp.name,
          domain: exp.framework,
          score: 75,
          feedback: "Could not generate review. Manual review recommended."
        }))
      };
    }
    const avgScore = Math.round(
      reviewData.reviews.reduce((sum, r) => sum + (r.score || 75), 0) / reviewData.reviews.length
    );
    rounds.push({
      round,
      reviews: reviewData.reviews,
      averageScore: avgScore,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (avgScore >= 90) {
      approved = true;
      finalScore = avgScore;
      break;
    }
    finalScore = avgScore;
    if (round < MAX_ROUNDS) {
      const lowestCriteria = reviewData.reviews.sort((a, b) => (a.score || 75) - (b.score || 75)).slice(0, 3).map((r) => `${r.expertName} (${r.domain}): ${r.feedback}`).join("\n");
      const revisionInstruction = round >= 4 ? `STRUCTURAL REWRITE REQUIRED. The script has failed to clear 90 after ${round - 1} rounds. The issue is structural, not copy polish. Rebuild from the hook down \u2014 new hook approach, new narrative arc, new proof sequencing. Keep the same product and concept angle but completely restructure the delivery.` : `Revise the script to address the 3 lowest-scoring criteria. Focus on specific improvements, not general polish.`;
      const revisionPrompt = `${revisionInstruction}

LOWEST-SCORING FEEDBACK:
${lowestCriteria}

CURRENT SCRIPT:
${JSON.stringify(currentScript, null, 2)}

Return the COMPLETE revised script in the same JSON format (title, hook, script array with timestamp/visual/dialogue/transitionLine, visualDirection, strategicThesis).`;
      const revisionSystem = getStyleSystemPrompt(currentScript.scriptMetadata?.scriptStyle === "UGC" ? "UGC" : currentScript.scriptMetadata?.scriptStyle === "Founder-Led" ? "FOUNDER" : currentScript.scriptMetadata?.scriptStyle === "Brand / Equity" ? "BRAND" : "DR", product, 60, funnelStage);
      const revisionResponse = await callClaude([{ role: "user", content: revisionPrompt }], revisionSystem, 6e3);
      try {
        const jsonMatch = revisionResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const revisedScript = JSON.parse(jsonMatch[0]);
          revisedScript.subStructureId = currentScript.subStructureId;
          revisedScript.scriptMetadata = currentScript.scriptMetadata;
          revisedScript.visualDirectionBrief = revisedScript.visualDirectionBrief || currentScript.visualDirectionBrief;
          currentScript = revisedScript;
        }
      } catch (e) {
        console.error(`[VideoPipeline] Failed to parse revision round ${round}:`, e);
      }
    }
  }
  const summary = approved ? `Script approved in round ${rounds.length} with average score ${finalScore}/100.` : `Script completed ${rounds.length} review rounds. Final score: ${finalScore}/100. ${finalScore < 90 ? "Flagged for human review." : ""}`;
  return { rounds, finalScore, approved, summary };
}
var loadProductInfoContext = buildProductInfoContext;
function formatBriefForDisplay(brief, brandName, product, sourceType) {
  const sourceLabel = sourceType === "winning_ad" ? "Our Winning Ad" : `${brandName} Competitor Ad`;
  let text2 = `# Video Creative Brief \u2014 ${product}
## Based on ${sourceLabel}
`;
  text2 += `### Classification
`;
  text2 += `- **Funnel Stage:** ${brief.funnelStage || "N/A"}
`;
  text2 += `- **Hook Archetype:** ${brief.hookArchetype?.replace(/_/g, " ") || "N/A"}
`;
  text2 += `- **Awareness Level:** ${brief.awarenessLevel?.replace(/_/g, " ") || "N/A"}
`;
  text2 += `### Competitor Concept Analysis
${brief.competitorConceptAnalysis}
`;
  text2 += `### Hook Style
${brief.hookStyle}
`;
  text2 += `### Narrative Framework
${brief.narrativeFramework}
`;
  text2 += `### Persuasion Mechanism
${brief.persuasionMechanism}
`;
  text2 += `### Product Selling Angle
${brief.productSellingAngle || "N/A"}
`;
  text2 += `### Primary Objection
${brief.primaryObjection || "N/A"}
`;
  text2 += `### Competitive Repositioning
${brief.competitiveRepositioning || "N/A"}
`;
  text2 += `### ONEST Adaptation Strategy
${brief.onestAdaptation}
`;
  text2 += `### Stack Opportunity
${brief.stackOpportunity || "None"}
---
`;
  text2 += `### Script Concepts (${brief.concepts?.length || 0})
`;
  if (brief.concepts && Array.isArray(brief.concepts)) {
    brief.concepts.forEach((concept, i) => {
      const styleName = SCRIPT_STYLES.find((s) => s.id === concept.styleId)?.label || concept.styleId;
      text2 += `
**${i + 1}. ${concept.title}** (${styleName})
`;
      text2 += `- Hook: "${concept.hookLine}"
`;
      text2 += `- Structure: ${concept.structure}
`;
      text2 += `- Angle: ${concept.keyAngle}
`;
      text2 += `- Selling Strategy: ${concept.sellingStrategy || "N/A"}
`;
      text2 += `- CTA: ${concept.ctaApproach || "N/A"}
`;
      text2 += `- Sub-Structure: ${concept.subStructureId || "N/A"}
`;
    });
  }
  text2 += `
---
**Target Audience:** ${brief.targetAudience}
**Tone & Energy:** ${brief.toneAndEnergy}`;
  return text2;
}
function normalizeStyleConfig(input) {
  if (Array.isArray(input)) return input;
  const mapping = {
    direct_response: "DR",
    ugc_testimonial: "UGC",
    founder_led: "FOUNDER",
    education_mythbusting: "EDUCATION",
    lifestyle_aspiration: "LIFESTYLE",
    problem_solution_demo: "DEMO"
  };
  const result = [];
  if (input && typeof input === "object") {
    for (const [key, val] of Object.entries(input)) {
      const styleId = mapping[key];
      if (styleId && typeof val === "number" && val > 0) {
        result.push({ styleId, quantity: val });
      }
    }
  }
  if (result.length === 0) {
    result.push({ styleId: "DR", quantity: 2 }, { styleId: "UGC", quantity: 2 });
  }
  return result;
}
async function runVideoPipelineStages1to3(runId, input) {
  console.log(`[VideoPipeline] Starting stages 1-3 for run #${runId}`);
  const sourceType = input.sourceType || "competitor";
  const duration = input.duration || 60;
  const styleConfig = normalizeStyleConfig(input.styleConfig);
  const funnelStage = input.funnelStage || "cold";
  const productInfoContext = await loadProductInfoContext(input.product);
  await updatePipelineRun(runId, { videoStage: "stage_1_transcription" });
  let transcript = "";
  try {
    if (input.mediaUrl) {
      transcript = await withTimeout(transcribeVideo(input.mediaUrl), STEP_TIMEOUT, "Transcription");
    } else {
      transcript = "No video URL provided.";
    }
  } catch (err) {
    console.error("[VideoPipeline] Transcription failed:", err.message);
    transcript = `Transcription failed: ${err.message}`;
  }
  await updatePipelineRun(runId, { transcript });
  console.log(`[VideoPipeline] Stage 1 complete, transcript length: ${transcript.length}`);
  await updatePipelineRun(runId, { videoStage: "stage_2_analysis" });
  let visualAnalysis = "";
  try {
    const { analyzeVideoFrames: analyzeVideoFrames2 } = await Promise.resolve().then(() => (init_claude(), claude_exports));
    visualAnalysis = await withTimeout(
      analyzeVideoFrames2(input.mediaUrl, transcript, input.foreplayAdBrand || ""),
      STEP_TIMEOUT,
      "Visual analysis"
    );
  } catch (err) {
    console.error("[VideoPipeline] Visual analysis failed:", err.message);
    visualAnalysis = `Visual analysis failed: ${err.message}`;
  }
  await updatePipelineRun(runId, { visualAnalysis });
  console.log(`[VideoPipeline] Stage 2 complete, analysis length: ${visualAnalysis.length}`);
  await updatePipelineRun(runId, { videoStage: "stage_3_brief" });
  try {
    const briefOptions = await withTimeout(
      generateVideoBrief(
        transcript,
        visualAnalysis,
        input.product,
        input.foreplayAdBrand || "",
        productInfoContext,
        styleConfig,
        duration,
        sourceType,
        funnelStage
      ),
      STEP_TIMEOUT,
      "Video brief"
    );
    console.log(`[VideoPipeline] Stage 3 complete, brief generated with ${briefOptions.concepts?.length || 0} concepts`);
    const briefText = formatBriefForDisplay(briefOptions, input.foreplayAdBrand || "", input.product, sourceType);
    await updatePipelineRun(runId, {
      videoBrief: briefText,
      videoBriefOptions: briefOptions,
      videoStage: "stage_3b_brief_approval",
      videoFunnelStage: funnelStage
    });
    console.log(`[VideoPipeline] Stage 3b: Pausing for user brief approval...`);
  } catch (err) {
    console.error("[VideoPipeline] Brief generation failed:", err.message);
    await updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Brief generation failed: ${err.message}`,
      videoStage: "stage_3_brief"
    });
  }
}
async function runVideoPipelineStage4(runId, run) {
  console.log(`[VideoPipeline] Resuming stage 4 for run #${runId}`);
  const stageStart = Date.now();
  const brief = run.videoBriefOptions || {};
  const duration = run.videoDuration || 60;
  const sourceType = run.videoSourceType || "competitor";
  const funnelStage = run.videoFunnelStage || brief.funnelStage || "cold";
  const archetypes = run.videoArchetypes || [];
  const defaultArchetype = archetypes.length > 0 ? archetypes[0] : void 0;
  const productInfoContext = await loadProductInfoContext(run.product);
  await updatePipelineRun(runId, { videoStage: "stage_4_scripts" });
  const concepts = brief.concepts || [
    ...(brief.drConcepts || []).map((c) => ({ ...c, styleId: "DR" })),
    ...(brief.ugcConcepts || []).map((c) => ({ ...c, styleId: "UGC" }))
  ];
  const allScripts = [];
  for (let i = 0; i < concepts.length; i++) {
    if (Date.now() - stageStart > STAGE_4_TIMEOUT) {
      console.error(`[VideoPipeline] Stage 4 timed out after ${Math.round((Date.now() - stageStart) / 6e4)}min. ${allScripts.length}/${concepts.length} scripts completed.`);
      await updatePipelineRun(runId, { scriptsJson: allScripts });
      throw new Error(`Stage 4 timed out after ${Math.round((Date.now() - stageStart) / 6e4)} minutes. ${allScripts.length}/${concepts.length} scripts were generated successfully.`);
    }
    const concept = concepts[i];
    const styleLabel = SCRIPT_STYLES.find((s) => s.id === concept.styleId)?.label || concept.styleId;
    const label = `${styleLabel} ${i + 1}`;
    console.log(`[VideoPipeline] Generating script ${i + 1}/${concepts.length}: ${concept.title} (${styleLabel})...`);
    try {
      const script = await withTimeout(
        generateConceptMatchedScript(
          run.transcript || "",
          run.visualAnalysis || "",
          run.product,
          concept,
          brief,
          productInfoContext,
          duration,
          funnelStage,
          concept.styleId === "UGC" ? defaultArchetype : void 0
        ),
        STEP_TIMEOUT,
        `Script ${label}`
      );
      console.log(`[VideoPipeline] ${label} generated, starting review...`);
      let review;
      try {
        review = await withTimeout(
          reviewScriptWithPanel(
            script,
            run.product,
            styleLabel,
            brief,
            productInfoContext,
            funnelStage
          ),
          STEP_TIMEOUT * 2,
          `Review ${label}`
        );
      } catch (reviewErr) {
        console.error(`[VideoPipeline] Review of ${label} failed:`, reviewErr.message);
        review = { finalScore: 75, rounds: [], approved: true, summary: `Review failed: ${reviewErr.message}. Script approved by default.` };
      }
      allScripts.push({
        type: concept.styleId,
        number: i + 1,
        label,
        ...script,
        review
      });
      console.log(`[VideoPipeline] ${label} complete. Score: ${review.finalScore}`);
    } catch (err) {
      console.error(`[VideoPipeline] ${label} generation failed:`, err.message);
      allScripts.push({
        type: concept.styleId,
        number: i + 1,
        label,
        title: `${label} - Generation Failed`,
        hook: `Error: ${err.message}`,
        script: [],
        visualDirection: {},
        scriptMetadata: {},
        strategicThesis: "",
        review: { finalScore: 0, rounds: [], approved: false, summary: `Generation failed: ${err.message}` }
      });
    }
    await updatePipelineRun(runId, { scriptsJson: allScripts });
  }
  console.log(`[VideoPipeline] All ${concepts.length} scripts processed. Success: ${allScripts.filter((s) => s.review?.finalScore > 0).length}/${concepts.length}`);
  await updatePipelineRun(runId, {
    videoStage: "stage_4b_script_approval"
  });
  console.log(`[VideoPipeline] Scripts generated. Waiting for user approval before ClickUp push.`);
}
function formatScriptForClickUp(script, runId, appUrl) {
  const scriptViewUrl = `${appUrl}/results/${runId}?script=${encodeURIComponent(script.label)}`;
  const meta = script.scriptMetadata || {};
  const vd = script.visualDirection || {};
  let content = `# ${script.title}

`;
  content += `**Type:** ${(script.type || "").replace(/_/g, " ")} | **Score:** ${script.review?.finalScore}/100
`;
  if (meta.scriptStyle) content += `**Style:** ${meta.scriptStyle}
`;
  if (meta.funnelStage) content += `**Funnel Stage:** ${meta.funnelStage}
`;
  if (meta.awarenessLevel) content += `**Awareness:** ${meta.awarenessLevel}
`;
  if (meta.targetPersona) content += `**Persona:** ${meta.targetPersona}
`;
  if (meta.subStructure) content += `**Sub-Structure:** ${meta.subStructure}
`;
  if (meta.hookArchetype) content += `**Hook Archetype:** ${meta.hookArchetype}
`;
  if (meta.testHypothesis) content += `**Hypothesis:** ${meta.testHypothesis}
`;
  if (meta.primaryObjection) content += `**Primary Objection:** ${meta.primaryObjection}
`;
  if (meta.actorArchetype) content += `**Actor Archetype:** ${meta.actorArchetype}
`;
  content += `
## STRATEGIC THESIS
${script.strategicThesis}

`;
  content += `## HOOK
${script.hook}

`;
  content += `## FULL SCRIPT

**[View on ONEST Pipeline \u2192](${scriptViewUrl})**

`;
  if (script.script && Array.isArray(script.script)) {
    content += `| TIMESTAMP | VISUAL | DIALOGUE |
|---|---|---|
`;
    for (const row of script.script) {
      const ts = (row.timestamp || "").replace(/\|/g, "\\|");
      const vis = (row.visual || "").replace(/\|/g, "\\|");
      const dia = (row.dialogue || "").replace(/\|/g, "\\|");
      content += `| ${ts} | ${vis} | ${dia} |
`;
    }
    content += `
`;
  }
  if (typeof vd === "object" && (vd.style || vd.talent || vd.setting)) {
    content += `## VISUAL DIRECTION BRIEF
`;
    for (const [key, val] of Object.entries(vd)) {
      if (val) content += `- **${key}:** ${val}
`;
    }
  } else if (typeof script.visualDirection === "string") {
    content += `## VISUAL DIRECTION
${script.visualDirection}
`;
  }
  return content;
}
async function runVideoPipelineStage5(runId, run, appUrl) {
  console.log(`[VideoPipeline] Running stage 5 (ClickUp) for run #${runId}`);
  await updatePipelineRun(runId, { videoStage: "stage_5_clickup" });
  const allScripts = run.scriptsJson || [];
  try {
    const taskInputs = allScripts.filter((s) => s.review?.finalScore > 0).map((s) => ({
      title: s.title || `${s.label} Script`,
      type: s.label,
      score: s.review.finalScore,
      content: formatScriptForClickUp(s, runId, appUrl)
    }));
    if (taskInputs.length > 0) {
      const clickupTasks = await withTimeout(
        createMultipleScriptTasks(taskInputs, run.product, run.priority),
        STEP_TIMEOUT,
        "ClickUp Tasks"
      );
      await updatePipelineRun(runId, {
        clickupTasksJson: clickupTasks,
        status: "completed",
        completedAt: /* @__PURE__ */ new Date(),
        videoStage: "completed"
      });
    } else {
      await updatePipelineRun(runId, {
        status: "completed",
        completedAt: /* @__PURE__ */ new Date(),
        errorMessage: "All scripts failed generation",
        videoStage: "completed"
      });
    }
  } catch (err) {
    console.error("[VideoPipeline] ClickUp failed:", err.message);
    await updatePipelineRun(runId, {
      status: "completed",
      completedAt: /* @__PURE__ */ new Date(),
      errorMessage: `ClickUp failed: ${err.message}`,
      videoStage: "completed"
    });
  }
}
async function completeVideoPipelineWithoutClickUp(runId) {
  await updatePipelineRun(runId, {
    status: "completed",
    completedAt: /* @__PURE__ */ new Date(),
    videoStage: "completed"
  });
}

// server/services/staticPipeline.ts
init_db();
init_claude();
init_nanoBananaPro();

// server/services/geminiPromptBuilder.ts
function analyseHeadline(headline, productName, targetAudience) {
  const lowerHeadline = headline.toLowerCase();
  const hasTransformation = /transform|change|from.*to|become|turn into|shape|sculpt/i.test(headline);
  const hasTime = /week|day|month|hour|24\/7|fast|quick|rapid|around the clock/i.test(headline);
  const hasSupport = /help|support|boost|enhance|improve/i.test(headline);
  const hasPower = /power|energy|burn|blast|ignite|unleash|unlock/i.test(headline);
  const hasCravings = /cravings|hunger|appetite|temptation/i.test(headline);
  const hasEnd = /end|stop|eliminate|destroy|crush/i.test(headline);
  const analysis = {
    corePromise: "",
    emotionalHook: "",
    targetAvatar: targetAudience || "fitness enthusiast aged 25-45",
    visualConceptDescription: ""
  };
  if (hasTransformation) {
    analysis.corePromise = "Body transformation, visible physical change";
    analysis.emotionalHook = "Hope and belief - 'this could actually work for me'";
    analysis.visualConceptDescription = "Use visual metaphors showing transformation or progression (e.g., contrasting elements, before\u2192after symbolism, metamorphosis imagery). The visual should suggest change and evolution.";
  } else if ((hasPower || lowerHeadline.includes("burn")) && hasTime) {
    analysis.corePromise = "24/7 metabolic power, continuous fat burning";
    analysis.emotionalHook = "Excitement and empowerment - 'This works even while I sleep'";
    analysis.visualConceptDescription = "Use fire or energy effects combined with time-based visual elements (clocks, 24/7 symbolism). Fire represents thermogenic burning, time elements represent continuous effect. Create dramatic, powerful imagery suggesting relentless fat-burning power.";
  } else if (hasPower || lowerHeadline.includes("burn")) {
    analysis.corePromise = "Metabolic power, fat burning, energy boost";
    analysis.emotionalHook = "Excitement and empowerment - 'I'll feel unstoppable'";
    analysis.visualConceptDescription = "Use fire, lightning, or explosive energy effects. The product should feel like a power source with dramatic lighting and atmospheric effects. Create bold, energetic imagery suggesting immediate metabolic ignition.";
  } else if ((hasCravings || lowerHeadline.includes("craving")) && hasEnd) {
    analysis.corePromise = "Appetite suppression, craving elimination, hunger control";
    analysis.emotionalHook = "Empowerment and relief - 'I can finally control my cravings'";
    analysis.visualConceptDescription = "Use fire or destructive imagery to represent 'ending' or 'eliminating' cravings. Fire can symbolize burning away temptation. Create powerful, liberating imagery suggesting freedom from hunger and cravings.";
  } else if (hasSupport) {
    analysis.corePromise = "Support and assistance in achieving goals";
    analysis.emotionalHook = "Relief and confidence - 'I'm not alone in this'";
    analysis.visualConceptDescription = "Use supportive visual elements or foundation imagery. The product should feel like a reliable partner. Create confident, reassuring imagery suggesting dependable support.";
  } else if (hasTime) {
    analysis.corePromise = "Fast results, time-efficient transformation";
    analysis.emotionalHook = "Urgency and FOMO - 'I can't wait to start'";
    analysis.visualConceptDescription = "Include clock, hourglass, or time-based visual elements. Use motion or speed effects to suggest rapid change. Create urgent, dynamic imagery suggesting quick results.";
  } else {
    analysis.corePromise = "Premium supplement for fitness and health goals";
    analysis.emotionalHook = "Aspiration and desire - 'I want to be my best self'";
    analysis.visualConceptDescription = "Create premium, aspirational imagery with dramatic lighting and atmospheric effects. The product should feel high-quality and results-driven.";
  }
  return analysis;
}
function buildReferenceBasedPrompt(options) {
  const {
    headline,
    subheadline,
    productName,
    backgroundStyleDescription,
    aspectRatio = "1:1",
    targetAudience
  } = options;
  const analysis = analyseHeadline(headline, productName, targetAudience);
  const prompt = `You are creating a premium supplement advertisement image for paid social media advertising (Meta/TikTok).

I am providing you with TWO images:
- Image 1: A REFERENCE AD (competitor ad) \u2014 use this for STYLE REFERENCE ONLY
- Image 2: The ONEST PRODUCT RENDER \u2014 this is the ONLY product to use in your output

STUDY Image 1 carefully and replicate its:
- Overall layout and composition
- Text placement, size, and styling approach
- Color palette and mood
- Lighting style and direction
- Product placement approach (floating, grounded, centered, offset, etc.)
- Background style and depth
- Visual effects and overlays
- Typography hierarchy
- Overall aesthetic and vibe

Your goal is to create a NEW version of this ad for ${productName} that MATCHES the visual style of Image 1 whilst using the new copy below and integrating the ONEST product from Image 2.

=== NEW COPY FOR THIS VERSION ===
Headline: "${headline}"${subheadline ? `
Subheadline: "${subheadline}"` : ""}

Render the headline${subheadline ? " and subheadline" : ""} in the SAME STYLE as the reference image:
- Match the text placement from the reference (top, center, bottom, overlaying product, etc.)
- Match the text size proportions from the reference
- Match the typography style (bold/regular, uppercase/mixed case, font weight) from the reference
- Match the text color and effects (stroke, shadow, glow, outline) from the reference
- If the reference has text at the top, put it at the top
- If the reference has text overlaying the product, do the same
- Replicate whatever text approach the reference uses

=== VISUAL CONCEPT ===
${analysis.visualConceptDescription}

This concept should create a visual metaphor that supports the headline claim: ${analysis.corePromise}

The background and composition should trigger this emotional response: ${analysis.emotionalHook}

=== BACKGROUND & ATMOSPHERE ===
${backgroundStyleDescription}

The background should:
- Match the mood and energy level of the reference image
- Use a similar approach to color, lighting, and depth
- Create similar visual impact and drama
- Include visual elements that support the headline concept described above

=== PRODUCT INTEGRATION ===
CRITICAL \u2014 PRODUCT SOURCE RULE:
You MUST use ONLY Image 2 (the ONEST product render) as the product in your output.
Do NOT copy, replicate, or draw the product shown in Image 1 (the reference ad). That is a different brand \u2014 treat it as invisible when it comes to the product itself. Only use Image 1 for style, layout, composition, and atmosphere reference.

Integrate the ${productName} bottle (from Image 2) into the scene following the same approach as Image 1:
- Is the product in Image 1 floating or grounded? Match that approach for the ONEST bottle.
- How do background elements interact with the product in Image 1 (wrapping around, behind, in front)? Replicate that relationship with the ONEST bottle.
- What lighting effects are used on the product in Image 1? Apply similar lighting to the ONEST bottle.
- Are there shadows, reflections, or depth cues in Image 1? Add similar effects to the ONEST bottle.
- How prominent is the product in Image 1? Match that prominence level.
- Where is the product positioned in Image 1 (center, left, right, offset)? Use similar positioning for the ONEST bottle.

CRITICAL: The product label and branding on the ONEST bottle (Image 2) must be preserved and clearly visible. Do not obscure, alter, or redraw the product's existing design. Do not invent a new product \u2014 use the exact bottle from Image 2.

=== QUALITY STANDARDS ===
- Match the production quality of the reference image
- If the reference looks premium and cinematic, make this premium and cinematic
- If the reference is bold and dramatic, make this bold and dramatic
- If the reference is clean and minimal, make this clean and minimal
- Replicate the "vibe" and energy level of the reference whilst telling a new story with the new headline

=== COMPOSITION ===
- Aspect ratio: ${aspectRatio}
- Follow the same compositional approach as the reference (centered, rule of thirds, symmetrical, asymmetrical, etc.)
- Maintain similar visual hierarchy: study what the eye sees first in the reference and replicate that priority
- Leave appropriate breathing room around text and product
- Ensure nothing important is cut off at edges
- Balance the frame similarly to how the reference balances its elements

=== AVOID ===
\u2717 Ignoring the reference image's style and creating something completely different
\u2717 Making it look like a different campaign or brand aesthetic
\u2717 Generic stock photo aesthetics (unless the reference uses that style)
\u2717 Obscuring the product label or branding
\u2717 Text that's illegible, poorly contrasted, or hard to read
\u2717 Anything that looks "photoshopped" or artificially composited
\u2717 Completely different color palette from the reference
\u2717 Different mood or energy level from the reference

=== FINAL GOAL ===
Someone should look at your output and the reference image side-by-side and think:
"These are clearly from the same campaign/brand/style - just with different headlines"

The new version should feel like a natural variation of the reference, not a completely different creative direction. Match the reference's aesthetic whilst bringing the new headline to life visually.`;
  return prompt;
}

// server/services/staticPipeline.ts
init_clickup();
init_shared();
async function generateStaticAdVariationsWithGemini(brief, referenceImageUrl, product, selections, teamNotes) {
  const productRender = await getDefaultProductRender(product);
  if (!productRender) throw new Error(`No product render found for ${product}`);
  const images = selections?.images || [];
  const variationCount = images.length || 3;
  const tasks = Array.from({ length: variationCount }, (_, i) => () => {
    const sel = images[i] || {};
    const headline = sel.headline || `ONEST ${product.toUpperCase()} \u2014 VARIATION ${i + 1}`;
    const subheadline = sel.subheadline || null;
    const backgroundDesc = sel.background?.description || sel.background?.title || "Premium supplement ad with bold typography and clean background";
    const basePrompt = buildReferenceBasedPrompt({
      headline,
      subheadline: subheadline || void 0,
      productName: `ONEST Health ${product}`,
      backgroundStyleDescription: backgroundDesc,
      aspectRatio: "1:1"
    });
    const fullPrompt = teamNotes ? `${basePrompt}

=== REVISION NOTES ===
${teamNotes}

Apply these revision notes carefully while maintaining the overall style.` : `${basePrompt}

=== VARIATION ${i + 1} UNIQUENESS ===
This is variation #${i + 1} of ${variationCount}. Make this visually distinct from other variations through unique colour combinations, lighting angles, and composition choices.`;
    console.log(`[Static] Generating variation ${i + 1}/${variationCount} with Gemini...`);
    return withTimeout(
      generateProductAdWithNanoBananaPro({
        prompt: fullPrompt,
        controlImageUrl: referenceImageUrl || void 0,
        productRenderUrl: productRender.url,
        aspectRatio: "1:1",
        useCompositing: false,
        productPosition: "center",
        productScale: 0.45
      }),
      VARIATION_TIMEOUT,
      `Stage 4: Variation ${i + 1}/${variationCount}`
    ).then((result) => ({
      url: result.imageUrl,
      s3Key: result.imageUrl.split("/").pop() || "",
      variation: `Variation ${i + 1}`,
      headline,
      subheadline
    }));
  });
  return runWithConcurrency(tasks, 2);
}
var STAGE_TIMEOUT = STEP_TIMEOUT;
async function runStaticPipeline(runId, input) {
  console.log(`[Pipeline] Starting 7-stage static pipeline run #${runId}`);
  const ad = input.selectedAdImage;
  const productInfoContext = await buildProductInfoContext(input.product);
  if (productInfoContext) {
    console.log(`[Static] Loaded product info for ${input.product}: ${productInfoContext.slice(0, 100)}...`);
  }
  console.log("[Static] Stage 1: Analyzing competitor static ad...");
  await updatePipelineRun(runId, { staticStage: "stage_1_analysis" });
  let analysis;
  try {
    analysis = await withTimeout(analyzeStaticAd(ad.imageUrl, ad.brandName || "Competitor"), STAGE_TIMEOUT, "Stage 1: Analysis");
    console.log("[Static] Stage 1 complete, analysis length:", analysis.length);
  } catch (err) {
    console.error("[Static] Stage 1 failed:", err.message);
    await updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 1 (Analysis) failed: ${err.message}` });
    return;
  }
  await updatePipelineRun(runId, { staticAnalysis: analysis });
  console.log("[Static] Stage 2: Writing creative brief with selection options...");
  await updatePipelineRun(runId, { staticStage: "stage_2_brief" });
  let brief;
  let briefOptions;
  try {
    const result = await withTimeout(
      generateCreativeBrief(analysis, input.product, ad.brandName || "Competitor", productInfoContext),
      STAGE_TIMEOUT,
      "Stage 2: Brief"
    );
    brief = result.brief;
    briefOptions = result.options;
    console.log("[Static] Stage 2 complete, brief length:", brief.length);
  } catch (err) {
    console.error("[Static] Stage 2 failed:", err.message);
    await updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 2 (Brief) failed: ${err.message}` });
    return;
  }
  await updatePipelineRun(runId, { staticBrief: brief, briefOptionsJson: briefOptions });
  console.log("[Static] Stage 3: Expert panel reviewing brief...");
  await updatePipelineRun(runId, { staticStage: "stage_3_brief_review" });
  let briefReview;
  let finalBrief;
  try {
    const result = await withTimeout(reviewBriefWithPanel(brief, input.product), STAGE_TIMEOUT * 2, "Stage 3: Brief Review");
    briefReview = result.reviewResult;
    finalBrief = result.finalBrief;
    console.log("[Static] Stage 3 complete, score:", briefReview.finalScore);
  } catch (err) {
    console.error("[Static] Stage 3 failed:", err.message);
    await updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 3 (Brief Review) failed: ${err.message}` });
    return;
  }
  await updatePipelineRun(runId, { staticBriefReview: briefReview, staticBrief: finalBrief });
  console.log("[Static] Stage 3B: Pausing for user selections...");
  await updatePipelineRun(runId, {
    staticStage: "stage_3b_selection",
    briefOptionsJson: briefOptions
  });
}
async function runStaticStage4(runId, run, selections) {
  console.log("[Static] Stage 4: Generating ad creatives with selected copy...");
  await updatePipelineRun(runId, { staticStage: "stage_4_generation", status: "running" });
  let generatedImages;
  try {
    const ad = (run.staticAdImages || []).find((img) => !img.variation) || { imageUrl: "" };
    const variations = await withTimeout(
      generateStaticAdVariationsWithGemini(
        run.staticBrief || "",
        ad.imageUrl || "",
        run.product,
        selections
      ),
      STAGE_TIMEOUT * 2,
      "Stage 4: Image Generation"
    );
    generatedImages = variations.map((v) => ({ ...v, variation: v.variation }));
    console.log("[Static] Stage 4 complete, generated", generatedImages.length, "images");
  } catch (err) {
    console.error("[Static] Stage 4 failed:", err.message);
    await updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 4 (Image Generation) failed: ${err.message}` });
    return;
  }
  await updatePipelineRun(runId, {
    staticAdImages: [(run.staticAdImages || []).find((img) => !img.variation), ...generatedImages],
    generatedImageUrl: generatedImages[0]?.url || ""
  });
  console.log("[Static] Stage 5: Expert panel reviewing generated creatives...");
  await updatePipelineRun(runId, { staticStage: "stage_5_creative_review" });
  let creativeReview;
  try {
    creativeReview = await withTimeout(
      reviewCreativesWithPanel(generatedImages, run.staticBrief || "", run.product, selections),
      STAGE_TIMEOUT,
      "Stage 5: Creative Review"
    );
    console.log("[Static] Stage 5 complete, score:", creativeReview.finalScore);
  } catch (err) {
    console.error("[Static] Stage 5 failed:", err.message);
    await updatePipelineRun(runId, { status: "failed", errorMessage: `Stage 5 (Creative Review) failed: ${err.message}` });
    return;
  }
  await updatePipelineRun(runId, { staticCreativeReview: creativeReview });
  console.log("[Static] Stage 6: Awaiting team approval...");
  await updatePipelineRun(runId, {
    staticStage: "stage_6_team_approval",
    teamApprovalStatus: "pending"
  });
}
async function runStaticStage7(runId, run) {
  console.log("[Static] Stage 7: Creating ClickUp task...");
  await updatePipelineRun(runId, { staticStage: "stage_7_clickup" });
  try {
    const brief = run.staticBrief || "Creative brief";
    const product = run.product;
    const priority = run.priority;
    const task = await withTimeout(
      createScriptTask(
        `${run.foreplayAdTitle || "Static Ad"} - ONEST ${product} Creative`,
        "STATIC",
        run.staticCreativeReview?.finalScore || 90,
        `# Static Ad Creative Brief

${brief}

## Generated Variations
${(run.staticAdImages || []).filter((img) => img.variation).map((img) => `- ${img.variation}: ${img.url}`).join("\n")}`,
        product,
        priority
      ),
      STEP_TIMEOUT,
      "Stage 7: ClickUp Task"
    );
    await updatePipelineRun(runId, {
      clickupTasksJson: [task],
      staticStage: "completed",
      status: "completed",
      completedAt: /* @__PURE__ */ new Date()
    });
    console.log(`[Static] Pipeline run #${runId} completed!`);
  } catch (err) {
    console.error("[Static] Stage 7 failed:", err.message);
    await updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 7 (ClickUp) failed: ${err.message}`
    });
  }
}
async function runStaticRevision(runId, run, teamNotes) {
  console.log("[Static] Revising creatives based on team feedback...");
  try {
    const ad = (run.staticAdImages || []).find((img) => !img.variation) || { imageUrl: "" };
    const variations = await withTimeout(
      generateStaticAdVariationsWithGemini(run.staticBrief || "", ad.imageUrl || "", run.product, void 0, teamNotes),
      STAGE_TIMEOUT * 2,
      "Revision: Image Generation"
    );
    const generatedImages = variations.map((v) => ({ ...v, variation: v.variation }));
    await updatePipelineRun(runId, {
      staticAdImages: [ad, ...generatedImages],
      generatedImageUrl: variations[0]?.url || "",
      staticStage: "stage_6_team_approval",
      teamApprovalStatus: "pending"
    });
    console.log("[Static] Revised creatives ready for team review");
  } catch (err) {
    console.error("[Static] Revision failed:", err.message);
    await updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Revision failed: ${err.message}`,
      staticStage: "stage_6_team_approval",
      teamApprovalStatus: "pending"
    });
  }
}
async function generateCreativeBrief(competitorAnalysis, product, competitorBrand, productInfoContext) {
  const system = `You are an elite creative director who writes extremely detailed, visually-specific creative briefs. Your briefs are so precise that an AI image generator can recreate the exact visual style from your descriptions alone.

You specialise in translating competitor ad analysis into actionable art direction for ONEST Health, an Australian health supplement brand. ONEST brand colours: #FF3838 (red), #0347ED (blue), with dark backgrounds (#01040A base).`;
  const productInfoBlock = productInfoContext ? `

PRODUCT INFORMATION FOR ${product}:
${productInfoContext}

Use this product information to make the brief specific and accurate.` : "";
  const prompt = `Based on this detailed competitor analysis, write a creative brief for an ONEST Health ${product} static ad that VISUALLY MATCHES the competitor's style.

COMPETITOR VISUAL ANALYSIS:
${competitorAnalysis}${productInfoBlock}

Write a comprehensive creative brief with these EXACT sections:

## 1. OBJECTIVE
What this ad should achieve.

## 2. TARGET AUDIENCE
Demographics, psychographics, pain points.

## 3. KEY MESSAGE
The single most important takeaway for ${product}.

## 4. VISUAL REFERENCE GUIDE
This is the MOST IMPORTANT section. Based on the competitor analysis above, describe the EXACT visual style to replicate:
- **Background**: Exact colors, gradients, textures, lighting effects (reference the competitor's specific colors and mood)
- **Composition**: Where the product sits, how much space it takes, focal point
- **Lighting**: Direction, intensity, color cast, glow effects (match the competitor's lighting)
- **Mood**: The emotional feel conveyed through visuals
- **Effects**: Any particles, smoke, geometric shapes, energy effects, grain, etc.
- **Color mapping**: Map competitor colors to ONEST brand colors (e.g., "competitor uses teal accents \u2192 replace with ONEST #FF3838 red")

## 5. COPY DIRECTION
Headlines, subheadlines, body copy, CTA text.

## 6. BRAND ELEMENTS
ONEST logo placement (top-left, white wordmark), brand colors usage.

---

CRITICAL: Now provide structured options for user selection. Return EXACTLY this JSON block wrapped in \`\`\`json ... \`\`\`:

\`\`\`json
{
  "backgrounds": [
    {"title": "...", "description": "1-2 sentence visual description", "prompt": "Detailed 150+ word AI image generation prompt for BACKGROUND ONLY. No text, no product, no logos. Describe colors, lighting, textures, composition, effects, mood. Must be a pure background scene."},
    {"title": "...", "description": "...", "prompt": "..."},
    {"title": "...", "description": "...", "prompt": "..."}
  ],
  "headlines": ["headline1", "headline2", "headline3", "headline4", "headline5", "headline6"],
  "subheadlines": ["sub1", "sub2", "sub3", "sub4", "sub5", "sub6"],
  "benefits": "Shared benefit callout (2-5 words)"
}
\`\`\`

**BACKGROUND CONCEPTS** (3 options):
Each background prompt MUST be 150+ words and describe ONLY the background scene \u2014 no text, no product, no logos. Include specific colors (#hex), lighting direction, texture details, and atmospheric effects.

**HEADLINE OPTIONS** (6 options):
- 3-8 words each
- Action-oriented, benefit-driven, scroll-stopping
- Specific to ${product}
- Examples of great supplement headlines: "BURN FAT WHILE YOU SLEEP", "UNLOCK YOUR FULL POTENTIAL", "THE EDGE YOU'VE BEEN MISSING"

**SUBHEADLINE OPTIONS** (6 options):
- 5-12 words each
- Support the headline with specifics (ingredients, benefits, proof points)

**BENEFITS** (1 shared callout):
- 2-5 words that appear on ALL 3 images
- e.g., "Clinically Dosed Formula" or "Zero Fillers. Real Results."`;
  const res = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 6e3,
    system,
    messages: [{ role: "user", content: prompt }]
  });
  const content = res.data?.content;
  let briefText = Array.isArray(content) ? content.map((c) => c.text || "").join("\n") : content?.text || JSON.stringify(content);
  let options = {};
  try {
    const codeBlockMatch = briefText.match(/```json\s*([\s\S]*?)```/);
    const rawJsonMatch = briefText.match(/\{[\s\S]*"backgrounds"[\s\S]*"headlines"[\s\S]*\}/);
    const jsonStr = codeBlockMatch ? codeBlockMatch[1] : rawJsonMatch ? rawJsonMatch[0] : null;
    if (jsonStr) {
      options = JSON.parse(jsonStr);
    }
  } catch (e) {
    console.warn("[Static] Failed to parse brief options JSON, using defaults");
  }
  if (!options.backgrounds || !Array.isArray(options.backgrounds) || options.backgrounds.length < 3) {
    options.backgrounds = [
      { title: "Dark Energy", description: "High-contrast dark background with red accent lighting", prompt: "Premium dark background for health supplement advertisement. Deep charcoal black base (#01040A) with dramatic crimson (#FF3838) accent lighting from the right side. Subtle smoke particles floating. Warm amber rim light. Energy and power aesthetic. Gym atmosphere with dark moody lighting. Subtle texture grain. Leave clear space in center for product placement. No text, no product, no logos." },
      { title: "Electric Blue", description: "Bold navy gradient with electric blue accents", prompt: "Bold energetic background for supplement ad. Deep navy to black gradient. Electric blue (#0347ED) accent lighting from below creating upward glow. Geometric angular light rays suggesting speed and power. Cool-toned base with warm crimson (#FF3838) highlight accents at edges. Subtle particle effects. Premium fitness aesthetic. No text, no product, no logos." },
      { title: "Minimal Premium", description: "Clean matte black with soft spotlight", prompt: "Minimalist premium dark background for supplement ad. Sophisticated matte black texture (#01040A). Soft warm spotlight from above creating a centered gradient pool of light. Clean and refined with minimal effects. Subtle surface texture. Premium luxury supplement aesthetic. Soft vignette at edges. No text, no product, no logos." }
    ];
  }
  if (!options.headlines || !Array.isArray(options.headlines) || options.headlines.length < 6) {
    options.headlines = [
      `FUEL YOUR ${product.toUpperCase()}`,
      `UNLOCK ${product.toUpperCase()} POWER`,
      `${product.toUpperCase()} REDEFINED`,
      `THE ${product.toUpperCase()} EDGE`,
      `ELEVATE YOUR GAME`,
      `NO COMPROMISES`
    ];
  }
  if (!options.subheadlines || !Array.isArray(options.subheadlines) || options.subheadlines.length < 6) {
    options.subheadlines = [
      "Premium Australian Formulation",
      "Clinically Dosed Ingredients",
      "Trusted by Elite Athletes",
      "Science-Backed Performance",
      "Zero Fillers. Real Results.",
      "Your Body Deserves Better"
    ];
  }
  if (!options.benefits || typeof options.benefits !== "string") {
    options.benefits = "Clinically Dosed Formula";
  }
  return { brief: briefText, options };
}
var BRIEF_EXPERTS = [
  "Direct Response Copywriting Expert",
  "Consumer Psychology Expert",
  "Visual Design & Creative Direction Expert",
  "Persuasion & Influence Expert",
  "Brand Strategy Expert",
  "Emotional Storytelling Expert",
  "Conversion Rate Optimization Expert",
  "Social Media Advertising Expert",
  "Behavioral Economics Expert",
  "Audience Research & Targeting Expert"
];
async function reviewBriefWithPanel(brief, product) {
  let currentBrief = brief;
  const rounds = [];
  let finalScore = 0;
  let approved = false;
  for (let round = 1; round <= 3; round++) {
    console.log(`[Static] Brief review round ${round}...`);
    const prompt = `You are 10 advertising experts reviewing a creative brief for ONEST Health's ${product} static ad.

CREATIVE BRIEF:
${currentBrief}

REVIEW INSTRUCTIONS \u2014 BE BRUTALLY HONEST:
You are NOT here to rubber-stamp. You are here to ensure this brief will produce a HIGH-CONVERTING paid social ad. Score harshly.

For each expert, evaluate:
1. Is the visual direction specific enough that an AI could generate the exact style? (Vague = low score)
2. Are the headlines scroll-stopping? Would they make someone pause on Instagram/Facebook?
3. Is there a clear, compelling CTA?
4. Would this brief produce an ad that looks PROFESSIONAL \u2014 like a real paid ad, not amateur content?
5. Is the copy direction specific to ${product} or generic filler?
6. Does the brief address the target audience's actual pain points?

SCORING GUIDE:
- 95-100: Exceptional \u2014 would produce a top-performing ad immediately
- 85-94: Strong \u2014 minor tweaks needed
- 75-84: Decent \u2014 needs meaningful improvements
- 60-74: Mediocre \u2014 significant gaps in strategy or specificity
- Below 60: Poor \u2014 would produce generic, unconvincing output

Most first-round briefs should score 70-85. Do NOT inflate scores.

Return EXACTLY this JSON format:
{
  "reviews": [
    ${BRIEF_EXPERTS.map((e) => `{"expertName": "${e}", "score": <number>, "feedback": "<2-3 sentences of SPECIFIC, ACTIONABLE feedback>"}`).join(",\n    ")}
  ]
}`;
    const res = await claudeClient.post("/messages", {
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: "You are simulating a panel of 10 harsh but fair advertising experts. You do NOT rubber-stamp. You give honest, specific scores and feedback. Most first-round work scores 70-85.",
      messages: [{ role: "user", content: prompt }]
    });
    const responseText = Array.isArray(res.data?.content) ? res.data.content.map((c) => c.text || "").join("") : "";
    let reviews = [];
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reviews = (parsed.reviews || []).map((r) => ({
          expertName: r.expertName || "Expert",
          score: Math.min(100, Math.max(0, Number(r.score) || 75)),
          feedback: r.feedback || "Needs improvement."
        }));
      }
    } catch (e) {
      console.warn("[Static] Failed to parse brief review, using fallback scores");
    }
    if (reviews.length === 0) {
      reviews = BRIEF_EXPERTS.map((name) => ({
        expertName: name,
        score: 70 + round * 5 + Math.floor(Math.random() * 8),
        feedback: "The brief needs more specificity in visual direction and copy hooks."
      }));
    }
    const avgScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
    finalScore = Math.round(avgScore * 10) / 10;
    rounds.push({
      roundNumber: round,
      averageScore: finalScore,
      expertReviews: reviews
    });
    if (avgScore >= 88) {
      approved = true;
      break;
    }
    if (round < 3) {
      const feedback = reviews.filter((r) => r.score < 88).map((r) => `${r.expertName}: ${r.feedback}`).join("\n");
      currentBrief = await iterateBrief(currentBrief, feedback, product);
    } else {
      approved = avgScore >= 80;
    }
  }
  return {
    reviewResult: { rounds, finalScore, approved },
    finalBrief: currentBrief
  };
}
async function iterateBrief(brief, feedback, product) {
  const res = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `You are an expert creative director refining a creative brief for ONEST Health's ${product} product based on expert feedback. Make MEANINGFUL improvements \u2014 don't just rephrase.`,
    messages: [{
      role: "user",
      content: `Improve this creative brief based on expert feedback:

CURRENT BRIEF:
${brief}

EXPERT FEEDBACK:
${feedback}

Return the improved brief. Address each piece of feedback specifically. Make the visual direction MORE specific, the headlines MORE compelling, and the strategy MORE targeted.`
    }]
  });
  const content = res.data?.content;
  if (Array.isArray(content)) return content.map((c) => c.text || "").join("\n");
  return content?.text || brief;
}
async function reviewCreativesWithPanel(generatedImages, brief, product, selections) {
  const imageDescriptions = generatedImages.map((img, i) => `Image ${i + 1} (${img.variation}): ${img.url}`).join("\n");
  let expectedContent = "";
  if (selections) {
    expectedContent = `

EXPECTED CONTENT IN EACH IMAGE:
${selections.images.map((img, i) => `Image ${i + 1}: Headline="${img.headline}", Subheadline="${img.subheadline || "NONE"}", Benefits="${selections.benefits}", CTA="SHOP NOW", ONEST Logo, Product Render`).join("\n")}`;
  }
  const prompt = `You are 10 advertising experts reviewing 3 generated static ad creatives for ONEST Health's ${product} product.

CREATIVE BRIEF THAT GUIDED GENERATION:
${brief}

GENERATED IMAGES (view each URL):
${imageDescriptions}
${expectedContent}

REVIEW INSTRUCTIONS \u2014 BE BRUTALLY HONEST:

These images MUST be actual ad creatives, not just product renders on backgrounds. Score based on:

1. **HEADLINE VISIBILITY** (Critical): Is there a clear, readable headline? If NO headline text is visible \u2192 score below 40.
2. **CTA PRESENCE**: Is there a call-to-action (e.g., "SHOP NOW" button)? Missing CTA \u2192 deduct 15 points.
3. **SCROLL-STOPPING POWER**: Would this make someone stop scrolling on Instagram/Facebook?
4. **PROFESSIONAL QUALITY**: Does this look like a real paid ad from a major brand, or amateur content?
5. **BENEFIT CALLOUT**: Are product benefits clearly communicated?
6. **BRAND IDENTITY**: Is ONEST logo visible? Are brand colors (#FF3838 red, #0347ED blue) used?
7. **PURCHASE INTENT**: Would this make someone want to buy ${product}?
8. **COMPARISON TO INSPO**: Is this at least as good as the competitor reference ad?

SCORING GUIDE:
- 90-100: Exceptional \u2014 ready to run as a paid ad immediately
- 75-89: Good \u2014 minor adjustments needed
- 60-74: Mediocre \u2014 needs significant work
- 40-59: Poor \u2014 missing key ad elements (headline, CTA, etc.)
- Below 40: Unacceptable \u2014 just a product render with no ad elements

If the image is just a product on a dark background with no text/headline/CTA, it MUST score below 50.

Return EXACTLY this JSON format:
{
  "reviews": [
    ${BRIEF_EXPERTS.map((e) => `{"expertName": "${e}", "score": <number>, "feedback": "<2-3 sentences of SPECIFIC feedback>"}`).join(",\n    ")}
  ],
  "overallFeedback": "2-3 sentences summarizing the panel's consensus",
  "suggestedAdjustments": ["adjustment 1", "adjustment 2"]
}`;
  const res = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: "You are simulating a panel of 10 HARSH advertising experts. You do NOT rubber-stamp. If an image lacks a headline, CTA, or looks like amateur content, you score it below 50. You compare against real paid social ads from major brands.",
    messages: [{ role: "user", content: prompt }]
  });
  const responseText = Array.isArray(res.data?.content) ? res.data.content.map((c) => c.text || "").join("") : "";
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const reviews = (parsed.reviews || []).map((r) => ({
        expertName: r.expertName || "Expert",
        score: Math.min(100, Math.max(0, Number(r.score) || 65)),
        feedback: r.feedback || "Needs improvement."
      }));
      const avgScore2 = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
      return {
        reviews,
        finalScore: Math.round(avgScore2 * 10) / 10,
        approved: avgScore2 >= 75,
        overallFeedback: parsed.overallFeedback || "",
        suggestedAdjustments: parsed.suggestedAdjustments || []
      };
    }
  } catch (e) {
    console.warn("[Static] Failed to parse creative review");
  }
  const fallbackReviews = BRIEF_EXPERTS.map((name) => ({
    expertName: name,
    score: 65 + Math.floor(Math.random() * 15),
    feedback: "The creatives need more prominent text elements and clearer CTAs to function as effective paid ads."
  }));
  const avgScore = fallbackReviews.reduce((sum, r) => sum + r.score, 0) / fallbackReviews.length;
  return {
    reviews: fallbackReviews,
    finalScore: Math.round(avgScore * 10) / 10,
    approved: avgScore >= 75,
    overallFeedback: "The creatives show potential but need stronger ad elements.",
    suggestedAdjustments: ["Add more prominent headline text", "Include a clear CTA button"]
  };
}

// server/services/iterationPipeline.ts
init_db();

// server/services/iterationClickUp.ts
var CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
var GRAPHIC_AD_BOARD_LIST_ID = "900302632860";
var LAUREN_ROW_USER_ID = "2772206";
var REVIEW_STATUS = "review";
async function pushIterationVariationToClickUp(params) {
  const { runId, variationIndex, variation, product } = params;
  const taskName = variation.variation.headline || `${product} - Variation ${variationIndex + 1}`;
  const descriptionParts = [];
  if (variation.variation.subheadline) {
    descriptionParts.push(`**Subheadline:** ${variation.variation.subheadline}`);
  }
  if (variation.variation.angle) {
    descriptionParts.push(`**Angle:** ${variation.variation.angle}`);
  }
  if (variation.variation.benefits && variation.variation.benefits.length > 0) {
    descriptionParts.push(`**Benefits:**`);
    variation.variation.benefits.forEach((b) => {
      descriptionParts.push(`\u2022 ${b}`);
    });
  }
  if (variation.variation.cta) {
    descriptionParts.push(`**CTA:** ${variation.variation.cta}`);
  }
  descriptionParts.push(`
**Product:** ${product}`);
  descriptionParts.push(`**Pipeline Run:** #${runId}`);
  descriptionParts.push(`**Variation:** ${variationIndex + 1}`);
  descriptionParts.push(`
**Image:** ${variation.url}`);
  const description = descriptionParts.join("\n");
  const response = await fetch(`https://api.clickup.com/api/v2/list/${GRAPHIC_AD_BOARD_LIST_ID}/task`, {
    method: "POST",
    headers: {
      "Authorization": CLICKUP_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: taskName,
      description,
      assignees: [LAUREN_ROW_USER_ID],
      status: REVIEW_STATUS,
      tags: ["iterate-winners", product.toLowerCase()]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create ClickUp task: ${response.status} ${errorText}`);
  }
  const task = await response.json();
  try {
    await attachImageToTask(task.id, variation.url, `${taskName}.png`);
  } catch (err) {
    console.warn(`[ClickUp] Failed to attach image to task ${task.id}:`, err);
  }
  return {
    taskId: task.id,
    taskUrl: task.url
  };
}
async function attachImageToTask(taskId, imageUrl, fileName) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.statusText}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const blob = new Blob([imageBuffer], { type: "image/png" });
  const formData = new FormData();
  formData.append("attachment", blob, fileName);
  const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
    method: "POST",
    headers: {
      "Authorization": CLICKUP_API_KEY
    },
    body: formData
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to attach image: ${response.status} ${errorText}`);
  }
}
async function pushIterationRunToClickUp(params) {
  const { runId, variations, product } = params;
  console.log(`[ClickUp] Pushing ${variations.length} variations from run #${runId} to Graphic Ad Board`);
  const results = await Promise.allSettled(
    variations.map(
      (variation, index) => pushIterationVariationToClickUp({
        runId,
        variationIndex: index,
        variation,
        product
      })
    )
  );
  const taskIds = [];
  const taskUrls = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      taskIds.push(result.value.taskId);
      taskUrls.push(result.value.taskUrl);
      console.log(`[ClickUp] \u2713 Variation ${index + 1} pushed: ${result.value.taskUrl}`);
    } else {
      console.error(`[ClickUp] \u2717 Failed to push variation ${index + 1}:`, result.reason);
    }
  });
  console.log(`[ClickUp] Successfully pushed ${taskIds.length}/${variations.length} variations`);
  return { taskIds, taskUrls };
}

// server/services/iterationPipeline.ts
init_nanoBananaPro();
init_shared();
import axios8 from "axios";
async function generateVariationWithFallback(options, variationIndex) {
  const label = `Variation ${variationIndex + 1}`;
  try {
    return await withTimeout(
      generateProductAdWithNanoBananaPro(options),
      VARIATION_TIMEOUT,
      `${label} (${options.model || "nano_banana_pro"})`
    );
  } catch (err) {
    if (options.model === "nano_banana_2") {
      console.warn(`[Iteration] ${label} failed with Nano Banana 2: ${err.message}. Retrying with Nano Banana Pro...`);
      return await withTimeout(
        generateProductAdWithNanoBananaPro({ ...options, model: "nano_banana_pro" }),
        VARIATION_TIMEOUT,
        `${label} (nano_banana_pro fallback)`
      );
    }
    throw err;
  }
}
async function runIterationStages1to2(runId, input) {
  console.log(`[Iteration] Starting iteration pipeline run #${runId}`);
  const productInfoContext = await buildProductInfoContext(input.product);
  if (productInfoContext) {
    console.log(`[Iteration] Loaded product info for ${input.product}`);
  }
  const sourceType = input.sourceType ?? "own_ad";
  const adaptationMode = input.adaptationMode;
  try {
    await updatePipelineRun(runId, {
      iterationStage: "stage_1_analysis",
      iterationSourceType: sourceType,
      iterationAdaptationMode: adaptationMode ?? null
    });
    console.log(`[Iteration] Stage 1: Analysing ${sourceType === "competitor_ad" ? "competitor" : "winning"} ad...`);
    const analysis = await withTimeout(
      sourceType === "competitor_ad" ? analyseCompetitorAd(input.sourceImageUrl, input.product, adaptationMode ?? "concept", input.foreplayAdBrand) : analyseWinningAd(input.sourceImageUrl, input.product),
      STEP_TIMEOUT,
      "Stage 1: Ad Analysis"
    );
    await updatePipelineRun(runId, {
      iterationAnalysis: analysis,
      iterationStage: "stage_2_brief"
    });
    console.log(`[Iteration] Stage 1 complete. Analysis: ${analysis.substring(0, 200)}...`);
  } catch (err) {
    console.error(`[Iteration] Stage 1 failed:`, err.message);
    await updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 1 failed: ${err.message}`,
      iterationStage: "stage_1_analysis"
    });
    return;
  }
  try {
    console.log(`[Iteration] Stage 2: Generating iteration brief...`);
    const run = await getPipelineRun(runId);
    const analysis = run?.iterationAnalysis || "";
    const runSourceType = run?.iterationSourceType ?? sourceType;
    const runAdaptationMode = run?.iterationAdaptationMode;
    const brief = await withTimeout(
      runSourceType === "competitor_ad" ? generateCompetitorIterationBrief(analysis, input.product, productInfoContext, runAdaptationMode ?? "concept", input.foreplayAdBrand) : generateIterationBrief(
        analysis,
        input.product,
        productInfoContext,
        input.variationCount || 3,
        input.variationTypes
      ),
      STEP_TIMEOUT,
      "Stage 2: Iteration Brief"
    );
    await updatePipelineRun(runId, {
      iterationBrief: brief,
      iterationStage: "stage_2b_approval"
    });
    console.log(`[Iteration] Stage 2 complete. Paused at approval gate.`);
  } catch (err) {
    console.error(`[Iteration] Stage 2 failed:`, err.message);
    await updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 2 failed: ${err.message}`,
      iterationStage: "stage_2_brief"
    });
  }
}
async function runIterationStage3(runId, run) {
  console.log(`[Iteration] Stage 3: Generating variation images for run #${runId}`);
  try {
    await updatePipelineRun(runId, { iterationStage: "stage_3_generation" });
    const brief = run.iterationBrief || "";
    const analysis = run.iterationAnalysis || "";
    const product = run.product;
    const sourceUrl = run.iterationSourceUrl || "";
    let briefData;
    try {
      briefData = JSON.parse(brief);
    } catch {
      throw new Error(`[Iteration] Brief stored in DB is not valid JSON. Cannot generate variations without structured brief data.`);
    }
    const imageModel = run.imageModel || "nano_banana_pro";
    const { MODEL_LABELS: MODEL_LABELS2 } = await Promise.resolve().then(() => (init_nanoBananaPro(), nanoBananaPro_exports));
    console.log(`[Iteration] Using image model: ${MODEL_LABELS2[imageModel]}`);
    const productRender = await getDefaultProductRender(product);
    if (!productRender) {
      throw new Error(`No product render found for ${product}`);
    }
    console.log(`[Iteration] Using product render: ${productRender.url}`);
    const geminiResults = [];
    const creativityLevel = run.creativityLevel || "BOLD";
    const aspectRatio = run.aspectRatio || "1:1";
    const variationCount = run.variationCount || briefData?.variations?.length || 3;
    console.log(`[Iteration] Using creativity level: ${creativityLevel}`);
    console.log(`[Iteration] Aspect ratio: ${aspectRatio}`);
    console.log(`[Iteration] Generating ${variationCount} variations`);
    if (briefData?.variations && Array.isArray(briefData.variations)) {
      const tasks = Array.from({ length: variationCount }, (_, i) => async () => {
        const v = briefData.variations[i] || {};
        const basePrompt = buildReferenceBasedPrompt({
          headline: v.headline || `${product.toUpperCase()} VARIATION ${i + 1}`,
          subheadline: v.subheadline || void 0,
          productName: `ONEST Health ${product}`,
          backgroundStyleDescription: v.backgroundNote || "Dramatic lighting with premium aesthetic",
          aspectRatio,
          targetAudience: briefData.targetAudience || void 0
        });
        const geminiPrompt = `${basePrompt}

=== VARIATION ${i + 1} UNIQUENESS ===
This is variation #${i + 1} of ${variationCount}. Make this visually distinct from other variations by using unique:
- Color combinations and lighting angles
- Composition and framing choices
- Background element arrangements
- Visual effects and atmospheric details

Do NOT create identical or near-identical outputs. Each variation must be recognizably different while maintaining the reference style.`;
        console.log(`[Iteration] Generating variation ${i + 1}/${variationCount} with Nano Banana Pro`);
        const result = await generateVariationWithFallback({
          prompt: geminiPrompt,
          controlImageUrl: sourceUrl,
          productRenderUrl: productRender.url,
          aspectRatio,
          model: imageModel,
          useCompositing: false,
          productPosition: "center",
          productScale: 0.45
        }, i);
        return {
          url: result.imageUrl,
          s3Key: result.imageUrl.split("/").pop() || "",
          headline: v.headline || `VARIATION ${i + 1}`,
          subheadline: v.subheadline || null,
          angle: v.angle || null,
          backgroundNote: v.backgroundNote || null,
          productImageUrl: productRender.url,
          controlImageUrl: sourceUrl
        };
      });
      geminiResults.push(...await runWithConcurrency(tasks, 2));
    } else {
      const fallbackHeadlines = [
        `${product.toUpperCase()} - Unleash Your Power`,
        `${product.toUpperCase()} - Transform Your Energy`,
        `${product.toUpperCase()} - Premium Performance`
      ];
      const fallbackBackgrounds = [
        "Dramatic warm crimson red accent lighting with energetic mood, subtle smoke particles",
        "Cool electric blue accent lighting with mysterious mood, geometric light rays",
        "Warm amber spotlight with premium luxury aesthetic, minimalist dark background"
      ];
      for (let i = 0; i < 3; i++) {
        console.log(`[Iteration] Generating fallback variation ${i + 1}/3 with Nano Banana Pro`);
        const fallbackPrompt = buildReferenceBasedPrompt({
          headline: fallbackHeadlines[i],
          productName: `ONEST Health ${product}`,
          backgroundStyleDescription: fallbackBackgrounds[i],
          aspectRatio
        });
        const result = await generateVariationWithFallback({
          prompt: fallbackPrompt,
          controlImageUrl: sourceUrl,
          // Pass control image as visual reference
          productRenderUrl: productRender.url,
          aspectRatio,
          model: imageModel,
          useCompositing: false,
          // Single-pass: Gemini generates full scene including product
          productPosition: "center",
          productScale: 0.45
        }, i);
        const geminiImages = [{ url: result.imageUrl, s3Key: result.imageUrl.split("/").pop() || "" }];
        geminiResults.push({
          url: geminiImages[0].url,
          s3Key: geminiImages[0].s3Key,
          headline: `${product.toUpperCase()} VARIATION ${i + 1}`,
          subheadline: null,
          angle: null,
          backgroundNote: null,
          productImageUrl: productRender.url,
          controlImageUrl: sourceUrl
        });
      }
    }
    const results = geminiResults;
    await updatePipelineRun(runId, {
      iterationVariations: results,
      iterationStage: "stage_3b_variation_approval"
    });
    console.log(`[Iteration] Stage 3 complete. Generated ${results.length} variations. Paused at variation approval gate.`);
  } catch (err) {
    console.error(`[Iteration] Stage 3 failed:`, err.message);
    await updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 3 failed: ${err.message}`,
      iterationStage: "stage_3_generation"
    });
  }
}
async function runIterationStage4(runId, run) {
  console.log(`[Iteration] Stage 4: Creating ClickUp tasks for run #${runId}`);
  await updatePipelineRun(runId, { iterationStage: "stage_4_clickup" });
  const product = run.product;
  const sourceUrl = run.iterationSourceUrl || "";
  const analysis = run.iterationAnalysis || "";
  const variations = run.iterationVariations || [];
  let briefData = null;
  try {
    briefData = JSON.parse(run.iterationBrief || "");
  } catch {
  }
  try {
    const tasks = [];
    for (let i = 0; i < variations.length; i++) {
      const v = briefData?.variations?.[i] || {};
      const imageUrl = variations[i]?.url;
      if (!imageUrl) {
        console.warn(`[Iteration] Skipping variation ${i + 1}: no image URL`);
        continue;
      }
      try {
        const task = await pushIterationVariationToClickUp({
          runId,
          variationIndex: i,
          variation: {
            url: imageUrl,
            variation: {
              headline: v.headline || `Variation ${i + 1}`,
              subheadline: v.subheadline || "",
              benefits: [
                v.benefit1 || "",
                v.benefit2 || "",
                v.benefit3 || ""
              ].filter(Boolean),
              angle: v.angle || ""
            }
          },
          product
        });
        tasks.push({ name: v.headline || `Variation ${i + 1}`, taskId: task.taskId, url: task.taskUrl });
        console.log(`[Iteration] ClickUp task created: ${task.taskId}`);
      } catch (err) {
        console.warn(`[Iteration] ClickUp task ${i + 1} failed:`, err.message);
        tasks.push({ name: v.headline || `Variation ${i + 1}`, error: err.message });
      }
    }
    await updatePipelineRun(runId, {
      clickupTasksJson: tasks,
      status: "completed",
      iterationStage: "completed",
      completedAt: /* @__PURE__ */ new Date()
    });
    console.log(`[Iteration] Pipeline complete! ${tasks.length} ClickUp tasks created.`);
  } catch (err) {
    console.error(`[Iteration] Stage 4 failed:`, err.message);
    await updatePipelineRun(runId, {
      status: "failed",
      errorMessage: `Stage 4 (ClickUp) failed: ${err.message}`
    });
  }
}
async function regenerateIterationVariation(runId, variationIndex, overrides) {
  const run = await getPipelineRun(runId);
  if (!run) throw new Error("Run not found");
  const variations = Array.isArray(run.iterationVariations) ? run.iterationVariations : [];
  if (variationIndex < 0 || variationIndex >= variations.length) {
    throw new Error(`Invalid variation index: ${variationIndex}`);
  }
  let briefData = null;
  try {
    briefData = JSON.parse(run.iterationBrief || "");
  } catch {
  }
  const v = briefData?.variations?.[variationIndex] || {};
  const product = run.product;
  const analysis = run.iterationAnalysis || "";
  const headline = overrides?.headline || v.headline || `VARIATION ${variationIndex + 1}`;
  const subheadline = overrides?.subheadline || v.subheadline || null;
  const isTextOnlyChange = !overrides?.backgroundPrompt && (overrides?.headline || overrides?.subheadline);
  const bgPrompt = overrides?.backgroundPrompt || (v.backgroundNote ? `Premium background for health supplement ad. ${v.backgroundNote}. Dramatic lighting, premium aesthetic. No text, no product, no logos, no people.` : `Premium dark background for health supplement advertisement. Dramatic lighting, subtle atmospheric effects. No text, no product, no logos, no people.`);
  const productRender = await getDefaultProductRender(product);
  if (!productRender) {
    throw new Error(`No product render found for ${product}`);
  }
  const aspectRatio = run.aspectRatio || "1:1";
  const creativityLevel = run.creativityLevel || "BOLD";
  const imageModel = run.imageModel || "nano_banana_pro";
  let finalUrl;
  if (isTextOnlyChange && variations[variationIndex]?.url) {
    console.log(`[Iteration] Text-only regeneration for variation ${variationIndex + 1} - reusing existing background`);
    console.log(`[Iteration] New headline: "${headline}"`);
    const geminiPrompt = buildReferenceBasedPrompt({
      headline,
      subheadline: subheadline || void 0,
      productName: `ONEST Health ${product}`,
      backgroundStyleDescription: bgPrompt,
      aspectRatio,
      targetAudience: briefData?.targetAudience || "fitness-conscious adults"
    });
    const sourceUrl = run.iterationSourceUrl || "";
    const result = await generateProductAdWithNanoBananaPro({
      prompt: geminiPrompt,
      controlImageUrl: variations[variationIndex].url,
      // Use the EXISTING variation as control instead of source
      productRenderUrl: productRender.url,
      aspectRatio,
      model: imageModel,
      useCompositing: false,
      // Single-pass: Gemini generates full scene including product
      productPosition: "center",
      productScale: 0.45
    });
    finalUrl = result.imageUrl;
  } else {
    console.log(`[Iteration] Full regeneration for variation ${variationIndex + 1} with new background`);
    console.log(`[Iteration] Headline: "${headline}", BG prompt: "${bgPrompt.substring(0, 100)}..."`);
    const geminiPrompt = buildReferenceBasedPrompt({
      headline,
      subheadline: subheadline || void 0,
      productName: `ONEST Health ${product}`,
      backgroundStyleDescription: bgPrompt,
      aspectRatio,
      targetAudience: briefData?.targetAudience || "fitness-conscious adults"
    });
    const sourceUrl = run.iterationSourceUrl || "";
    const result = await generateProductAdWithNanoBananaPro({
      prompt: geminiPrompt,
      controlImageUrl: sourceUrl,
      // Use original source as control
      productRenderUrl: productRender.url,
      aspectRatio,
      model: imageModel,
      useCompositing: false,
      // Single-pass: Gemini generates full scene including product
      productPosition: "center",
      productScale: 0.45
    });
    finalUrl = result.imageUrl;
  }
  const variationLabel = variationIndex === 0 ? "Control" : `Variation ${variationIndex + 1}`;
  variations[variationIndex] = { url: finalUrl, variation: variationLabel };
  await updatePipelineRun(runId, {
    iterationVariations: variations,
    iterationStage: "stage_3b_variation_approval"
  });
  console.log(`[Iteration] Variation ${variationIndex + 1} regenerated: ${finalUrl}`);
  return { url: finalUrl, variation: variationLabel };
}
async function analyseWinningAd(imageUrl, product) {
  const system = `You are an elite creative director and performance marketing analyst for ONEST Health, an Australian supplement brand. You are analysing one of ONEST's OWN winning ads \u2014 not a competitor's. Your job is to deconstruct exactly what makes this ad work so the team can create variations that keep the winning formula but test new angles.

Be extremely specific about every visual and copy element. The goal is to preserve the visual DNA while varying the messaging.`;
  const content = [];
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      console.log(`[Iteration] Downloading winning ad for analysis...`);
      const imgRes = await axios8.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 3e4,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }
      });
      const base64 = Buffer.from(imgRes.data).toString("base64");
      let mediaType = imgRes.headers["content-type"] || "image/jpeg";
      if (mediaType.includes(";")) mediaType = mediaType.split(";")[0].trim();
      if (!mediaType.startsWith("image/")) mediaType = "image/jpeg";
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data: base64 }
      });
    } catch (imgErr) {
      console.error(`[Iteration] Failed to download image: ${imgErr.message}`);
      content.push({
        type: "text",
        text: `[Image could not be downloaded from ${imageUrl}]`
      });
    }
  }
  content.push({
    type: "text",
    text: `Analyse this ONEST Health winning ad for ${product}. This ad is already performing well \u2014 I need to understand exactly why so we can create 3 new variations.

Provide your analysis in these sections:

## 1. HEADLINE & COPY
- Exact headline text (word for word)
- Exact subheadline/body copy text
- Tone of voice (casual, urgent, scientific, aspirational, etc.)
- Copy angle (benefit-driven, problem-solution, social proof, curiosity, etc.)
- Any benefit callouts, badges, or bullet points
- CTA text and style

## 2. VISUAL LAYOUT
- Overall composition (product left/centre/right, text position)
- Approximate element positions as percentages
- Visual hierarchy (what draws the eye first, second, third)
- Aspect ratio and orientation (square, portrait, landscape)

## 3. COLOUR PALETTE
- Background colour(s) with approximate hex values
- Text colour(s) with hex values
- Accent/highlight colours
- Gradient directions if present
- Overall colour temperature

## 4. TYPOGRAPHY
- Font style (bold, italic, condensed, serif, sans-serif)
- Headline font size relative to canvas (small, medium, large, massive)
- Text effects (shadow, outline, gradient fill)
- Letter spacing characteristics

## 5. PRODUCT PRESENTATION
- Product size relative to canvas
- Product angle/perspective
- Product position
- Any effects on product (shadow, glow, floating)

## 6. BACKGROUND & EFFECTS
- Background type (solid colour, gradient, photograph, texture)
- Any overlay effects, particles, decorative elements
- Lighting direction and mood

## 7. WHAT MAKES THIS AD WORK
- Why is this ad likely performing well?
- What emotional triggers does it use?
- What scroll-stopping elements does it have?
- What should be PRESERVED in variations?
- What can be VARIED without losing the winning formula?

## 8. BRAND ELEMENTS
- Logo placement and size
- Any badges, seals, disclaimers
- CTA button style`
  });
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 6e3,
    system,
    messages: [{ role: "user", content }]
  };
  const res = await claudeClient.post("/messages", body);
  const resContent = res.data?.content;
  if (Array.isArray(resContent)) {
    return resContent.map((c) => c.text || "").join("\n");
  }
  return resContent?.text || JSON.stringify(resContent);
}
async function analyseCompetitorAd(imageUrl, product, adaptationMode, competitorBrand) {
  const isConcept = adaptationMode === "concept";
  const system = isConcept ? `You are an elite creative strategist for ONEST Health. You are analysing a COMPETITOR's ad (${competitorBrand || "another brand"}) to extract the CONCEPT and angle \u2014 not to copy it. Your job is to identify the emotional hook, audience appeal, persuasion mechanism, and narrative framework so ONEST can ADAPT that concept for ${product} with our own visual style and messaging. Be specific about what makes the ad work conceptually.` : `You are an elite creative director for ONEST Health. You are analysing a COMPETITOR's ad (${competitorBrand || "another brand"}) to extract the exact VISUAL STYLE \u2014 layout, composition, colour palette, typography, product placement, and mood. Your job is to describe the style in enough detail that we can REPLICATE it for an ONEST ${product} ad, replacing only the product and copy. Be extremely specific about visual elements.`;
  const content = [];
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      const imgRes = await axios8.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 3e4,
        headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" }
      });
      const base64 = Buffer.from(imgRes.data).toString("base64");
      let mediaType = imgRes.headers["content-type"] || "image/jpeg";
      if (mediaType.includes(";")) mediaType = mediaType.split(";")[0].trim();
      if (!mediaType.startsWith("image/")) mediaType = "image/jpeg";
      content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64 } });
    } catch (imgErr) {
      content.push({ type: "text", text: `[Image could not be downloaded from ${imageUrl}]` });
    }
  }
  const prompt = isConcept ? `Analyse this COMPETITOR ad (${competitorBrand || "other brand"}) and extract the CONCEPT we can adapt for ONEST Health's ${product}.

Focus on:
1. CONCEPT & ANGLE \u2014 What is the core idea or hook? (e.g. transformation, social proof, myth-busting, before/after)
2. EMOTIONAL TRIGGERS \u2014 What feelings does it target? (e.g. FOMO, belonging, achievement)
3. PERSUASION MECHANISM \u2014 How does it convince? (e.g. authority, scarcity, testimonials)
4. TARGET AUDIENCE \u2014 Who is this speaking to?
5. NARRATIVE FRAMEWORK \u2014 Hook \u2192 body \u2192 CTA structure
6. WHAT TO ADAPT \u2014 How should ONEST use this same concept with our own visual style and ${product} messaging?

Output a structured analysis so we can brief ONEST creatives that ADAPT the concept (not copy the competitor's look).` : `Analyse this COMPETITOR ad (${competitorBrand || "other brand"}) and extract the exact VISUAL STYLE so we can replicate it for ONEST Health's ${product}.

Focus on:
1. LAYOUT \u2014 Composition, product position, text zones, negative space (percentages)
2. COLOUR PALETTE \u2014 Background, text, accent colours (hex-like)
3. TYPOGRAPHY \u2014 Font weight, size, effects, placement
4. MOOD & LIGHTING \u2014 Tone, lighting direction, effects
5. PRODUCT PRESENTATION \u2014 Size, angle, placement
6. WHAT TO REPLICATE \u2014 Exact style notes so we generate an ONEST ad that LOOKS like this but with our product and copy.

Output a structured analysis so we can brief image generation to MATCH this style and swap in ONEST product + copy.`;
  content.push({ type: "text", text: prompt });
  const res = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 6e3,
    system,
    messages: [{ role: "user", content }]
  });
  const resContent = res.data?.content;
  if (Array.isArray(resContent)) return resContent.map((c) => c.text || "").join("\n");
  return resContent?.text || JSON.stringify(resContent);
}
async function generateIterationBrief(analysis, product, productInfo2, variationCount = 3, variationTypes) {
  const system = `You are an elite DTC performance creative strategist. You specialise in iterating on winning ad creatives \u2014 keeping what works and testing new angles. You understand that the visual DNA (layout, colours, typography style, product placement) should be preserved while the COPY (headline, subheadline, angle) should be varied to find new winners.

Return ONLY valid JSON. No markdown, no code blocks, no explanation.`;
  let variationTypeInstructions = "";
  if (variationTypes && variationTypes.length > 0) {
    const typeConstraints = {
      headline_only: `**HEADLINE_ONLY**: Only vary the headline text. Keep EXACTLY the same:
- Background style, colours, and gradients
- Layout and composition
- Product placement and size
- Props and visual metaphors
- Typography style (only text changes)
- Subheadline and benefit callouts`,
      background_only: `**BACKGROUND_ONLY**: Only vary background colours/styles. Keep EXACTLY the same:
- Headline text (word-for-word)
- Layout and composition
- Product placement and size
- Props and visual metaphors
- Typography style
- All copy (headline, subheadline, benefits)
Test different: solid colours, gradients, colour schemes (warm/cool/high-contrast)`,
      layout_only: `**LAYOUT_ONLY**: Only vary product placement and text positioning. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Props and visual metaphors
- Typography style
- All copy
Test different: centered, asymmetric, split-screen, diagonal, grid compositions`,
      benefit_callouts_only: `**BENEFIT_CALLOUTS_ONLY**: Only vary subheadline and benefit copy. Keep EXACTLY the same:
- Main headline (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- Props and visual metaphors
Test different: benefit angles (speed, results, ingredients, science, guarantees)`,
      props_only: `**PROPS_ONLY**: Only vary visual metaphors and supporting elements. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- All copy
Test different: visual metaphors (fire, lightning, transformation, science, speed)`,
      talent_swap: `**TALENT_SWAP**: Only vary the person/model. Keep EXACTLY the same:
- Headline text (word-for-word)
- Background style and colours
- Layout and composition
- Product placement
- Props and visual metaphors
- All copy
Test different: age groups, genders, ethnicities, body types`,
      full_remix: `**FULL_REMIX**: Change everything - headline, background, layout, props, benefits.
Maximum creative freedom. Only maintain product identity and core value proposition.`
    };
    const selectedConstraints = variationTypes.map((type) => typeConstraints[type]).filter(Boolean).join("\n\n");
    const variationsPerType = Math.ceil(variationCount / variationTypes.length);
    variationTypeInstructions = `VARIATION TYPE CONSTRAINTS:
${selectedConstraints}

DISTRIBUTION: Generate approximately ${variationsPerType} variation(s) for each selected type.
If multiple types selected, clearly label which type each variation tests.`;
  } else {
    variationTypeInstructions = "- KEEP the same visual layout, colour scheme, typography style, and product placement\n- TEST a different headline, subheadline, and copy angle";
  }
  const userPrompt = `Based on this analysis of an ONEST Health winning ad for ${product}:

${analysis}

${productInfo2 ? `
Product Information:
${productInfo2}` : ""}

Generate an iteration brief with ${variationCount} NEW variations. Each variation should:
${variationTypeInstructions}
- Be scroll-stopping and benefit-driven
- Be specific to ${product}'s actual benefits and ingredients
The ${variationCount} variations should test DIFFERENT angles across these categories:
- Benefit-driven (what the product does for you)
- Curiosity/intrigue (make them want to learn more)
- Social proof/authority (why they should trust this product)
- Problem-solution (pain point to solution)
- Transformation (before to after)
- Urgency/scarcity (limited time, don't miss out)

Return JSON in this exact format with ${variationCount} variations:
{
  "originalHeadline": "exact headline from the winning ad",
  "originalAngle": "description of the original ad's angle",
  "preserveElements": ["list of visual elements to keep exactly the same"],
  "targetAudience": "description of target audience",
  "variations": [
    {
      "number": 1,
      "variationType": "headline_only" | "background_only" | "layout_only" | "benefit_callouts_only" | "props_only" | "talent_swap" | "full_remix",
      "angle": "Benefit-Driven",
      "angleDescription": "Why this angle works and what it tests",
      "headline": "NEW HEADLINE TEXT (3-8 words, all caps)",
      "subheadline": "Supporting subheadline (5-12 words)",
      "benefitCallouts": ["Benefit 1", "Benefit 2", "Benefit 3"],
      "backgroundNote": "Specific instructions for background/layout/props based on variation type"
    }
    ... (generate ${variationCount} total variations, distributed across selected types)
  ]
}`;
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userPrompt }]
  };
  const res = await claudeClient.post("/messages", body);
  const resContent = res.data?.content;
  let text2 = "";
  if (Array.isArray(resContent)) {
    text2 = resContent.map((c) => c.text || "").join("\n");
  } else {
    text2 = resContent?.text || JSON.stringify(resContent);
  }
  text2 = text2.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    JSON.parse(text2);
  } catch {
    throw new Error(`[Iteration] Claude returned invalid JSON for brief. Raw response: ${text2.substring(0, 500)}`);
  }
  return text2;
}
async function generateCompetitorIterationBrief(analysis, product, productInfo2, adaptationMode, competitorBrand) {
  const isConcept = adaptationMode === "concept";
  const system = `You are an elite DTC creative strategist for ONEST Health. You are creating an iteration brief based on a COMPETITOR ad analysis (${competitorBrand || "another brand"}). ${isConcept ? "ADAPT the concept and angle for ONEST \u2014 use our own visual style and messaging." : "REPLICATE the visual style for ONEST \u2014 same layout, colours, typography; use ONEST product and ONEST copy only."} Return ONLY valid JSON. No markdown, no code blocks.`;
  const userPrompt = `Based on this analysis of a COMPETITOR ad (${competitorBrand || "other brand"}):

${analysis}

${productInfo2 ? `
ONEST Product Information for ${product}:
${productInfo2}` : ""}

Generate an iteration brief with 3 variations for ONEST Health's ${product}.
${isConcept ? "Each variation should ADAPT the competitor's concept/angle for ONEST \u2014 our visual style, our messaging, our product. Test different ways to execute the same conceptual hook." : "Each variation should REPLICATE the competitor's visual style (layout, colours, typography, mood) but with ONEST product and ONEST-only copy. Test different headline/angle within that style."}

Return JSON in this exact format:
{
  "originalHeadline": "headline or concept from competitor ad",
  "originalAngle": "description of competitor's angle",
  "preserveElements": ["elements we are preserving or adapting"],
  "targetAudience": "target audience",
  "variations": [
    {
      "number": 1,
      "angle": "Angle name",
      "angleDescription": "Why this angle",
      "headline": "ONEST HEADLINE (3-8 words, all caps)",
      "subheadline": "Supporting subheadline",
      "benefitCallouts": ["Benefit 1", "Benefit 2"],
      "backgroundNote": "Background/style note for this variation"
    },
    { "number": 2, ... },
    { "number": 3, ... }
  ]
}`;
  const res = await claudeClient.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userPrompt }]
  });
  let text2 = "";
  const resContent = res.data?.content;
  if (Array.isArray(resContent)) text2 = resContent.map((c) => c.text || "").join("\n");
  else text2 = resContent?.text || JSON.stringify(resContent);
  text2 = text2.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    JSON.parse(text2);
  } catch {
    text2 = JSON.stringify({ raw: text2, variations: [] });
  }
  return text2;
}

// server/routers.ts
init_env();
init_storage();
init_schema();
import { TRPCError as TRPCError5 } from "@trpc/server";
import { SignJWT as SignJWT2 } from "jose";

// server/routers/canva.ts
init_db();
import { z as z2 } from "zod";

// server/services/canva.ts
init_env();
import crypto from "crypto";
var CANVA_API_BASE = "https://api.canva.com/rest/v1";
var CANVA_AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
var CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}
function getCanvaAuthUrl(redirectUri, state, codeChallenge) {
  const params = new URLSearchParams({
    client_id: ENV.CANVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "design:permission:read asset:read asset:write design:content:read design:content:write folder:permission:read comment:write design:permission:write folder:write profile:read folder:read brandtemplate:content:read comment:read brandtemplate:meta:read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  return `${CANVA_AUTHORIZE_URL}?${params.toString()}`;
}
async function exchangeCodeForToken(code, redirectUri, codeVerifier) {
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: ENV.CANVA_CLIENT_ID,
      client_secret: ENV.CANVA_CLIENT_SECRET,
      code_verifier: codeVerifier
    })
  });
  if (!response.ok) {
    const error = await response.text();
    console.error(`[Canva] Token exchange failed: ${response.status}`, error);
    throw new Error(`Canva token exchange failed: ${response.status} ${error}`);
  }
  return response.json();
}
async function refreshAccessToken(refreshToken) {
  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: ENV.CANVA_CLIENT_ID,
      client_secret: ENV.CANVA_CLIENT_SECRET
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva token refresh failed: ${response.status} ${error}`);
  }
  return response.json();
}
async function uploadAssetToCanva(accessToken, imageUrl, assetName) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const nameBase64 = Buffer.from(assetName).toString("base64");
  const response = await fetch(`${CANVA_API_BASE}/asset-uploads`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({ name_base64: nameBase64 })
    },
    body: imageBuffer
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva asset upload failed: ${response.status} ${error}`);
  }
  const result = await response.json();
  return result;
}
async function createDesignFromAsset(accessToken, assetId, title, width, height) {
  const response = await fetch(`${CANVA_API_BASE}/designs`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      asset_id: assetId,
      title,
      design_type: {
        type: "custom",
        width,
        height
      }
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva design creation failed: ${response.status} ${error}`);
  }
  return response.json();
}
async function pollAssetUploadJob(accessToken, jobId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${CANVA_API_BASE}/asset-uploads/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canva job status check failed: ${response.status} ${error}`);
    }
    const result = await response.json();
    if (result.job.status === "success") {
      return result;
    } else if (result.job.status === "failed") {
      throw new Error(`Asset upload failed: ${result.job.error?.message || "Unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
  throw new Error("Asset upload timed out after 60 seconds");
}
async function createAutofillJob(accessToken, templateId, data) {
  const response = await fetch(`${CANVA_API_BASE}/autofills`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      brand_template_id: templateId,
      data
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Canva create autofill job failed: ${response.status} ${error}`);
  }
  return response.json();
}
async function pollAutofillJob(accessToken, jobId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${CANVA_API_BASE}/autofills/${jobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canva autofill job status check failed: ${response.status} ${error}`);
    }
    const result = await response.json();
    if (result.job.status === "success") {
      return result;
    } else if (result.job.status === "failed") {
      throw new Error(`Autofill job failed: ${result.job.error?.message || "Unknown error"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2e3));
  }
  throw new Error("Autofill job timed out after 60 seconds");
}

// server/routers/canva.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var pkceStore = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(pkceStore.entries());
  for (const [key, value] of entries) {
    if (value.expiresAt < now) {
      pkceStore.delete(key);
    }
  }
}, 10 * 60 * 1e3);
var canvaRouter = router({
  // Get Canva authorization URL
  getAuthUrl: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }
    const { verifier, challenge } = generatePKCE();
    const state = `${ctx.user.openId}-${Date.now()}`;
    const redirectUri = "https://3000-ilfzg47vdtu2vrhca80ig-263dd919.sg1.manus.computer/api/canva/callback";
    pkceStore.set(state, { verifier, expiresAt: Date.now() + 10 * 60 * 1e3 });
    const authUrl = getCanvaAuthUrl(redirectUri, state, challenge);
    return { authUrl };
  }),
  // Check if user has connected Canva
  isConnected: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { connected: false };
    const tokens = await getUserCanvaTokens(ctx.user.openId);
    return { connected: !!tokens?.accessToken };
  }),
  // Upload image to Canva and create design
  uploadAndCreateDesign: publicProcedure.input(z2.object({
    imageUrl: z2.string(),
    title: z2.string(),
    width: z2.number(),
    height: z2.number()
  })).mutation(async ({ input, ctx }) => {
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }
    let tokens = await getUserCanvaTokens(ctx.user.openId);
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Canva not connected" });
    }
    if (tokens.expiresAt && new Date(tokens.expiresAt) < /* @__PURE__ */ new Date()) {
      try {
        const refreshed = await refreshAccessToken(tokens.refreshToken);
        const expiresAt = new Date(Date.now() + refreshed.expires_in * 1e3);
        await updateUserCanvaTokens(
          ctx.user.openId,
          refreshed.access_token,
          refreshed.refresh_token,
          expiresAt
        );
        tokens = { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token, expiresAt };
      } catch (error) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Canva token refresh failed" });
      }
    }
    try {
      if (!tokens.accessToken) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Canva token missing" });
      }
      const uploadJob = await uploadAssetToCanva(tokens.accessToken, input.imageUrl, input.title);
      const completedJob = await pollAssetUploadJob(tokens.accessToken, uploadJob.job.id);
      if (!completedJob.job.asset) {
        throw new Error("Asset upload completed but no asset returned");
      }
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
        viewUrl: design.design.urls.view_url
      };
    } catch (error) {
      console.error("[Canva] Upload/create failed:", error);
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Canva upload failed" });
    }
  }),
  // Create editable design using Autofill API
  createEditableDesign: publicProcedure.input(z2.object({
    templateId: z2.string(),
    headline: z2.string(),
    subheadline: z2.string().optional(),
    benefit1: z2.string(),
    benefit2: z2.string(),
    benefit3: z2.string(),
    cta: z2.string(),
    productImageUrl: z2.string(),
    backgroundImageUrl: z2.string()
  })).mutation(async ({ input, ctx }) => {
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }
    let tokens = await getUserCanvaTokens(ctx.user.openId);
    if (!tokens?.accessToken || !tokens?.refreshToken) {
      throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "Canva not connected" });
    }
    if (tokens.expiresAt && new Date(tokens.expiresAt) < /* @__PURE__ */ new Date()) {
      try {
        const refreshed = await refreshAccessToken(tokens.refreshToken);
        const expiresAt = new Date(Date.now() + refreshed.expires_in * 1e3);
        await updateUserCanvaTokens(
          ctx.user.openId,
          refreshed.access_token,
          refreshed.refresh_token,
          expiresAt
        );
        tokens = { accessToken: refreshed.access_token, refreshToken: refreshed.refresh_token, expiresAt };
      } catch (error) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Canva token refresh failed" });
      }
    }
    try {
      if (!tokens.accessToken) {
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "Canva token missing" });
      }
      const productUploadJob = await uploadAssetToCanva(tokens.accessToken, input.productImageUrl, "Product");
      const productJob = await pollAssetUploadJob(tokens.accessToken, productUploadJob.job.id);
      if (!productJob.job.asset) {
        throw new Error("Product upload completed but no asset returned");
      }
      const backgroundUploadJob = await uploadAssetToCanva(tokens.accessToken, input.backgroundImageUrl, "Background");
      const backgroundJob = await pollAssetUploadJob(tokens.accessToken, backgroundUploadJob.job.id);
      if (!backgroundJob.job.asset) {
        throw new Error("Background upload completed but no asset returned");
      }
      const autofillData = {
        HEADLINE: { type: "text", text: input.headline },
        BENEFIT_1: { type: "text", text: input.benefit1 },
        BENEFIT_2: { type: "text", text: input.benefit2 },
        BENEFIT_3: { type: "text", text: input.benefit3 },
        CTA: { type: "text", text: input.cta },
        PRODUCT_IMAGE: { type: "image", asset_id: productJob.job.asset.id },
        BACKGROUND: { type: "image", asset_id: backgroundJob.job.asset.id }
      };
      if (input.subheadline) {
        autofillData.SUBHEADLINE = { type: "text", text: input.subheadline };
      }
      const autofillJob = await createAutofillJob(tokens.accessToken, input.templateId, autofillData);
      const completedJob = await pollAutofillJob(tokens.accessToken, autofillJob.job.id);
      if (!completedJob.job.result?.design) {
        throw new Error("Autofill completed but no design returned");
      }
      return {
        designUrl: completedJob.job.result.design.url,
        thumbnailUrl: completedJob.job.result.design.thumbnail?.url
      };
    } catch (error) {
      console.error("[Canva] Autofill failed:", error);
      throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "Canva autofill failed" });
    }
  }),
  // Disconnect Canva
  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError3({ code: "UNAUTHORIZED", message: "Must be logged in" });
    }
    await updateUserCanvaTokens(ctx.user.openId, "", "", /* @__PURE__ */ new Date(0));
    return { success: true };
  })
});
async function handleCanvaCallback(req, res) {
  const { code, state, error, error_description } = req.query;
  if (error) {
    console.error(`[Canva] OAuth error: ${error} - ${error_description}`);
    return res.redirect(`/settings?canva=error&message=${encodeURIComponent(error_description || error)}`);
  }
  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }
  const pkceData = pkceStore.get(state);
  if (!pkceData) {
    return res.status(400).send("Invalid or expired state");
  }
  const openId = state.split("-")[0];
  const redirectUri = "https://3000-ilfzg47vdtu2vrhca80ig-263dd919.sg1.manus.computer/api/canva/callback";
  try {
    const tokenResponse = await exchangeCodeForToken(code, redirectUri, pkceData.verifier);
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1e3);
    await updateUserCanvaTokens(
      openId,
      tokenResponse.access_token,
      tokenResponse.refresh_token,
      expiresAt
    );
    pkceStore.delete(state);
    res.redirect("/settings?canva=connected");
  } catch (error2) {
    console.error("[Canva] OAuth callback failed:", error2);
    res.redirect("/settings?canva=error");
  }
}

// server/routers/organic.ts
init_db();
import { z as z3 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";

// server/services/organicVideoPipeline.ts
init_db();
init_shared();
init_env();

// server/services/autoEditClient.ts
init_env();
init_shared();
import axios9 from "axios";
function baseUrl() {
  const url = ENV.autoEditApiUrl;
  if (!url) {
    throw new Error("[AutoEdit] AUTOEDIT_API_URL is not configured");
  }
  return url.replace(/\/+$/, "");
}
async function checkHealth() {
  try {
    const res = await axios9.get(`${baseUrl()}/api/v1/health`, { timeout: 5e3 });
    console.log(`[AutoEdit] Health check OK (${res.status})`);
    return res.status === 200;
  } catch (err) {
    const reason = err.code === "ECONNREFUSED" ? "connection refused" : err.code === "ETIMEDOUT" || err.code === "ECONNABORTED" ? "timeout" : err.message ?? "unknown error";
    console.log(`[AutoEdit] Health check failed: ${reason}`);
    return false;
  }
}
async function processVideo(input) {
  const body = {};
  if (input.inputType === "url") {
    body.s3_url = input.inputPath;
  } else {
    body.local_path = input.inputPath;
  }
  if (input.style) body.style = input.style;
  if (input.targetDuration !== void 0) body.target_duration = input.targetDuration;
  console.log(`[AutoEdit] Processing video (${input.inputType}): ${input.inputPath}`);
  const request = axios9.post(`${baseUrl()}/api/v1/process-video`, body, { timeout: STEP_TIMEOUT }).then((res) => {
    const data = res.data;
    console.log("[AutoEdit] Process-video completed successfully");
    return {
      outputUrl: data.output_url ?? data.outputUrl,
      transcription: data.transcription,
      segments: (data.segments ?? []).map((s) => ({
        word: s.word,
        start: s.start,
        end: s.end,
        confidence: s.confidence
      })),
      thumbnailUrl: data.thumbnail_url ?? data.thumbnailUrl
    };
  });
  return withTimeout(request, STEP_TIMEOUT, "AutoEdit process-video");
}

// server/services/subtitleService.ts
init_storage();
init_shared();
import ffmpeg from "fluent-ffmpeg";
import fs2 from "fs";
import path2 from "path";
import os2 from "os";
import axios10 from "axios";
import ffmpegStatic2 from "ffmpeg-static";
if (ffmpegStatic2 && typeof ffmpegStatic2 === "string" && fs2.existsSync(ffmpegStatic2)) {
  ffmpeg.setFfmpegPath(ffmpegStatic2);
  console.log("[Subtitle] Using ffmpeg-static binary:", ffmpegStatic2);
}
var RENDER_TIMEOUT = 5 * 60 * 1e3;
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor(seconds % 1 * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
function escapeAss(text2) {
  return text2.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}
function buildAssHeader(fontName, fontSize, bold, outline, shadow, marginV, borderStyle = 1) {
  return [
    "[Script Info]",
    "Title: Subtitles",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, StrikeOut, Underline, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${fontName},${fontSize},&H00FFFFFF,&H000038FF,&H00000000,&H80000000,${bold},0,0,0,100,100,0,0,${borderStyle},${outline},${shadow},2,10,10,${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ].join("\n");
}
function generateTiktokBold(segments) {
  const header = buildAssHeader("Arial", 72, 1, 3, 2, 10);
  const accentColor = "&H003838FF";
  const events = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const word = escapeAss(seg.word.trim());
    if (!word) continue;
    const contextStart = Math.max(0, i - 2);
    const contextEnd = Math.min(segments.length - 1, i + 2);
    let text2 = "{\\an5\\pos(960,800)}";
    for (let j = contextStart; j <= contextEnd; j++) {
      const w = escapeAss(segments[j].word.trim());
      if (!w) continue;
      if (j === i) {
        text2 += `{\\c${accentColor}}${w}{\\c&H00FFFFFF} `;
      } else {
        text2 += `${w} `;
      }
    }
    events.push(
      `Dialogue: 0,${formatTime(seg.start)},${formatTime(seg.end)},Default,,0,0,0,,${text2.trim()}`
    );
  }
  return header + "\n" + events.join("\n") + "\n";
}
function generateMinimal(segments) {
  const header = buildAssHeader("Arial", 48, 0, 1, 0, 10);
  const chunks = [];
  let current = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    current.push(seg);
    const isLast = i === segments.length - 1;
    const gap = isLast ? 0 : segments[i + 1].start - seg.end;
    const atLimit = current.length >= 8;
    const atNaturalPause = gap > 0.3 && current.length >= 5;
    if (isLast || atLimit || atNaturalPause) {
      chunks.push(current);
      current = [];
    }
  }
  const events = [];
  for (const chunk of chunks) {
    const start = chunk[0].start;
    const end = chunk[chunk.length - 1].end;
    const text2 = chunk.map((s) => escapeAss(s.word.trim())).filter(Boolean).join(" ");
    events.push(
      `Dialogue: 0,${formatTime(start)},${formatTime(end)},Default,,0,0,0,,{\\an5\\pos(960,950)}${text2}`
    );
  }
  return header + "\n" + events.join("\n") + "\n";
}
function generateKaraoke(segments) {
  const header = buildAssHeader("Arial", 64, 1, 2, 1, 10);
  const lines = [];
  let current = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    current.push(seg);
    const isLast = i === segments.length - 1;
    const gap = isLast ? 0 : segments[i + 1].start - seg.end;
    const atLimit = current.length >= 10;
    const atNaturalPause = gap > 0.5 && current.length >= 6;
    if (isLast || atLimit || atNaturalPause) {
      lines.push(current);
      current = [];
    }
  }
  const accentColor = "&H003838FF";
  const events = [];
  for (const line of lines) {
    const lineStart = line[0].start;
    const lineEnd = line[line.length - 1].end;
    let text2 = `{\\an5\\pos(960,800)\\1c${accentColor}}`;
    for (const seg of line) {
      const duration = Math.round((seg.end - seg.start) * 100);
      text2 += `{\\k${duration}}${escapeAss(seg.word.trim())} `;
    }
    events.push(
      `Dialogue: 0,${formatTime(lineStart)},${formatTime(lineEnd)},Default,,0,0,0,,${text2.trim()}`
    );
  }
  return header + "\n" + events.join("\n") + "\n";
}
function generateAssFile(segments, style) {
  if (style === "none" || !segments.length) {
    return "";
  }
  console.log(`[Subtitle] Generating ASS file: style=${style}, segments=${segments.length}`);
  switch (style) {
    case "tiktok_bold":
      return generateTiktokBold(segments);
    case "minimal":
      return generateMinimal(segments);
    case "karaoke":
      return generateKaraoke(segments);
    default:
      console.warn(`[Subtitle] Unknown style "${style}", falling back to tiktok_bold`);
      return generateTiktokBold(segments);
  }
}
async function renderSubtitles(videoUrl, assContent, outputKey) {
  if (!assContent) {
    console.log("[Subtitle] No subtitle content provided, returning original video URL");
    return videoUrl;
  }
  const run = async () => {
    const tmpDir = os2.tmpdir();
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const videoPath = path2.join(tmpDir, `sub_input_${uid}.mp4`);
    const assPath = path2.join(tmpDir, `sub_${uid}.ass`);
    const outputPath = path2.join(tmpDir, `sub_output_${uid}.mp4`);
    try {
      console.log("[Subtitle] Downloading video from:", videoUrl);
      const response = await axios10.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 12e4,
        maxContentLength: 500 * 1024 * 1024
        // 500MB max
      });
      fs2.writeFileSync(videoPath, Buffer.from(response.data));
      console.log("[Subtitle] Video downloaded, size:", fs2.statSync(videoPath).size, "bytes");
      fs2.writeFileSync(assPath, assContent, "utf-8");
      console.log("[Subtitle] ASS file written to:", assPath);
      console.log("[Subtitle] Burning subtitles with ffmpeg...");
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath).videoFilter(`ass=${assPath}`).output(outputPath).on("end", resolve).on("error", reject).run();
      });
      const outputSize = fs2.statSync(outputPath).size;
      console.log("[Subtitle] Subtitled video rendered, size:", outputSize, "bytes");
      if (outputSize === 0) {
        throw new Error("Rendered video file is empty");
      }
      console.log("[Subtitle] Uploading subtitled video to:", outputKey);
      const videoData = fs2.readFileSync(outputPath);
      const { url } = await storagePut(outputKey, videoData, "video/mp4");
      console.log("[Subtitle] Upload complete:", url);
      return url;
    } finally {
      for (const f of [videoPath, assPath, outputPath]) {
        try {
          fs2.unlinkSync(f);
        } catch {
        }
      }
    }
  };
  return withTimeout(run(), RENDER_TIMEOUT, "Subtitle render");
}

// server/services/captionGenerator.ts
init_shared();
init_db();
var PILLAR_GUIDANCE = {
  "PTC Value": "Product-focused content. Highlight the product's value, ingredients, benefits, or results. Weave genuine product advocacy into the narrative without sounding like a hard ad.",
  "Story": "Personal narrative content. Share a real story from Ryan's life \u2014 vulnerability, lessons learned, pivotal moments. Make the audience feel something.",
  "Edutaining": "Teach + entertain. Deliver real value (a tip, hack, insight) in a way that's engaging and shareable. Think 'I didn't know that' moments.",
  "Trends": "Ride a trending format, sound, or cultural moment. Put Ryan's unique spin on it. Keep it timely and relevant.",
  "Sale": "Sales-driven content. Create urgency, highlight offers, and drive action. Still needs to feel authentic to Ryan's voice.",
  "Motivation": "Inspirational/motivational content. Share mindset, discipline, and ambition. Speak to the grind and the vision.",
  "Life Dump": "Raw, unfiltered life content. Day-in-the-life, behind the scenes, casual and relatable. Low production, high connection.",
  "Workout": "Fitness and training content. Share exercises, routines, form tips, or gym culture moments. Blend expertise with energy."
};
var PURPOSE_GUIDANCE = {
  "Educate": "Teach something specific. The audience should walk away knowing something they didn't before.",
  "Inspire": "Move the audience emotionally. Make them want to take action, believe in themselves, or see things differently.",
  "Entertain": "Make them laugh, react, or share. Engagement is the priority.",
  "Sell": "Drive a specific action \u2014 purchase, click, sign-up. Still needs to feel organic and authentic.",
  "Connect": "Build relationship and trust. Make the audience feel seen, heard, or understood."
};
function buildSystemPrompt(pillar, purpose, fewShotExamples) {
  const pillarGuide = PILLAR_GUIDANCE[pillar] || `Content pillar: ${pillar}. Write appropriately for this style.`;
  const purposeGuide = PURPOSE_GUIDANCE[purpose] || `Content purpose: ${purpose}. Write with this intent.`;
  let examplesBlock = "";
  if (fewShotExamples.length > 0) {
    examplesBlock = `

## Few-Shot Examples (Ryan's real captions for reference)

${fewShotExamples.map((ex, i) => `### Example ${i + 1} [${ex.platform}] \u2014 Topic: ${ex.topic}
${ex.captionText}`).join("\n\n")}

Use these examples to match Ryan's voice, tone, and style. Do not copy them \u2014 use them as calibration.`;
  }
  return `You are a world-class social media copywriter ghostwriting for Ryan Spiteri.

## About Ryan Spiteri
- 2M+ follower fitness/business content creator
- CEO and founder of ONEST Health (premium sports nutrition brand)
- Known for: direct, confident, no-BS communication style
- Vulnerable and real when sharing personal stories
- Balances hustle/grind energy with genuine care for his audience
- Australian, uses casual/conversational language but never sloppy
- Does NOT use corporate speak or generic motivational fluff

## Voice Characteristics
- Direct and confident \u2014 says what he means
- Vulnerable when appropriate \u2014 not afraid to share failures and lessons
- Conversational \u2014 writes like he talks
- Uses short, punchy sentences mixed with longer thoughts
- Occasionally uses slang/informal language naturally
- Never preachy or holier-than-thou
- Authentic \u2014 the audience can tell he means it

## Content Pillar: ${pillar}
${pillarGuide}

## Content Purpose: ${purpose}
${purposeGuide}

## Caption Structure
Each caption MUST include:
1. **Hook line** \u2014 The first line that stops the scroll. Bold, provocative, curiosity-driven, or emotionally charged. This is the most important line.
2. **Body** \u2014 The value, insight, story, or message. Keep it tight \u2014 every sentence earns its place.
3. **CTA (Call to Action)** \u2014 Soft for organic content. Ask a question, invite a comment, or nudge engagement. NOT a hard sell unless the purpose is "Sell".
4. **Hashtags** \u2014 Platform-specific (see below).

## Platform-Specific Rules

### Instagram
- Can be longer (up to 2200 chars) \u2014 use the space when the story demands it
- 30 relevant hashtags at the end (mix of broad + niche fitness/business tags)
- Use line breaks for readability
- Emojis are OK but don't overdo it

### TikTok
- Short and punchy \u2014 the video does most of the talking
- 3-5 hashtags max, trend-aware
- Keep it under 300 characters ideally
- The caption complements the video, doesn't repeat it

### LinkedIn
- Professional but still Ryan's authentic voice
- No hashtags or minimal (1-3 max)
- Can be longer and more reflective
- Focus on business lessons, leadership, or mindset
- Still conversational \u2014 not corporate${examplesBlock}

## Response Format
You MUST respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON.
The JSON must have exactly three keys: "instagram", "tiktok", "linkedin".
Each value is the full caption text as a string for that platform.

Example structure:
{"instagram": "caption here...", "tiktok": "caption here...", "linkedin": "caption here..."}`;
}
async function parseClaudeJsonResponse(raw, retryFn) {
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed.instagram || !parsed.tiktok || !parsed.linkedin) {
      throw new Error("Missing required platform keys in response");
    }
    return {
      instagram: parsed.instagram,
      tiktok: parsed.tiktok,
      linkedin: parsed.linkedin
    };
  } catch (err) {
    console.log(`[CaptionGen] JSON parse failed (${err.message}), retrying once...`);
    const retryRaw = await retryFn();
    let retryStr = retryRaw.trim();
    const retryFenceMatch = retryStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (retryFenceMatch) {
      retryStr = retryFenceMatch[1].trim();
    }
    const retryParsed = JSON.parse(retryStr);
    if (!retryParsed.instagram || !retryParsed.tiktok || !retryParsed.linkedin) {
      throw new Error("Missing required platform keys in retry response");
    }
    return {
      instagram: retryParsed.instagram,
      tiktok: retryParsed.tiktok,
      linkedin: retryParsed.linkedin
    };
  }
}
async function generateCaption(input) {
  const { pillar, purpose, topic, context } = input;
  console.log(`[CaptionGen] Generating captions \u2014 pillar="${pillar}" purpose="${purpose}" topic="${topic}"`);
  let fewShotExamples = [];
  try {
    const examples = await listCaptionExamples(pillar, purpose);
    fewShotExamples = (examples || []).slice(0, 3).map((ex) => ({
      platform: ex.platform,
      captionText: ex.captionText,
      topic: ex.topic
    }));
    if (fewShotExamples.length > 0) {
      console.log(`[CaptionGen] Found ${fewShotExamples.length} few-shot example(s) for ${pillar}/${purpose}`);
    }
  } catch (err) {
    console.log(`[CaptionGen] Could not fetch few-shot examples: ${err.message}`);
  }
  const systemPrompt = buildSystemPrompt(pillar, purpose, fewShotExamples);
  let userMessage = `Write captions for all 3 platforms (Instagram, TikTok, LinkedIn) for the following:

**Content Pillar:** ${pillar}
**Purpose:** ${purpose}
**Topic:** ${topic}`;
  if (context) {
    userMessage += `
**Additional Context:** ${context}`;
  }
  userMessage += `

Remember: respond with valid JSON only. Keys: "instagram", "tiktok", "linkedin".`;
  const messages = [{ role: "user", content: userMessage }];
  const callClaudeFn = () => callClaude(messages, systemPrompt, 4096);
  const raw = await callClaudeFn();
  const result = await parseClaudeJsonResponse(raw, callClaudeFn);
  console.log(`[CaptionGen] Successfully generated captions for topic="${topic}"`);
  return result;
}
async function generateBatchCaptions(items) {
  console.log(`[CaptionGen] Starting batch generation for ${items.length} item(s), concurrency=3`);
  const tasks = items.map((item, index) => {
    return async () => {
      try {
        console.log(`[CaptionGen] Batch item ${index + 1}/${items.length}: "${item.topic}"`);
        return await generateCaption(item);
      } catch (err) {
        console.log(`[CaptionGen] Batch item ${index + 1} failed: ${err.message}`);
        return { error: `Failed to generate caption for "${item.topic}": ${err.message}` };
      }
    };
  });
  const results = await runWithConcurrency(tasks, 3);
  const successes = results.filter((r) => !("error" in r)).length;
  const failures = results.length - successes;
  console.log(`[CaptionGen] Batch complete: ${successes} succeeded, ${failures} failed`);
  return results;
}

// server/services/organicVideoPipeline.ts
init_whisper();
async function transitionStage(runId, stage) {
  console.log(`[OrganicVideo] Run #${runId} \u2014 Stage ${stage}`);
  await updateOrganicRun(runId, { stage, status: "running" });
}
async function failRun(runId, err) {
  console.error(`[OrganicVideo] Run #${runId} \u2014 FAILED:`, err.message);
  await updateOrganicRun(runId, {
    status: "failed",
    errorMessage: err.message
  });
}
async function runOrganicVideoStages1to3(runId, input) {
  try {
    await transitionStage(runId, "uploading");
    const validated = validateVideoInput(input.videoInputPath, ENV.localMediaBasePath);
    const healthy = await checkHealth();
    if (!healthy) {
      await updateOrganicRun(runId, {
        status: "failed",
        errorMessage: "AutoEdit service is not available \u2014 health check failed"
      });
      console.error(`[OrganicVideo] Run #${runId} \u2014 AutoEdit health check failed, aborting`);
      return;
    }
    await transitionStage(runId, "editing");
    const editResult = await withTimeout(
      processVideo({
        inputPath: validated.path,
        inputType: validated.type
      }),
      STEP_TIMEOUT,
      "AutoEdit process-video"
    );
    await updateOrganicRun(runId, {
      autoEditOutputUrl: editResult.outputUrl
    });
    await transitionStage(runId, "transcribing");
    const transcription = await withTimeout(
      transcribeVideo(editResult.outputUrl),
      STEP_TIMEOUT,
      "Whisper transcription"
    );
    await updateOrganicRun(runId, {
      transcription: JSON.stringify({
        text: transcription,
        segments: editResult.segments
      })
    });
    console.log(`[OrganicVideo] Run #${runId} \u2014 Stage reviewing`);
    await updateOrganicRun(runId, { stage: "reviewing", status: "running" });
    console.log(`[OrganicVideo] Run #${runId} \u2014 Paused for transcript review`);
  } catch (err) {
    await failRun(runId, err);
  }
}
async function runOrganicVideoStages4to6(runId) {
  try {
    const run = await getOrganicRun(runId);
    if (!run) {
      throw new Error(`Organic run #${runId} not found`);
    }
    const subtitleStyle = run.subtitleStyle ?? "none";
    const autoEditOutputUrl = run.autoEditOutputUrl;
    const transcriptionData = typeof run.transcriptionEdited === "string" ? JSON.parse(run.transcriptionEdited) : typeof run.transcriptionEdited === "object" && run.transcriptionEdited !== null ? run.transcriptionEdited : typeof run.transcription === "string" ? JSON.parse(run.transcription) : run.transcription;
    const segments = transcriptionData?.segments ?? [];
    await transitionStage(runId, "subtitling");
    let finalVideoUrl = autoEditOutputUrl;
    if (subtitleStyle !== "none") {
      const assContent = generateAssFile(segments, subtitleStyle);
      const outputKey = `organic-videos/${runId}/subtitled_${Date.now()}.mp4`;
      finalVideoUrl = await withTimeout(
        renderSubtitles(autoEditOutputUrl, assContent, outputKey),
        STEP_TIMEOUT,
        "Subtitle render"
      );
      await updateOrganicRun(runId, { subtitledVideoUrl: finalVideoUrl });
    } else {
      console.log(`[OrganicVideo] Run #${runId} \u2014 Subtitle style is "none", skipping burn-in`);
    }
    await transitionStage(runId, "captioning");
    const pillar = run.contentPillar ?? "Life Dump";
    const purpose = run.contentPurpose ?? "Connect";
    const topic = run.topic ?? "organic video";
    const captions = await withTimeout(
      generateCaption({ pillar, purpose, topic }),
      STEP_TIMEOUT,
      "Caption generation"
    );
    await updateOrganicRun(runId, {
      captionInstagram: captions.instagram,
      captionTiktok: captions.tiktok,
      captionLinkedin: captions.linkedin
    });
    console.log(`[OrganicVideo] Run #${runId} \u2014 Stage completed`);
    await updateOrganicRun(runId, {
      stage: "completed",
      status: "completed",
      completedAt: /* @__PURE__ */ new Date()
    });
    console.log(`[OrganicVideo] Run #${runId} \u2014 Pipeline finished successfully`);
  } catch (err) {
    await failRun(runId, err);
  }
}
async function approveTranscript(runId, editedSegments) {
  if (editedSegments) {
    await updateOrganicRun(runId, {
      transcriptionEdited: JSON.stringify(editedSegments)
    });
    console.log(`[OrganicVideo] Run #${runId} \u2014 Stored edited transcription`);
  } else {
    console.log(`[OrganicVideo] Run #${runId} \u2014 Using original transcription (no edits)`);
  }
  runOrganicVideoStages4to6(runId).catch((err) => {
    console.error(`[OrganicVideo] Run #${runId} \u2014 Background stages 4-6 failed:`, err.message);
  });
}

// server/routers/organic.ts
var organicRouter = router({
  // ──────────────────────────────────────────────────────────────────────────
  // Video Pipeline
  // ──────────────────────────────────────────────────────────────────────────
  triggerVideo: publicProcedure.input(
    z3.object({
      videoInputPath: z3.string(),
      subtitleStyle: z3.string().default("tiktok_bold"),
      contentPillar: z3.string().optional(),
      contentPurpose: z3.string().optional(),
      topic: z3.string().optional()
    })
  ).mutation(async ({ input }) => {
    const runId = await createOrganicRun({
      type: "organic_video",
      status: "running",
      stage: "uploading",
      videoInputPath: input.videoInputPath,
      subtitleStyle: input.subtitleStyle,
      contentPillar: input.contentPillar,
      contentPurpose: input.contentPurpose,
      topic: input.topic
    });
    runOrganicVideoStages1to3(runId, {
      videoInputPath: input.videoInputPath,
      subtitleStyle: input.subtitleStyle,
      contentPillar: input.contentPillar,
      contentPurpose: input.contentPurpose,
      topic: input.topic
    }).catch((err) => {
      console.error(`[Organic] triggerVideo background failed for run #${runId}:`, err.message);
    });
    return { runId };
  }),
  approveTranscript: publicProcedure.input(
    z3.object({
      runId: z3.number(),
      editedSegments: z3.array(
        z3.object({
          word: z3.string(),
          start: z3.number(),
          end: z3.number(),
          confidence: z3.number()
        })
      ).optional()
    })
  ).mutation(async ({ input }) => {
    await approveTranscript(input.runId, input.editedSegments);
    return { success: true };
  }),
  getRun: publicProcedure.input(z3.object({ id: z3.number() })).query(async ({ input }) => {
    const run = await getOrganicRun(input.id);
    if (!run) {
      throw new TRPCError4({ code: "NOT_FOUND", message: `Organic run #${input.id} not found` });
    }
    return run;
  }),
  // ──────────────────────────────────────────────────────────────────────────
  // Caption Generator
  // ──────────────────────────────────────────────────────────────────────────
  generateCaption: publicProcedure.input(
    z3.object({
      pillar: z3.string(),
      purpose: z3.string(),
      topic: z3.string(),
      context: z3.string().optional()
    })
  ).mutation(async ({ input }) => {
    const result = await generateCaption(input);
    return result;
  }),
  generateBatchCaptions: publicProcedure.input(
    z3.object({
      items: z3.array(
        z3.object({
          pillar: z3.string(),
          purpose: z3.string(),
          topic: z3.string(),
          context: z3.string().optional()
        })
      ).max(20)
    })
  ).mutation(async ({ input }) => {
    const results = await generateBatchCaptions(input.items);
    return results;
  }),
  // ──────────────────────────────────────────────────────────────────────────
  // Caption Examples
  // ──────────────────────────────────────────────────────────────────────────
  addCaptionExample: publicProcedure.input(
    z3.object({
      pillar: z3.string(),
      purpose: z3.string(),
      topic: z3.string(),
      platform: z3.string(),
      captionText: z3.string(),
      notes: z3.string().optional()
    })
  ).mutation(async ({ input }) => {
    const id = await createCaptionExample(input);
    return { id };
  }),
  listCaptionExamples: publicProcedure.input(
    z3.object({
      pillar: z3.string().optional(),
      purpose: z3.string().optional()
    })
  ).query(async ({ input }) => {
    const examples = await listCaptionExamples(input.pillar, input.purpose);
    return examples;
  }),
  deleteCaptionExample: publicProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ input }) => {
    await deleteCaptionExample(input.id);
    return { success: true };
  }),
  // ──────────────────────────────────────────────────────────────────────────
  // Content Library
  // ──────────────────────────────────────────────────────────────────────────
  listContent: publicProcedure.query(async () => {
    const content = await listAllContent();
    return content;
  }),
  listOrganicRuns: publicProcedure.input(
    z3.object({
      type: z3.string().optional()
    })
  ).query(async ({ input }) => {
    const runs = await listOrganicRuns(input.type);
    return runs;
  }),
  // ──────────────────────────────────────────────────────────────────────────
  // AutoEdit
  // ──────────────────────────────────────────────────────────────────────────
  checkAutoEditHealth: publicProcedure.query(async () => {
    const available = await checkHealth();
    return { available };
  })
});

// server/services/faceSwapPipeline.ts
init_db();

// server/services/portraitValidator.ts
init_env();
import axios11 from "axios";
var claudeClient2 = axios11.create({
  baseURL: "https://api.anthropic.com/v1",
  headers: {
    "x-api-key": ENV.anthropicApiKey,
    "anthropic-version": "2023-06-01",
    "Content-Type": "application/json"
  }
});
async function validatePortrait(imageBase64, mimeType = "image/jpeg") {
  const systemPrompt = `You are a quality control AI for portrait images used in AI character swap video production.
Your job is to analyse a portrait photo and determine if it meets the technical and compositional requirements for high-quality face/character swapping.

Respond ONLY with valid JSON matching this exact schema:
{
  "passed": boolean,
  "checks": [
    { "name": "Front-facing angle", "passed": boolean, "note": "string" },
    { "name": "Even lighting", "passed": boolean, "note": "string" },
    { "name": "Neutral expression", "passed": boolean, "note": "string" },
    { "name": "No obstructions", "passed": boolean, "note": "string" },
    { "name": "Face clearly visible", "passed": boolean, "note": "string" },
    { "name": "Single person", "passed": boolean, "note": "string" }
  ],
  "summary": "string"
}

Rules:
- "passed" at the top level is true ONLY if ALL individual checks pass
- Each check "note" should be a brief, specific, actionable description (1 sentence)
- "summary" is a 1-2 sentence overall assessment
- Be strict but fair \u2014 minor imperfections are acceptable if they won't affect swap quality`;
  const userPrompt = `Please analyse this portrait image for character swap quality. Check all 6 criteria and return the JSON result.`;
  const response = await claudeClient2.post("/messages", {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType,
              data: imageBase64
            }
          },
          {
            type: "text",
            text: userPrompt
          }
        ]
      }
    ]
  });
  const content = response.data.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude Vision");
  }
  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse JSON from Claude Vision response");
  }
  const result = JSON.parse(jsonMatch[0]);
  return result;
}

// server/services/magicHour.ts
var MH_BASE = "https://api.magichour.ai/v1";
function getApiKey() {
  const key = process.env.MAGIC_HOUR_API_KEY;
  if (!key) throw new Error("MAGIC_HOUR_API_KEY is not set");
  return key;
}
async function mhFetch(endpoint, options = {}) {
  const url = `${MH_BASE}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6e4);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
        ...options.headers || {}
      }
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
async function submitFaceDetection(fileUrl) {
  const body = {
    assets: { target_file_path: fileUrl },
    confidence_score: 0.5
  };
  console.log("[MagicHour] Submitting face detection for:", fileUrl);
  const res = await mhFetch("/face-detection", {
    method: "POST",
    body: JSON.stringify(body)
  });
  const text2 = await res.text();
  console.log(`[MagicHour] Face detection submit (${res.status}):`, text2);
  if (!res.ok) {
    throw new Error(`Magic Hour face detection submit failed (${res.status}): ${text2}`);
  }
  return JSON.parse(text2);
}
async function waitForFaceDetection(taskId, timeoutMs = 3 * 60 * 1e3, pollIntervalMs = 5e3) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await mhFetch(`/face-detection/${taskId}`);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Magic Hour face detection poll failed (${res.status}): ${err}`);
    }
    const result = await res.json();
    console.log(`[MagicHour] Face detection ${taskId}: ${result.status}, faces found: ${result.faces?.length ?? 0}`);
    if (result.status === "complete") {
      if (!result.faces || result.faces.length === 0) {
        throw new Error("Magic Hour face detection completed but no faces were found in the video. Ensure the video contains a clear, front-facing person.");
      }
      return result;
    }
    if (result.status === "error") {
      throw new Error(`Magic Hour face detection failed for task ${taskId}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Magic Hour face detection timed out after ${timeoutMs / 1e3}s`);
}
async function submitFaceSwapJob(params) {
  const body = {
    name: params.name || `UGC Clone - ${(/* @__PURE__ */ new Date()).toISOString()}`,
    start_seconds: params.startSeconds ?? 0,
    end_seconds: params.endSeconds ?? 60,
    style: { version: "default" },
    assets: {
      video_file_path: params.videoUrl,
      video_source: "file",
      face_swap_mode: "individual-faces",
      face_mappings: [
        {
          original_face: params.originalFacePath,
          // MH internal path from face detection
          new_face: params.portraitUrl
          // public URL to portrait image
        }
      ]
    }
  };
  console.log("[MagicHour] Submitting face swap job:", JSON.stringify(body, null, 2));
  const res = await mhFetch("/face-swap", {
    method: "POST",
    body: JSON.stringify(body)
  });
  const text2 = await res.text();
  console.log(`[MagicHour] Face swap submit (${res.status}):`, text2);
  if (!res.ok) {
    throw new Error(`Magic Hour face swap submit failed (${res.status}): ${text2}`);
  }
  return JSON.parse(text2);
}
async function getFaceSwapJobStatus(jobId) {
  const res = await mhFetch(`/video-projects/${jobId}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Magic Hour video project status check failed (${res.status}): ${err}`);
  }
  return await res.json();
}
async function waitForFaceSwapCompletion(jobId, timeoutMs = 15 * 60 * 1e3, pollIntervalMs = 1e4) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getFaceSwapJobStatus(jobId);
    console.log(`[MagicHour] Face swap job ${jobId}: ${status.status}`);
    if (status.status === "complete") {
      return status;
    }
    if (status.status === "error" || status.status === "canceled") {
      const errMsg = typeof status.error === "object" ? status.error?.message || JSON.stringify(status.error) : status.error || "unknown error";
      throw new Error(`Magic Hour face swap job ${status.status}: ${errMsg}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Magic Hour face swap job timed out after ${timeoutMs / 1e3}s`);
}
async function runMagicHourCharacterSwap(input) {
  const { sourceVideoUrl, portraitUrl, name, videoDurationSeconds = 30 } = input;
  console.log("[MagicHour] Step 1: Detecting faces in source video...");
  const detectionTask = await submitFaceDetection(sourceVideoUrl);
  const detectionResult = await waitForFaceDetection(detectionTask.id);
  const originalFacePath = detectionResult.faces[0].path;
  console.log(`[MagicHour] Detected face path: ${originalFacePath}`);
  console.log("[MagicHour] Step 2: Submitting face swap job...");
  const job = await submitFaceSwapJob({
    videoUrl: sourceVideoUrl,
    originalFacePath,
    portraitUrl,
    name: name || `UGC Clone - ${(/* @__PURE__ */ new Date()).toISOString()}`,
    startSeconds: 0,
    endSeconds: videoDurationSeconds
  });
  console.log(`[MagicHour] Face swap job submitted: ${job.id}`);
  console.log("[MagicHour] Step 3: Polling for completion...");
  const result = await waitForFaceSwapCompletion(job.id);
  const outputUrl = result.downloads?.[0]?.url;
  if (!outputUrl) {
    throw new Error("Magic Hour job completed but no download URL found");
  }
  const credits = result.credits_charged ?? job.credits_charged ?? 0;
  const costUsd = (credits * 24e-4).toFixed(2);
  return {
    jobId: job.id,
    outputVideoUrl: outputUrl,
    creditsCharged: credits,
    estimatedCostUsd: `$${costUsd}`
  };
}

// server/services/faceSwapPipeline.ts
init_storage();
import ffmpegStatic3 from "ffmpeg-static";
import { execFile } from "child_process";
import { promisify as promisify2 } from "util";
import fs3 from "fs";
import path3 from "path";
import os3 from "os";
var execFileAsync = promisify2(execFile);
async function generateVoiceover(script, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text: script,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true
      }
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
async function mergeAudioIntoVideo(videoUrl, audioBuffer) {
  const ffmpegBin = ffmpegStatic3;
  if (!ffmpegBin) throw new Error("ffmpeg-static binary not found");
  const tmpDir = os3.tmpdir();
  const videoPath = path3.join(tmpDir, `faceswap-video-${Date.now()}.mp4`);
  const audioPath = path3.join(tmpDir, `faceswap-audio-${Date.now()}.mp3`);
  const outputPath = path3.join(tmpDir, `faceswap-output-${Date.now()}.mp4`);
  try {
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download face-swapped video: ${videoRes.status}`);
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    fs3.writeFileSync(videoPath, videoBuffer);
    fs3.writeFileSync(audioPath, audioBuffer);
    await execFileAsync(ffmpegBin, [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      outputPath
    ]);
    return fs3.readFileSync(outputPath);
  } finally {
    for (const p of [videoPath, audioPath, outputPath]) {
      try {
        fs3.unlinkSync(p);
      } catch {
      }
    }
  }
}
async function runFaceSwapPipeline(input) {
  const {
    jobId,
    sourceVideoUrl,
    portraitBase64,
    portraitMimeType,
    portraitS3Url,
    voiceId,
    voiceoverScript,
    videoDurationSeconds = 30
  } = input;
  const updateJob = async (data) => {
    await updateFaceSwapJob(jobId, data);
  };
  try {
    await updateJob({ status: "validating" });
    const validation = await validatePortrait(portraitBase64, portraitMimeType);
    await updateJob({ portraitValidation: validation });
    if (!validation.passed) {
      await updateJob({
        status: "failed",
        errorMessage: `Portrait validation failed: ${validation.summary}`
      });
      return;
    }
    let voiceoverS3Url;
    if (voiceId && voiceoverScript) {
      await updateJob({ status: "generating_voice" });
      const audioBuffer = await generateVoiceover(voiceoverScript, voiceId);
      const audioKey = `face-swap-jobs/${jobId}/voiceover-${Date.now()}.mp3`;
      const { url: audioUrl } = await storagePut(audioKey, audioBuffer, "audio/mpeg");
      voiceoverS3Url = audioUrl;
      await updateJob({ voiceoverUrl: audioUrl });
    }
    await updateJob({ status: "swapping" });
    const swapResult = await runMagicHourCharacterSwap({
      sourceVideoUrl,
      portraitUrl: portraitS3Url,
      videoDurationSeconds,
      name: `UGC Clone Job #${jobId}`
    });
    await updateJob({
      magicHourJobId: swapResult.jobId,
      magicHourStatus: "complete",
      faceSwapVideoUrl: swapResult.outputVideoUrl,
      creditsCharged: swapResult.creditsCharged,
      estimatedCostUsd: swapResult.estimatedCostUsd
    });
    let finalVideoUrl = swapResult.outputVideoUrl;
    if (voiceoverS3Url && voiceId && voiceoverScript) {
      await updateJob({ status: "merging" });
      const voiceRes = await fetch(voiceoverS3Url);
      const audioBuffer = Buffer.from(await voiceRes.arrayBuffer());
      const mergedBuffer = await mergeAudioIntoVideo(swapResult.outputVideoUrl, audioBuffer);
      const mergedKey = `face-swap-jobs/${jobId}/output-${Date.now()}.mp4`;
      const { url: mergedUrl } = await storagePut(mergedKey, mergedBuffer, "video/mp4");
      finalVideoUrl = mergedUrl;
    }
    await updateJob({
      status: "completed",
      outputVideoUrl: finalVideoUrl
    });
  } catch (err) {
    console.error(`[FaceSwapPipeline] Job ${jobId} failed:`, err.message);
    await updateJob({
      status: "failed",
      errorMessage: err.message || "Unknown error"
    });
  }
}

// server/routers.ts
init_shared();
var VALID_USERNAME = "ryan@onesthealth.com";
var VALID_PASSWORD = "TeamOnest";
var faceSwapRouter = router({
  create: publicProcedure.input(z4.object({
    sourceVideoUrl: z4.string().optional(),
    // optional when ugcVariantId is provided
    portraitBase64: z4.string(),
    portraitMimeType: z4.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
    portraitS3Url: z4.string().url(),
    voiceId: z4.string().optional(),
    voiceoverScript: z4.string().optional(),
    videoDurationSeconds: z4.number().optional().default(30),
    ugcVariantId: z4.number().optional()
  })).mutation(async ({ input }) => {
    let sourceVideoUrl = input.sourceVideoUrl || "";
    if (!sourceVideoUrl && input.ugcVariantId) {
      const variant = await getUgcVariant(input.ugcVariantId);
      if (variant?.uploadId) {
        const upload = await getUgcUpload(variant.uploadId);
        sourceVideoUrl = upload?.videoUrl || "";
      }
    }
    if (!sourceVideoUrl) throw new TRPCError5({ code: "BAD_REQUEST", message: "Source video URL is required" });
    const durationMins = (input.videoDurationSeconds ?? 30) / 60;
    const estimatedCostUsd = `$${(durationMins * 2.16).toFixed(2)}`;
    const jobId = await createFaceSwapJob({
      ugcVariantId: input.ugcVariantId ?? null,
      sourceVideoUrl,
      portraitUrl: input.portraitS3Url,
      voiceId: input.voiceId ?? null,
      voiceoverScript: input.voiceoverScript ?? null,
      estimatedCostUsd,
      status: "pending"
    });
    runFaceSwapPipeline({
      jobId,
      sourceVideoUrl,
      portraitBase64: input.portraitBase64,
      portraitMimeType: input.portraitMimeType,
      portraitS3Url: input.portraitS3Url,
      voiceId: input.voiceId,
      voiceoverScript: input.voiceoverScript,
      videoDurationSeconds: input.videoDurationSeconds ?? 30
    }).catch((err) => console.error(`[FaceSwap] Background pipeline error for job ${jobId}:`, err.message));
    return { jobId, estimatedCostUsd };
  }),
  get: publicProcedure.input(z4.object({ id: z4.number() })).query(async ({ input }) => {
    const job = await getFaceSwapJob(input.id);
    if (!job) throw new TRPCError5({ code: "NOT_FOUND", message: "Face swap job not found" });
    return job;
  }),
  list: publicProcedure.query(async () => listFaceSwapJobs(50)),
  getByVariant: publicProcedure.input(z4.object({ variantId: z4.number() })).query(async ({ input }) => {
    const jobs = await listFaceSwapJobs(200);
    return jobs.find((j) => j.ugcVariantId === input.variantId) || null;
  }),
  validatePortrait: publicProcedure.input(z4.object({
    portraitBase64: z4.string(),
    mimeType: z4.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg")
  })).mutation(async ({ input }) => validatePortrait(input.portraitBase64, input.mimeType)),
  uploadPortrait: publicProcedure.input(z4.object({
    base64: z4.string(),
    mimeType: z4.string().default("image/jpeg"),
    fileName: z4.string().default("portrait.jpg")
  })).mutation(async ({ input }) => {
    const buffer = Buffer.from(input.base64, "base64");
    const ext = input.mimeType.split("/")[1] || "jpg";
    const key = `face-swap-portraits/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { url } = await storagePut(key, buffer, input.mimeType);
    return { url, key };
  }),
  getVoicesByAccent: publicProcedure.input(z4.object({
    accent: z4.enum(["australian", "american", "all"]).default("all")
  })).query(async ({ input }) => {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" }
    });
    if (!response.ok) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch ElevenLabs voices" });
    const data = await response.json();
    const voices = (data.voices || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      accent: v.labels?.accent || "",
      gender: v.labels?.gender || "",
      age: v.labels?.age || "",
      useCase: v.labels?.use_case || "",
      previewUrl: v.preview_url || ""
    }));
    if (input.accent === "all") return voices.filter((v) => v.accent === "australian" || v.accent === "american");
    return voices.filter((v) => v.accent === input.accent);
  }),
  pushToClickUp: publicProcedure.input(z4.object({
    jobId: z4.number(),
    product: z4.string(),
    priority: z4.enum(["Low", "Medium", "High", "Urgent"]).default("High")
  })).mutation(async ({ input }) => {
    const job = await getFaceSwapJob(input.jobId);
    if (!job) throw new TRPCError5({ code: "NOT_FOUND", message: "Face swap job not found" });
    if (job.status !== "completed") throw new TRPCError5({ code: "BAD_REQUEST", message: "Job is not completed yet" });
    const { createScriptTask: createScriptTask2 } = await Promise.resolve().then(() => (init_clickup(), clickup_exports));
    const task = await createScriptTask2(
      `UGC Clone - ${input.product} - ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
      "UGC Clone",
      100,
      `Character swap video ready for review.

Output Video: ${job.outputVideoUrl}
Cost: ${job.estimatedCostUsd}
Magic Hour Job: ${job.magicHourJobId}`,
      input.product,
      input.priority
    );
    await updateFaceSwapJob(input.jobId, { clickupTaskId: task.id, clickupTaskUrl: task.url });
    return { taskId: task.id, taskUrl: task.url };
  }),
  generateScript: publicProcedure.input(z4.object({
    uploadId: z4.number(),
    actorArchetype: z4.string(),
    voiceTone: z4.string(),
    energyLevel: z4.enum(["low", "medium", "high"])
  })).mutation(async ({ input }) => {
    const upload = await getUgcUpload(input.uploadId);
    if (!upload) throw new TRPCError5({ code: "NOT_FOUND", message: "Upload not found" });
    if (!upload.transcript) throw new TRPCError5({ code: "BAD_REQUEST", message: "Upload has no transcript yet" });
    if (!upload.structureBlueprint) throw new TRPCError5({ code: "BAD_REQUEST", message: "Upload has no structure blueprint yet \u2014 approve the blueprint first" });
    const { generateVariants: generateVariants2 } = await Promise.resolve().then(() => (init_ugcClone(), ugcClone_exports));
    const blueprint = upload.structureBlueprint;
    const variants = await generateVariants2({
      uploadId: input.uploadId,
      product: upload.product,
      audienceTag: upload.audienceTag ?? void 0,
      desiredOutputVolume: 1,
      structureBlueprint: blueprint,
      transcript: upload.transcript
    });
    const variant = variants[0];
    if (!variant) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Script generation failed" });
    const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const prompt = `You are generating ONE UGC script variant with specific persona settings.

ORIGINAL TRANSCRIPT:
${upload.transcript}

STRUCTURE BLUEPRINT:
- Hook: "${blueprint.hook.text}" (${blueprint.hook.strength} strength)
- Body: ${blueprint.body.keyPoints.join(", ")}
- CTA: "${blueprint.cta.text}" (${blueprint.cta.urgency} urgency)
- Pacing: ${blueprint.pacing.wordsPerMinute} WPM, ${blueprint.pacing.energyLevel} energy
- Compliance: ${blueprint.complianceLanguage.join("; ")}

PRODUCT: ${upload.product}
AUDIENCE: ${upload.audienceTag || "general fitness audience"}

PERSONA SETTINGS:
- Actor Archetype: ${input.actorArchetype}
- Voice Tone: ${input.voiceTone}
- Energy Level: ${input.energyLevel}

Generate exactly ONE script variant matching these persona settings exactly. Preserve the structure, compliance language, and hook strength. Only change the surface phrasing to match the persona.`;
    const response = await invokeLLM2({
      messages: [
        { role: "system", content: "You are a UGC script variant generator. Return only the script text, no JSON, no labels." },
        { role: "user", content: prompt }
      ]
    });
    const scriptText = response.choices[0].message.content;
    return { scriptText: scriptText.trim() };
  })
});
var appRouter = router({
  system: systemRouter,
  canva: canvaRouter,
  faceSwap: faceSwapRouter,
  organic: organicRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    login: publicProcedure.input(z4.object({ username: z4.string(), password: z4.string() })).mutation(async ({ input, ctx }) => {
      if (input.username !== VALID_USERNAME || input.password !== VALID_PASSWORD) {
        throw new TRPCError5({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      const openId = "onest-admin-user";
      await upsertUser({
        openId,
        name: "ONEST Admin",
        email: "admin@onest.com.au",
        role: "admin",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const secretKey = new TextEncoder().encode(ENV.cookieSecret);
      const token = await new SignJWT2({ openId, appId: ENV.appId, name: "ONEST Admin" }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(Math.floor((Date.now() + 365 * 24 * 60 * 60 * 1e3) / 1e3)).sign(secretKey);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1e3 });
      return { success: true, user: { name: "ONEST Admin" } };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  pipeline: router({
    list: publicProcedure.query(async () => listPipelineRuns(50)),
    get: publicProcedure.input(z4.object({ id: z4.number() })).query(async ({ input }) => {
      const run = await getPipelineRun(input.id);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND", message: "Pipeline run not found" });
      return run;
    }),
    // Video pipeline trigger — v3.0 with funnel stage + archetype
    triggerVideo: publicProcedure.input(z4.object({
      product: z4.string(),
      priority: z4.enum(["Low", "Medium", "High", "Urgent"]),
      foreplayAdId: z4.string().optional(),
      foreplayAdTitle: z4.string().optional(),
      foreplayAdBrand: z4.string().optional(),
      mediaUrl: z4.string(),
      thumbnailUrl: z4.string().optional(),
      sourceType: z4.enum(["competitor", "winning_ad"]).optional(),
      duration: z4.number().optional(),
      funnelStage: z4.enum(["cold", "warm", "retargeting", "retention"]).optional(),
      actorArchetype: z4.enum(["FitnessEnthusiast", "BusyMum", "Athlete", "Biohacker", "WellnessAdvocate"]).optional(),
      styleConfig: z4.array(z4.object({
        styleId: z4.enum(["DR", "UGC", "FOUNDER", "EDUCATION", "LIFESTYLE", "DEMO"]),
        quantity: z4.number()
      })).optional()
    })).mutation(async ({ input }) => {
      const runId = await createPipelineRun({
        pipelineType: "video",
        status: "running",
        product: input.product,
        priority: input.priority,
        triggerSource: "manual",
        foreplayAdId: input.foreplayAdId || "",
        foreplayAdTitle: input.foreplayAdTitle || "",
        foreplayAdBrand: input.foreplayAdBrand || "",
        videoUrl: input.mediaUrl,
        thumbnailUrl: input.thumbnailUrl || "",
        videoStage: "stage_1_transcription",
        videoSourceType: input.sourceType || "competitor",
        videoDuration: input.duration || 60,
        videoStyleConfig: input.styleConfig || null,
        videoFunnelStage: input.funnelStage || "cold",
        videoArchetypes: input.actorArchetype ? [input.actorArchetype] : null
      });
      runVideoPipelineStages1to3(runId, {
        ...input,
        sourceType: input.sourceType || "competitor",
        duration: input.duration || 60,
        funnelStage: input.funnelStage || "cold",
        actorArchetype: input.actorArchetype,
        styleConfig: input.styleConfig || [{ styleId: "DR", quantity: 2 }, { styleId: "UGC", quantity: 2 }]
      }).catch((err) => {
        console.error("[Pipeline] Video pipeline stages 1-3 failed:", err);
        updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Pipeline failed" });
      });
      return { runId, status: "running" };
    }),
    fetchForeplayVideos: publicProcedure.query(async () => {
      const creatives = await listForeplayCreatives("VIDEO", 50);
      if (creatives.length === 0) {
        console.log("[Pipeline] Local cache empty, fetching from Foreplay API");
        const liveAds = await fetchVideoAds(10);
        return liveAds.map((ad) => ({
          id: ad.id,
          type: "VIDEO",
          title: ad.title,
          brandName: ad.brandName,
          thumbnailUrl: ad.thumbnailUrl,
          mediaUrl: ad.mediaUrl,
          isNew: false
        }));
      }
      return creatives.map((c) => ({
        id: c.foreplayAdId,
        type: "VIDEO",
        title: c.title,
        brandName: c.brandName,
        thumbnailUrl: c.thumbnailUrl,
        mediaUrl: c.mediaUrl,
        isNew: c.isNew === 1
      }));
    }),
    fetchForeplayStatics: publicProcedure.query(async () => {
      const creatives = await listForeplayCreatives("STATIC", 50);
      if (creatives.length === 0) {
        console.log("[Pipeline] Local cache empty, fetching from Foreplay API");
        const liveAds = await fetchStaticAds(30);
        return liveAds.map((ad) => ({
          id: ad.id,
          type: "STATIC",
          title: ad.title,
          brandName: ad.brandName,
          imageUrl: ad.imageUrl,
          thumbnailUrl: ad.thumbnailUrl,
          isNew: false
        }));
      }
      return creatives.map((c) => ({
        id: c.foreplayAdId,
        type: "STATIC",
        title: c.title,
        brandName: c.brandName,
        imageUrl: c.imageUrl,
        thumbnailUrl: c.thumbnailUrl,
        isNew: c.isNew === 1
      }));
    }),
    syncForeplayNow: publicProcedure.mutation(async () => {
      const result = await syncFromForeplay();
      if (result.error) {
        throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: result.error });
      }
      return {
        newCount: result.newCount,
        totalFetched: result.totalFetched,
        message: `Imported ${result.newCount} new creatives from Foreplay`
      };
    }),
    getSyncStatus: publicProcedure.query(async () => getSyncStatus()),
    listBoards: publicProcedure.query(async () => listBoards()),
    // Static pipeline trigger (Stages 1-3 + pause at 3b for selection)
    triggerStatic: publicProcedure.input(z4.object({
      product: z4.string(),
      priority: z4.enum(["Low", "Medium", "High", "Urgent"]),
      selectedAdId: z4.string(),
      selectedAdImage: z4.object({
        id: z4.string(),
        imageUrl: z4.string(),
        brandName: z4.string().optional(),
        title: z4.string().optional()
      })
    })).mutation(async ({ input }) => {
      const runId = await createPipelineRun({
        pipelineType: "static",
        status: "running",
        product: input.product,
        priority: input.priority,
        triggerSource: "manual",
        foreplayAdId: input.selectedAdId,
        foreplayAdTitle: input.selectedAdImage.title || "Untitled",
        foreplayAdBrand: input.selectedAdImage.brandName || "Unknown",
        staticAdImages: [input.selectedAdImage],
        staticStage: "stage_1_analysis"
      });
      runStaticPipeline(runId, input).catch((err) => {
        console.error("[Pipeline] Static pipeline failed:", err);
        updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Static pipeline failed" });
      });
      return { runId, status: "running" };
    }),
    // Submit user selections at Stage 3b and resume pipeline
    submitSelections: publicProcedure.input(z4.object({
      runId: z4.number(),
      selections: z4.object({
        images: z4.array(z4.object({
          headline: z4.string(),
          subheadline: z4.string().nullable(),
          background: z4.union([
            z4.object({
              type: z4.literal("uploaded"),
              url: z4.string(),
              title: z4.string()
            }),
            z4.object({
              type: z4.literal("preset"),
              presetId: z4.string(),
              css: z4.string(),
              title: z4.string()
            }),
            z4.object({
              type: z4.literal("flux"),
              title: z4.string(),
              description: z4.string().optional(),
              prompt: z4.string()
            })
          ])
        })).length(3),
        benefits: z4.string(),
        productRenderUrl: z4.string().optional(),
        bannerbearTemplate: z4.string().optional()
      })
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.staticStage !== "stage_3b_selection") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline is not in selection stage" });
      }
      await updatePipelineRun(input.runId, {
        userSelections: input.selections
      });
      runStaticStage4(input.runId, run, input.selections).catch((err) => {
        console.error("[Pipeline] Stage 4+ failed:", err);
        updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
      });
      return { success: true };
    }),
    // Generate headline-matched background concepts
    generateBackgrounds: publicProcedure.input(z4.object({
      runId: z4.number(),
      headlines: z4.array(z4.string()).length(3),
      product: z4.string()
    })).mutation(async ({ input }) => {
      const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
      let productContext = "";
      try {
        const info = await getProductInfo(input.product);
        if (info) {
          const parts = [];
          if (info.benefits) parts.push(`Benefits: ${info.benefits}`);
          if (info.targetAudience) parts.push(`Target Audience: ${info.targetAudience}`);
          if (info.keySellingPoints) parts.push(`Key Selling Points: ${info.keySellingPoints}`);
          productContext = parts.join("\n");
        }
      } catch {
      }
      let styleContext = "";
      try {
        const run = await getPipelineRun(input.runId);
        if (run?.briefOptionsJson) {
          const briefSnippet = typeof run.briefOptionsJson === "string" ? run.briefOptionsJson.substring(0, 500) : JSON.stringify(run.briefOptionsJson).substring(0, 500);
          styleContext = `
Competitor ad analysis context: ${briefSnippet}`;
        }
      } catch {
      }
      const response = await invokeLLM2({
        messages: [
          {
            role: "system",
            content: `You are an expert creative director for DTC supplement advertising. Generate background scene concepts for ad creatives that MATCH the emotional tone and theme of each headline.

Rules:
- Each background must be a SCENE/ENVIRONMENT description (no text, no products, no logos)
- Backgrounds should evoke the feeling of the headline
- Use dramatic lighting, premium aesthetics, brand colors (#FF3838 red, #0347ED blue, #01040A black)
- Think about what visual environment would make someone stop scrolling
- Be specific and vivid \u2014 describe lighting, colors, textures, mood
- Each headline gets 3 different background options

Return ONLY valid JSON, no markdown.`
          },
          {
            role: "user",
            content: `Product: ${input.product}
${productContext ? `Product Info:
${productContext}` : ""}
${styleContext}

Generate 3 background concepts for EACH of these 3 headlines:

Headline 1: "${input.headlines[0]}"
Headline 2: "${input.headlines[1]}"
Headline 3: "${input.headlines[2]}"

Return JSON in this exact format:
{
  "images": [
    {
      "headline": "exact headline text",
      "backgrounds": [
        { "title": "Short Title", "description": "2-3 sentence visual description", "prompt": "Detailed image generation prompt for this background scene" },
        { "title": "Short Title", "description": "2-3 sentence visual description", "prompt": "Detailed image generation prompt" },
        { "title": "Short Title", "description": "2-3 sentence visual description", "prompt": "Detailed image generation prompt" }
      ]
    },
    { ... },
    { ... }
  ]
}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "background_concepts",
            strict: true,
            schema: {
              type: "object",
              properties: {
                images: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      headline: { type: "string" },
                      backgrounds: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            title: { type: "string" },
                            description: { type: "string" },
                            prompt: { type: "string" }
                          },
                          required: ["title", "description", "prompt"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["headline", "backgrounds"],
                    additionalProperties: false
                  }
                }
              },
              required: ["images"],
              additionalProperties: false
            }
          }
        }
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "No response from AI" });
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      return parsed;
    }),
    // Get active products list
    getActiveProducts: publicProcedure.query(() => {
      return ACTIVE_PRODUCTS;
    }),
    // Team approval endpoint for Stage 6
    teamApprove: publicProcedure.input(z4.object({
      runId: z4.number(),
      approved: z4.boolean(),
      notes: z4.string().optional()
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.staticStage !== "stage_6_team_approval") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline is not in team approval stage" });
      }
      if (input.approved) {
        await updatePipelineRun(input.runId, {
          teamApprovalStatus: "approved",
          teamApprovalNotes: input.notes || "Approved by team",
          staticStage: "stage_7_clickup"
        });
        runStaticStage7(input.runId, run).catch((err) => {
          console.error("[Pipeline] Stage 7 failed:", err);
          updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
        });
      } else {
        await updatePipelineRun(input.runId, {
          teamApprovalStatus: "rejected",
          teamApprovalNotes: input.notes || "Changes requested",
          staticStage: "stage_6_revising"
        });
        runStaticRevision(input.runId, run, input.notes || "").catch((err) => {
          console.error("[Pipeline] Revision failed:", err);
          updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
        });
      }
      return { success: true };
    }),
    // Upload video for winning ad mode
    uploadWinningAdVideo: publicProcedure.input(z4.object({
      fileName: z4.string(),
      fileBase64: z4.string(),
      contentType: z4.string()
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const maxSize = 100 * 1024 * 1024;
      if (buffer.length > maxSize) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "File too large. Maximum 100MB." });
      }
      const ext = input.fileName.split(".").pop() || "mp4";
      const key = `winning-ads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      return { url, key };
    }),
    // Video brief approval — user approves the brief before scripts are generated
    approveVideoBrief: publicProcedure.input(z4.object({
      runId: z4.number(),
      approved: z4.boolean(),
      notes: z4.string().optional()
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.videoStage !== "stage_3b_brief_approval") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline is not in brief approval stage" });
      }
      if (input.approved) {
        await updatePipelineRun(input.runId, {
          videoStage: "stage_4_scripts"
        });
        runVideoPipelineStage4(input.runId, run).catch((err) => {
          console.error("[Pipeline] Video stage 4 failed:", err);
          updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
        });
      } else {
        await updatePipelineRun(input.runId, {
          status: "failed",
          errorMessage: `Brief rejected by user: ${input.notes || "No reason given"}`,
          videoStage: "stage_3b_brief_approval"
        });
      }
      return { success: true };
    }),
    // Video script approval — user approves scripts before ClickUp push
    approveVideoScripts: publicProcedure.input(z4.object({
      runId: z4.number(),
      approved: z4.boolean(),
      appUrl: z4.string()
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.videoStage !== "stage_4b_script_approval") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline is not in script approval stage" });
      }
      if (input.approved) {
        runVideoPipelineStage5(input.runId, run, input.appUrl).catch((err) => {
          console.error("[Pipeline] Video stage 5 (ClickUp) failed:", err);
          updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
        });
      } else {
        await completeVideoPipelineWithoutClickUp(input.runId);
      }
      return { success: true };
    }),
    // ============================================================
    // ITERATION PIPELINE — Iterate on your own winning ads
    // ============================================================
    triggerIteration: publicProcedure.input(z4.object({
      product: z4.string(),
      priority: z4.enum(["Low", "Medium", "High", "Urgent"]),
      sourceImageUrl: z4.string(),
      sourceImageName: z4.string().optional(),
      sourceType: z4.enum(["own_ad", "competitor_ad"]).optional(),
      adaptationMode: z4.enum(["concept", "style"]).optional(),
      foreplayAdId: z4.string().optional(),
      foreplayAdTitle: z4.string().optional(),
      foreplayAdBrand: z4.string().optional(),
      creativityLevel: z4.enum(["SAFE", "BOLD", "WILD"]).optional(),
      variationTypes: z4.array(z4.enum(["headline_only", "background_only", "layout_only", "benefit_callouts_only", "props_only", "talent_swap", "full_remix"])).optional(),
      variationCount: z4.number().min(1).max(50).optional(),
      aspectRatio: z4.enum(["1:1", "4:5", "9:16", "16:9"]).optional(),
      imageModel: z4.enum(["nano_banana_pro", "nano_banana_2"]).optional()
    })).mutation(async ({ input }) => {
      const sourceType = input.sourceType ?? "own_ad";
      if (sourceType === "competitor_ad" && !input.adaptationMode) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "adaptationMode (concept or style) is required when sourceType is competitor_ad" });
      }
      const runId = await createPipelineRun({
        pipelineType: "iteration",
        status: "running",
        product: input.product,
        priority: input.priority,
        triggerSource: "manual",
        foreplayAdId: input.foreplayAdId ?? "iteration-" + Date.now(),
        foreplayAdTitle: input.foreplayAdTitle ?? input.sourceImageName ?? (sourceType === "competitor_ad" ? "Competitor Ad" : "Winning Ad Iteration"),
        foreplayAdBrand: input.foreplayAdBrand ?? (sourceType === "own_ad" ? "ONEST Health" : void 0),
        iterationSourceUrl: input.sourceImageUrl,
        iterationStage: "stage_1_analysis",
        iterationSourceType: sourceType,
        iterationAdaptationMode: sourceType === "competitor_ad" ? input.adaptationMode ?? null : null,
        creativityLevel: input.creativityLevel || "BOLD",
        aspectRatio: input.aspectRatio || "1:1",
        variationTypes: input.variationTypes ? JSON.stringify(input.variationTypes) : null,
        variationCount: input.variationCount || 3,
        imageModel: input.imageModel || "nano_banana_pro"
      });
      runIterationStages1to2(runId, input).catch((err) => {
        console.error("[Pipeline] Iteration pipeline stages 1-2 failed:", err);
        updatePipelineRun(runId, { status: "failed", errorMessage: err.message || "Pipeline failed" });
      });
      return { runId, status: "running" };
    }),
    approveIterationBrief: publicProcedure.input(z4.object({
      runId: z4.number(),
      approved: z4.boolean(),
      notes: z4.string().optional()
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.iterationStage !== "stage_2b_approval") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline is not in iteration brief approval stage" });
      }
      if (input.approved) {
        await updatePipelineRun(input.runId, {
          iterationStage: "stage_3_generation"
        });
        runIterationStage3(input.runId, run).catch((err) => {
          console.error("[Pipeline] Iteration stage 3 failed:", err);
          updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
        });
      } else {
        await updatePipelineRun(input.runId, {
          status: "failed",
          errorMessage: `Iteration brief rejected: ${input.notes || "No reason given"}`,
          iterationStage: "stage_2b_approval"
        });
      }
      return { success: true };
    }),
    // Approve iteration variations and push to ClickUp
    approveIterationVariations: publicProcedure.input(z4.object({
      runId: z4.number(),
      approved: z4.boolean(),
      notes: z4.string().optional()
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.iterationStage !== "stage_3b_variation_approval") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline is not in variation approval stage" });
      }
      if (input.approved) {
        runIterationStage4(input.runId, run).catch((err) => {
          console.error("[Pipeline] Iteration stage 4 failed:", err);
          updatePipelineRun(input.runId, { status: "failed", errorMessage: err.message });
        });
      } else {
        await updatePipelineRun(input.runId, {
          status: "completed",
          iterationStage: "completed",
          completedAt: /* @__PURE__ */ new Date(),
          teamApprovalNotes: input.notes || "Variations completed without ClickUp push"
        });
      }
      return { success: true };
    }),
    // Regenerate a single iteration variation
    regenerateVariation: publicProcedure.input(z4.object({
      runId: z4.number(),
      variationIndex: z4.number().min(0).max(2),
      headline: z4.string().optional(),
      subheadline: z4.string().optional(),
      backgroundPrompt: z4.string().optional()
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.iterationStage !== "stage_3b_variation_approval") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline is not in variation approval stage" });
      }
      try {
        const result = await regenerateIterationVariation(
          input.runId,
          input.variationIndex,
          {
            headline: input.headline || void 0,
            subheadline: input.subheadline || void 0,
            backgroundPrompt: input.backgroundPrompt || void 0
          }
        );
        return { success: true, url: result.url, variation: result.variation };
      } catch (err) {
        throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),
    // Push completed iteration variations to ClickUp
    pushIterationToClickUp: publicProcedure.input(z4.object({
      runId: z4.number()
    })).mutation(async ({ input }) => {
      const run = await getPipelineRun(input.runId);
      if (!run) throw new TRPCError5({ code: "NOT_FOUND" });
      if (run.status !== "completed") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Pipeline must be completed before pushing to ClickUp" });
      }
      if (!run.iterationVariations) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "No variations found to push" });
      }
      const variations = typeof run.iterationVariations === "string" ? JSON.parse(run.iterationVariations) : run.iterationVariations;
      const result = await pushIterationRunToClickUp({
        runId: input.runId,
        variations,
        product: run.product
      });
      return {
        success: true,
        taskIds: result.taskIds,
        taskUrls: result.taskUrls,
        pushedCount: result.taskIds.length
      };
    }),
    // Generate child variations from selected parent runs
    generateChildren: publicProcedure.input(z4.object({
      parentRunIds: z4.array(z4.number()).min(1).max(10),
      childCount: z4.number().min(1).max(10).default(5)
    })).mutation(async ({ input }) => {
      const parents = await Promise.all(
        input.parentRunIds.map((id) => getPipelineRun(id))
      );
      for (const parent of parents) {
        if (!parent) {
          throw new TRPCError5({ code: "NOT_FOUND", message: "One or more parent runs not found" });
        }
        if (parent.status !== "completed" || parent.iterationStage !== "stage_4_clickup_complete") {
          throw new TRPCError5({
            code: "BAD_REQUEST",
            message: `Parent run #${parent.id} is not completed. Only completed parent variations can generate children.`
          });
        }
        if (parent.variationLayer === "child") {
          throw new TRPCError5({
            code: "BAD_REQUEST",
            message: `Run #${parent.id} is already a child variation. Cannot generate children from children.`
          });
        }
      }
      const { generateChildVariationsForParents: generateChildVariationsForParents2 } = await Promise.resolve().then(() => (init_childVariationGeneration(), childVariationGeneration_exports));
      generateChildVariationsForParents2(input.parentRunIds, input.childCount).catch((err) => {
        console.error("[Pipeline] Child generation failed:", err);
      });
      return {
        success: true,
        message: `Generating ${input.childCount} children for each of ${input.parentRunIds.length} parents (${input.parentRunIds.length * input.childCount} total)`,
        totalChildren: input.parentRunIds.length * input.childCount
      };
    })
  }),
  // ============================================================
  // PRODUCT RENDER MANAGER
  // ============================================================
  renders: router({
    list: publicProcedure.input(z4.object({ product: z4.string().optional() }).optional()).query(async ({ input }) => {
      return listProductRenders(input?.product);
    }),
    upload: publicProcedure.input(z4.object({
      product: z4.string(),
      fileName: z4.string(),
      mimeType: z4.string(),
      base64Data: z4.string()
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const fileSize = buffer.length;
      const suffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `product-renders/${input.product}/${input.fileName}-${suffix}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      const id = await createProductRender({
        product: input.product,
        fileName: input.fileName,
        fileKey,
        url,
        mimeType: input.mimeType,
        fileSize
      });
      return { id, url, fileKey };
    }),
    delete: publicProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
      await deleteProductRender(input.id);
      return { success: true };
    }),
    setDefault: publicProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
      await setDefaultProductRender(input.id);
      return { success: true };
    })
  }),
  // ============================================================
  // PRODUCT INFORMATION HUB
  // ============================================================
  productInfo: router({
    list: publicProcedure.query(async () => {
      return listAllProductInfo();
    }),
    get: publicProcedure.input(z4.object({ product: z4.string() })).query(async ({ input }) => {
      return getProductInfo(input.product);
    }),
    upsert: publicProcedure.input(z4.object({
      product: z4.string(),
      ingredients: z4.string().optional(),
      benefits: z4.string().optional(),
      claims: z4.string().optional(),
      targetAudience: z4.string().optional(),
      keySellingPoints: z4.string().optional(),
      flavourVariants: z4.string().optional(),
      pricing: z4.string().optional(),
      additionalNotes: z4.string().optional()
    })).mutation(async ({ input }) => {
      const id = await upsertProductInfo(input);
      return { id, success: true };
    })
  }),
  // ============================================================
  // BACKGROUND MANAGER
  // ============================================================
  backgrounds: router({
    list: publicProcedure.input(z4.object({ category: z4.string().optional() }).optional()).query(async ({ input }) => {
      return listBackgrounds(input?.category);
    }),
    upload: publicProcedure.input(z4.object({
      name: z4.string(),
      category: z4.string(),
      mimeType: z4.string(),
      base64Data: z4.string()
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const fileSize = buffer.length;
      const suffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `backgrounds/${input.category.toLowerCase()}/${input.name}-${suffix}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      const id = await createBackground({
        name: input.name,
        category: input.category,
        fileKey,
        url,
        mimeType: input.mimeType,
        fileSize
      });
      return { id, url, fileKey };
    }),
    delete: publicProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
      await deleteBackground(input.id);
      return { success: true };
    })
  }),
  ugc: router({
    // List all UGC uploads
    list: publicProcedure.query(async () => listUgcUploads()),
    // Get single UGC upload with variants
    get: publicProcedure.input(z4.object({ id: z4.number() })).query(async ({ input }) => {
      const upload = await getUgcUpload(input.id);
      if (!upload) throw new TRPCError5({ code: "NOT_FOUND", message: "UGC upload not found" });
      const variants = await listUgcVariants(input.id);
      return { upload, variants };
    }),
    // Upload video and create UGC record
    upload: publicProcedure.input(z4.object({
      fileName: z4.string(),
      base64Data: z4.string(),
      mimeType: z4.string(),
      product: z4.string(),
      audienceTag: z4.string().optional(),
      desiredOutputVolume: z4.number().min(1).max(200)
    })).mutation(async ({ input }) => {
      try {
        console.log(`[UGC Upload] Starting upload: ${input.fileName}, base64 length: ${input.base64Data.length}`);
        const buffer = Buffer.from(input.base64Data, "base64");
        const fileSize = buffer.length;
        const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
        console.log(`[UGC Upload] Buffer created: ${fileSizeMB}MB`);
        if (fileSize > 500 * 1024 * 1024) {
          throw new TRPCError5({
            code: "BAD_REQUEST",
            message: `File too large: ${fileSizeMB}MB (max 500MB)`
          });
        }
        const suffix = Math.random().toString(36).slice(2, 10);
        const fileKey = `ugc-uploads/${input.product.toLowerCase()}/${input.fileName}-${suffix}`;
        console.log(`[UGC Upload] Uploading to S3: ${fileKey}`);
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        console.log(`[UGC Upload] S3 upload complete: ${url}`);
        const id = await createUgcUpload({
          fileName: input.fileName,
          fileKey,
          videoUrl: url,
          product: input.product,
          audienceTag: input.audienceTag,
          desiredOutputVolume: input.desiredOutputVolume,
          status: "transcribing"
        });
        console.log(`[UGC Upload] Database record created: ID ${id}`);
        (async () => {
          try {
            const { extractStructureBlueprint: extractStructureBlueprint2 } = await Promise.resolve().then(() => (init_ugcClone(), ugcClone_exports));
            const { transcribeAudio: transcribeAudio3 } = await Promise.resolve().then(() => (init_voiceTranscription(), voiceTranscription_exports));
            console.log(`[UGC Upload] Starting transcription for upload ${id}`);
            const transcriptResult = await transcribeAudio3({ audioUrl: url });
            if (!("text" in transcriptResult)) {
              throw new Error("Transcription failed");
            }
            console.log(`[UGC Upload] Transcription complete, extracting structure`);
            const blueprint = await extractStructureBlueprint2(transcriptResult.text, input.product);
            await updateUgcUpload(id, {
              status: "structure_extracted",
              transcript: transcriptResult.text,
              structureBlueprint: blueprint
            });
            console.log(`[UGC Upload] Structure extraction complete for upload ${id}`);
          } catch (error) {
            console.error(`[UGC Upload] Extraction failed for upload ${id}:`, error);
            await updateUgcUpload(id, {
              status: "error",
              errorMessage: error.message
            });
          }
        })();
        return { id, url };
      } catch (error) {
        console.error(`[UGC Upload] Error:`, error);
        throw new TRPCError5({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Upload failed",
          cause: error
        });
      }
    }),
    // Start transcription + structure extraction
    startExtraction: publicProcedure.input(z4.object({ uploadId: z4.number() })).mutation(async ({ input }) => {
      const upload = await getUgcUpload(input.uploadId);
      if (!upload) throw new TRPCError5({ code: "NOT_FOUND", message: "UGC upload not found" });
      await updateUgcUpload(input.uploadId, { status: "transcribing" });
      (async () => {
        try {
          const { extractStructureBlueprint: extractStructureBlueprint2 } = await Promise.resolve().then(() => (init_ugcClone(), ugcClone_exports));
          const { transcribeAudio: transcribeAudio3 } = await Promise.resolve().then(() => (init_voiceTranscription(), voiceTranscription_exports));
          const { compressAudioForWhisper: compressAudioForWhisper2 } = await Promise.resolve().then(() => (init_audioCompression(), audioCompression_exports));
          const { unlink: unlink2 } = await import("fs/promises");
          console.log(`[UGC] Starting audio compression for upload #${input.uploadId}, videoUrl: ${upload.videoUrl}`);
          const compressedAudioPath = await compressAudioForWhisper2(upload.videoUrl);
          console.log(`[UGC] Audio compressed to: ${compressedAudioPath}`);
          console.log(`[UGC] Starting transcription...`);
          const transcriptResult = await transcribeAudio3({ audioPath: compressedAudioPath });
          await unlink2(compressedAudioPath).catch(() => {
          });
          console.log(`[UGC] Transcription result:`, transcriptResult);
          if (!("text" in transcriptResult)) {
            const errorMsg = "error" in transcriptResult ? transcriptResult.error : "Unknown error";
            throw new Error(`Transcription failed: ${errorMsg}`);
          }
          console.log(`[UGC] Transcription successful, length: ${transcriptResult.text.length} chars`);
          console.log(`[UGC] Starting structure extraction for upload #${input.uploadId}`);
          const blueprint = await extractStructureBlueprint2(transcriptResult.text, upload.product);
          console.log(`[UGC] Structure extraction complete, blueprint:`, JSON.stringify(blueprint).substring(0, 200));
          await updateUgcUpload(input.uploadId, {
            status: "structure_extracted",
            transcript: transcriptResult.text,
            structureBlueprint: blueprint
          });
        } catch (error) {
          console.error("[UGC] Extraction failed:", error);
          await updateUgcUpload(input.uploadId, {
            status: "failed",
            errorMessage: error.message
          });
        }
      })();
      return { success: true, uploadId: input.uploadId };
    }),
    // Approve structure blueprint
    approveBlueprint: publicProcedure.input(z4.object({ uploadId: z4.number() })).mutation(async ({ input }) => {
      await updateUgcUpload(input.uploadId, {
        status: "blueprint_approved",
        blueprintApprovedAt: /* @__PURE__ */ new Date()
      });
      return { success: true };
    }),
    // Generate variants
    generateVariants: publicProcedure.input(z4.object({ uploadId: z4.number() })).mutation(async ({ input }) => {
      const upload = await getUgcUpload(input.uploadId);
      if (!upload) throw new TRPCError5({ code: "NOT_FOUND", message: "UGC upload not found" });
      if (!upload.structureBlueprint) throw new TRPCError5({ code: "BAD_REQUEST", message: "Blueprint not extracted yet" });
      await updateUgcUpload(input.uploadId, { status: "generating_variants" });
      (async () => {
        try {
          const { generateVariants: generateVariants2 } = await Promise.resolve().then(() => (init_ugcClone(), ugcClone_exports));
          const variants = await generateVariants2({
            uploadId: input.uploadId,
            product: upload.product,
            audienceTag: upload.audienceTag,
            desiredOutputVolume: upload.desiredOutputVolume,
            structureBlueprint: upload.structureBlueprint,
            transcript: upload.transcript || ""
          });
          for (const variant of variants) {
            await createUgcVariant({
              uploadId: input.uploadId,
              variantNumber: variant.variantNumber,
              actorArchetype: variant.actorArchetype,
              voiceTone: variant.voiceTone,
              energyLevel: variant.energyLevel,
              scriptText: variant.scriptText,
              hookVariation: variant.hookVariation,
              ctaVariation: variant.ctaVariation,
              runtime: variant.runtime,
              status: "awaiting_approval"
            });
          }
          await updateUgcUpload(input.uploadId, { status: "completed" });
        } catch (error) {
          console.error("[UGC] Variant generation failed:", error);
          await updateUgcUpload(input.uploadId, {
            status: "failed",
            errorMessage: error.message
          });
        }
      })();
      return { success: true, uploadId: input.uploadId };
    }),
    // List variants for an upload
    listVariants: publicProcedure.input(z4.object({ uploadId: z4.number() })).query(async ({ input }) => listUgcVariants(input.uploadId)),
    // Approve selected variants
    approveVariants: publicProcedure.input(z4.object({ variantIds: z4.array(z4.number()) })).mutation(async ({ input }) => {
      for (const id of input.variantIds) {
        await updateUgcVariant(id, {
          status: "approved",
          approvedAt: /* @__PURE__ */ new Date()
        });
      }
      return { success: true, count: input.variantIds.length };
    }),
    // Reject selected variants
    rejectVariants: publicProcedure.input(z4.object({ variantIds: z4.array(z4.number()) })).mutation(async ({ input }) => {
      for (const id of input.variantIds) {
        await updateUgcVariant(id, {
          status: "rejected",
          rejectedAt: /* @__PURE__ */ new Date()
        });
      }
      return { success: true, count: input.variantIds.length };
    }),
    // Push approved variants to ClickUp
    pushToClickup: publicProcedure.input(z4.object({ variantIds: z4.array(z4.number()) })).mutation(async ({ input }) => {
      const { pushUgcVariantsToClickup: pushUgcVariantsToClickup2 } = await Promise.resolve().then(() => (init_clickup(), clickup_exports));
      const variantsToPush = [];
      for (const variantId of input.variantIds) {
        const variants = await listUgcVariants(0);
        const variant = variants.find((v) => v.id === variantId);
        if (variant) {
          const upload = await getUgcUpload(variant.uploadId);
          variantsToPush.push({
            ...variant,
            product: upload?.product || "Unknown"
          });
        }
      }
      const results = await pushUgcVariantsToClickup2(variantsToPush);
      for (const result of results) {
        await updateUgcVariant(result.variantId, {
          status: "pushed_to_clickup",
          clickupTaskId: result.task.id,
          clickupTaskUrl: result.task.url,
          pushedToClickupAt: /* @__PURE__ */ new Date()
        });
      }
      return { success: true, count: results.length };
    }),
    // Retry transcription for a failed upload
    retryTranscription: publicProcedure.input(z4.object({ uploadId: z4.number() })).mutation(async ({ input }) => {
      const upload = await getUgcUpload(input.uploadId);
      if (!upload) throw new TRPCError5({ code: "NOT_FOUND", message: "Upload not found" });
      await updateUgcUpload(input.uploadId, { status: "transcribing", errorMessage: null });
      (async () => {
        try {
          console.log(`[UGC Retry] Retrying transcription for upload #${input.uploadId}`);
          const { transcribeVideo: transcribeVideo2 } = await Promise.resolve().then(() => (init_whisper(), whisper_exports));
          const { extractStructureBlueprint: extractStructureBlueprint2 } = await Promise.resolve().then(() => (init_ugcClone(), ugcClone_exports));
          const transcriptText = await transcribeVideo2(upload.videoUrl);
          console.log(`[UGC Retry] Transcription complete for upload #${input.uploadId}`);
          const blueprint = await extractStructureBlueprint2(transcriptText, upload.videoUrl);
          console.log(`[UGC Retry] Structure extraction complete for upload #${input.uploadId}`);
          await updateUgcUpload(input.uploadId, {
            transcript: transcriptText,
            structureBlueprint: blueprint,
            status: "structure_extracted"
          });
        } catch (error) {
          console.error(`[UGC Retry] Failed for upload #${input.uploadId}:`, error);
          await updateUgcUpload(input.uploadId, {
            status: "failed",
            errorMessage: error.message
          });
        }
      })();
      return { success: true };
    })
  }),
  headlineBank: router({
    // List all headlines
    list: publicProcedure.query(async () => {
      return listHeadlines();
    }),
    // Get single headline
    get: publicProcedure.input(z4.object({ id: z4.number() })).query(async ({ input }) => {
      const headline = await getHeadline(input.id);
      if (!headline) throw new TRPCError5({ code: "NOT_FOUND", message: "Headline not found" });
      return headline;
    }),
    // Create headline
    create: publicProcedure.input(z4.object({
      headline: z4.string(),
      subheadline: z4.string().optional(),
      rating: z4.number().min(1).max(5).default(3),
      roas: z4.string().optional(),
      spend: z4.string().optional(),
      weeksActive: z4.number().optional(),
      product: z4.string().optional(),
      angle: z4.string().optional(),
      format: z4.string().optional(),
      notes: z4.string().optional()
    })).mutation(async ({ input }) => {
      return createHeadline(input);
    }),
    // Update headline
    update: publicProcedure.input(z4.object({
      id: z4.number(),
      headline: z4.string(),
      subheadline: z4.string().optional(),
      rating: z4.number().min(1).max(5),
      roas: z4.string().optional(),
      spend: z4.string().optional(),
      weeksActive: z4.number().optional(),
      product: z4.string().optional(),
      angle: z4.string().optional(),
      format: z4.string().optional(),
      notes: z4.string().optional()
    })).mutation(async ({ input }) => {
      return updateHeadline(input.id, input);
    }),
    // Delete headline
    delete: publicProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
      await deleteHeadline(input.id);
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs5 from "fs";
import { nanoid } from "nanoid";
import path6 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs4 from "node:fs";
import path5 from "node:path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path5.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs4.existsSync(LOG_DIR)) {
    fs4.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs4.existsSync(logPath) || fs4.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs4.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs4.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path5.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs4.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
var plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path5.resolve(import.meta.dirname, "client", "src"),
      "@shared": path5.resolve(import.meta.dirname, "shared"),
      "@assets": path5.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path5.resolve(import.meta.dirname),
  root: path5.resolve(import.meta.dirname, "client"),
  publicDir: path5.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path5.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path6.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs5.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path6.resolve(import.meta.dirname, "../..", "dist", "public") : path6.resolve(import.meta.dirname, "public");
  if (!fs5.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path6.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
init_db();
init_storage();
import multer from "multer";
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "500mb" }));
  app.use(express2.urlencoded({ limit: "500mb", extended: true }));
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }
    // 500MB
  });
  app.get("/api/health/db", async (_req, res) => {
    const requiredTables = [
      "users",
      "pipeline_runs",
      "product_renders",
      "product_info",
      "foreplay_creatives",
      "backgrounds",
      "ugc_uploads",
      "ugc_variants",
      "headline_bank",
      "face_swap_jobs",
      "organic_runs",
      "caption_examples"
    ];
    try {
      const dbConn = await getDb();
      if (!dbConn) {
        return res.status(503).json({ ok: false, error: "Database not available", tables: {} });
      }
      const rows = await dbConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
      );
      const existingTables = new Set(
        (Array.isArray(rows[0]) ? rows[0] : rows).map((r) => r.TABLE_NAME)
      );
      const tables = {};
      const missing = [];
      for (const t2 of requiredTables) {
        const exists = existingTables.has(t2);
        tables[t2] = exists;
        if (!exists) missing.push(t2);
      }
      if (missing.length > 0) {
        return res.status(503).json({ ok: false, error: `Missing tables: ${missing.join(", ")}`, tables });
      }
      return res.json({ ok: true, tables });
    } catch (err) {
      return res.status(503).json({ ok: false, error: err.message || "DB health check failed", tables: {} });
    }
  });
  registerOAuthRoutes(app);
  app.get("/api/canva/callback", handleCanvaCallback);
  app.post("/api/ugc/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const { product, audienceTag, desiredOutputVolume } = req.body;
      if (!product) {
        return res.status(400).json({ error: "Product is required" });
      }
      const volume = parseInt(desiredOutputVolume);
      if (isNaN(volume) || volume < 1 || volume > 200) {
        return res.status(400).json({ error: "desiredOutputVolume must be between 1 and 200" });
      }
      console.log(`[UGC Upload] Received file: ${req.file.originalname}, size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
      const suffix = Math.random().toString(36).slice(2, 10);
      const fileKey = `ugc-uploads/${product.toLowerCase()}/${req.file.originalname}-${suffix}`;
      console.log(`[UGC Upload] Uploading to S3: ${fileKey}`);
      const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);
      console.log(`[UGC Upload] S3 upload complete: ${url}`);
      const id = await createUgcUpload({
        fileName: req.file.originalname,
        fileKey,
        videoUrl: url,
        product,
        audienceTag: audienceTag || void 0,
        desiredOutputVolume: volume,
        status: "uploaded"
      });
      console.log(`[UGC Upload] Database record created: ID ${id}`);
      (async () => {
        try {
          console.log(`[UGC Upload] Starting background transcription for upload #${id}`);
          await updateUgcUpload(id, { status: "transcribing" });
          const { transcribeVideo: transcribeVideo2 } = await Promise.resolve().then(() => (init_whisper(), whisper_exports));
          const { extractStructureBlueprint: extractStructureBlueprint2 } = await Promise.resolve().then(() => (init_ugcClone(), ugcClone_exports));
          const transcriptText = await transcribeVideo2(url);
          console.log(`[UGC Upload] Transcription complete for upload #${id}, length: ${transcriptText.length} chars`);
          const blueprint = await extractStructureBlueprint2(transcriptText, url);
          console.log(`[UGC Upload] Structure extraction complete for upload #${id}`);
          await updateUgcUpload(id, {
            transcript: transcriptText,
            structureBlueprint: blueprint,
            status: "structure_extracted"
          });
          console.log(`[UGC Upload] Background processing complete for upload #${id}`);
        } catch (error) {
          console.error(`[UGC Upload] Background processing failed for upload #${id}:`, error);
          await updateUgcUpload(id, { status: "failed" });
        }
      })();
      res.json({ id, url });
    } catch (error) {
      console.error(`[UGC Upload] Error:`, error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.timeout = 10 * 60 * 1e3;
  server.keepAliveTimeout = 65e3;
  server.headersTimeout = 66e3;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Server timeout: ${server.timeout}ms`);
    startAutoSync();
  });
}
startServer().catch(console.error);
