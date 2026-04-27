import { eq, desc, and, sql, inArray, gte, lte, between, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { isNull, isNotNull } from "drizzle-orm";
import {
  InsertUser, users, pipelineRuns, InsertPipelineRun, productRenders, InsertProductRender,
  productInfo, InsertProductInfo, foreplayCreatives, InsertForeplayCreative, backgrounds,
  InsertBackground, ugcUploads, ugcVariants, headlineBank, faceSwapJobs, organicRuns,
  captionExamples, people, InsertPerson, scriptStructures, InsertScriptStructure,
  scriptAudiences, InsertScriptAudience,
  // Creative Analytics OS
  creativeAssets, InsertCreativeAsset, CreativeAsset,
  ads, InsertAd, Ad,
  adDailyStats, InsertAdDailyStat, AdDailyStat,
  adAttributionStats, InsertAdAttributionStat, AdAttributionStat,
  creativeScores, InsertCreativeScore, CreativeScore,
  adCreativeLinks, InsertAdCreativeLink, AdCreativeLink,
  adSyncState, InsertAdSyncState, AdSyncState,
  creativeAiTags, InsertCreativeAiTag, CreativeAiTag,
  patternInsights, InsertPatternInsight, PatternInsight,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    openId: users.openId,
    lastSignedIn: users.lastSignedIn,
    createdAt: users.createdAt,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserPasswordHash(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// Pipeline run helpers
export async function createPipelineRun(data: InsertPipelineRun) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pipelineRuns).values(data);
  const insertId = (result as any)[0]?.insertId;
  return insertId;
}

export async function updatePipelineRun(id: number, data: Partial<InsertPipelineRun>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pipelineRuns).set(data).where(eq(pipelineRuns.id, id));
}

export async function getPipelineRun(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listPipelineRuns(limit = 50, pipelineType?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (pipelineType) {
    return db.select().from(pipelineRuns)
      .where(eq(pipelineRuns.pipelineType, pipelineType as any))
      .orderBy(desc(pipelineRuns.createdAt)).limit(limit);
  }
  return db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.createdAt)).limit(limit);
}

/**
 * Get pipeline status summary grouped by foreplayAdId.
 * Returns latest status and run count for each ad.
 */
export async function getPipelineStatusByAdIds(adIds: string[]): Promise<Record<string, { status: string; count: number }>> {
  if (adIds.length === 0) return {};
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({
    foreplayAdId: pipelineRuns.foreplayAdId,
    status: pipelineRuns.status,
    completedAt: pipelineRuns.completedAt,
    createdAt: pipelineRuns.createdAt,
  }).from(pipelineRuns)
    .where(inArray(pipelineRuns.foreplayAdId, adIds))
    .orderBy(desc(pipelineRuns.createdAt));

  // Aggregate per-ad: prefer the "best" status across runs (completed > failed > running > pending).
  // A run with completedAt set or status="completed" always wins. Runs stuck in "running" for
  // >30 min are treated as stale (effectively not running) — they'd otherwise hide a successful
  // earlier run from the badge.
  const STALE_MS = 30 * 60 * 1000;
  const STATUS_PRIORITY: Record<string, number> = { completed: 4, failed: 3, running: 2, pending: 1 };
  const now = Date.now();

  const perAd: Record<string, { status: string; count: number }> = {};
  for (const row of rows) {
    if (!row.foreplayAdId) continue;
    let effectiveStatus = row.status;
    if (row.completedAt) {
      effectiveStatus = "completed";
    } else if ((row.status === "running" || row.status === "pending") && row.createdAt) {
      const ageMs = now - new Date(row.createdAt).getTime();
      if (ageMs > STALE_MS) effectiveStatus = "failed"; // stale → show as failed rather than perpetually running
    }
    const existing = perAd[row.foreplayAdId];
    if (!existing) {
      perAd[row.foreplayAdId] = { status: effectiveStatus, count: 1 };
    } else {
      existing.count++;
      if ((STATUS_PRIORITY[effectiveStatus] ?? 0) > (STATUS_PRIORITY[existing.status] ?? 0)) {
        existing.status = effectiveStatus;
      }
    }
  }
  return perAd;
}

// ============================================================
// Product Render helpers
// ============================================================
export async function createProductRender(data: InsertProductRender) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productRenders).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (insertId != null) {
    // Set this render as the default for the product; clear default on others
    await db.update(productRenders).set({ isDefault: 0 }).where(eq(productRenders.product, data.product));
    await db.update(productRenders).set({ isDefault: 1 }).where(eq(productRenders.id, insertId));
  }
  return insertId;
}

export async function listProductRenders(product?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (product) {
    return db.select().from(productRenders).where(eq(productRenders.product, product)).orderBy(desc(productRenders.isDefault), desc(productRenders.createdAt));
  }
  return db.select().from(productRenders).orderBy(desc(productRenders.isDefault), desc(productRenders.createdAt));
}

/** Returns the default render for the product (isDefault=1), or the most recent if none set. */
export async function getDefaultProductRender(product: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const withDefault = await db.select().from(productRenders).where(and(eq(productRenders.product, product), eq(productRenders.isDefault, 1))).limit(1);
  if (withDefault.length > 0) return withDefault[0];
  const fallback = await db.select().from(productRenders).where(eq(productRenders.product, product)).orderBy(desc(productRenders.createdAt)).limit(1);
  return fallback[0] ?? null;
}

export async function getProductRendersByProduct(product: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productRenders).where(eq(productRenders.product, product)).orderBy(desc(productRenders.isDefault), desc(productRenders.createdAt));
}

export async function setDefaultProductRender(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const row = await db.select().from(productRenders).where(eq(productRenders.id, id)).limit(1);
  if (row.length === 0) throw new Error("Product render not found");
  const product = row[0].product;
  await db.update(productRenders).set({ isDefault: 0 }).where(eq(productRenders.product, product));
  await db.update(productRenders).set({ isDefault: 1 }).where(eq(productRenders.id, id));
}

/** Returns all child pipeline runs for a given parent run ID. */
export async function getChildRunsByParentId(parentRunId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(pipelineRuns)
    .where(and(eq(pipelineRuns.parentRunId, parentRunId), eq(pipelineRuns.variationLayer, "child")))
    .orderBy(desc(pipelineRuns.createdAt));
}

export async function getProductRenderById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const row = await db.select().from(productRenders).where(eq(productRenders.id, id)).limit(1);
  return row[0] ?? null;
}

export async function listProductRendersByFlavour(product: string, flavour: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productRenders)
    .where(and(eq(productRenders.product, product), eq(productRenders.flavour, flavour)))
    .orderBy(desc(productRenders.isDefault), desc(productRenders.createdAt));
}

export async function deleteProductRender(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productRenders).where(eq(productRenders.id, id));
}

export async function updateProductRender(
  id: number,
  data: { fileName?: string; tags?: string | null; flavour?: string | null; angle?: string | null },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patch: Record<string, unknown> = {};
  if (data.fileName !== undefined) patch.fileName = data.fileName.slice(0, 256);
  if (data.tags !== undefined) patch.tags = data.tags === null ? null : data.tags.slice(0, 256);
  if (data.flavour !== undefined) patch.flavour = data.flavour === null ? null : data.flavour.slice(0, 64);
  if (data.angle !== undefined) patch.angle = data.angle === null ? null : data.angle.slice(0, 32);
  if (Object.keys(patch).length === 0) return;
  await db.update(productRenders).set(patch).where(eq(productRenders.id, id));
}

// ============================================================
// People Type Reference helpers
// ============================================================
export async function createPerson(data: InsertPerson) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(people).values(data);
  return (result as any)[0]?.insertId;
}

export async function listPeople() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(people).where(isNull(people.deletedAt)).orderBy(desc(people.createdAt));
}

export async function getPerson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const row = await db.select().from(people).where(and(eq(people.id, id), isNull(people.deletedAt))).limit(1);
  return row[0] ?? null;
}

export async function deletePerson(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(people).set({ deletedAt: new Date() }).where(eq(people.id, id));
}

// ============================================================
// Product Info helpers
// ============================================================
export async function getProductInfo(product: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(productInfo).where(eq(productInfo.product, product)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listAllProductInfo() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productInfo).orderBy(productInfo.product);
}

// ============================================================
// Foreplay Creatives helpers
// ============================================================

/**
 * Upsert a Foreplay creative — insert if new, skip if exists (dedup by foreplayAdId).
 * Returns true if a new row was inserted, false if it already existed.
 */
export async function upsertForeplayCreative(data: InsertForeplayCreative): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Sanitise data — truncate varchar fields to fit column limits, convert nullish to null
  const sanitised: InsertForeplayCreative = {
    foreplayAdId: String(data.foreplayAdId || "").slice(0, 255),
    type: data.type,
    board: String(data.board || "").slice(0, 63),
    title: data.title ? String(data.title).slice(0, 10000) : null,
    brandName: data.brandName ? String(data.brandName).slice(0, 255) : null,
    thumbnailUrl: data.thumbnailUrl || null,
    imageUrl: data.imageUrl || null,
    mediaUrl: data.mediaUrl || null,
    mediaType: data.mediaType ? String(data.mediaType).slice(0, 63) : null,
    platform: data.platform ? String(data.platform).slice(0, 63) : null,
    description: data.description ? String(data.description).slice(0, 50000) : null,
    headline: data.headline || null,
    displayFormat: data.displayFormat ? String(data.displayFormat).slice(0, 63) : null,
    transcription: data.transcription || null,
    foreplayCreatedAt: data.foreplayCreatedAt ? String(data.foreplayCreatedAt).slice(0, 127) : null,
    isNew: data.isNew ?? 1,
  };

  try {
    const result = await db.insert(foreplayCreatives).values(sanitised).onDuplicateKeyUpdate({
      set: { syncedAt: new Date() },
    });
    // MySQL: affectedRows=1 for new insert, affectedRows=2 for on-duplicate-key update
    const affectedRows = (result as any)[0]?.affectedRows ?? 1;
    return affectedRows === 1;
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") return false;
    // Log the full error for debugging
    console.error(`[DB] upsertForeplayCreative FULL ERROR for ${data.foreplayAdId}:`, {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage,
      message: err.message?.slice(0, 500),
    });
    throw err;
  }
}

/**
 * List locally cached Foreplay creatives, optionally filtered by type.
 * Newest first.
 */
export async function listForeplayCreatives(type?: "VIDEO" | "STATIC", limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (type) {
    return db.select().from(foreplayCreatives)
      .where(eq(foreplayCreatives.type, type))
      .orderBy(desc(foreplayCreatives.createdAt))
      .limit(limit)
      .offset(offset);
  }
  return db.select().from(foreplayCreatives)
    .orderBy(desc(foreplayCreatives.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Get all existing foreplayAdIds to check for duplicates efficiently.
 */
export async function getExistingForeplayAdIds(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ foreplayAdId: foreplayCreatives.foreplayAdId }).from(foreplayCreatives);
  return new Set(rows.map(r => r.foreplayAdId));
}

/**
 * Get content fingerprints for all existing creatives.
 * Used to skip ads whose content already exists under a different foreplayAdId.
 */
export async function getExistingContentFingerprints(): Promise<Set<string>> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({
    thumbnailUrl: foreplayCreatives.thumbnailUrl,
    title: foreplayCreatives.title,
    brandName: foreplayCreatives.brandName,
  }).from(foreplayCreatives);
  return new Set(rows.map(r => contentFingerprint(r.thumbnailUrl, r.title, r.brandName)));
}

/**
 * Build a content fingerprint from an ad's visual identity.
 * Two ads with the same fingerprint are the same underlying creative.
 * Uses title + brand only — thumbnail URLs vary across CDN paths for the same ad.
 * Strips emoji and normalizes whitespace for stable matching.
 */
export function contentFingerprint(thumbnailUrl: string | null, title: string | null, brandName: string | null): string {
  const normalize = (s: string | null) =>
    (s || "")
      .replace(/[^a-zA-Z0-9\s]/g, "")  // strip everything except ASCII letters, numbers, whitespace
      .replace(/\s+/g, " ")             // collapse whitespace
      .toLowerCase()
      .trim();
  return `${normalize(title)}|${normalize(brandName)}`;
}

/**
 * Remove duplicate creatives from the DB, keeping the oldest row per content fingerprint.
 * Returns the number of rows deleted.
 */
export async function deduplicateExistingCreatives(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch all rows, group by content fingerprint, delete all but the oldest per group
  const rows = await db.select({
    id: foreplayCreatives.id,
    thumbnailUrl: foreplayCreatives.thumbnailUrl,
    title: foreplayCreatives.title,
    brandName: foreplayCreatives.brandName,
    createdAt: foreplayCreatives.createdAt,
  }).from(foreplayCreatives).orderBy(foreplayCreatives.createdAt);

  const seen = new Map<string, number>(); // fingerprint → kept id
  const toDelete: number[] = [];

  for (const row of rows) {
    const fp = contentFingerprint(row.thumbnailUrl, row.title, row.brandName);
    if (seen.has(fp)) {
      toDelete.push(row.id);
    } else {
      seen.set(fp, row.id);
    }
  }

  if (toDelete.length > 0) {
    // Delete in batches of 100
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      await db.delete(foreplayCreatives).where(inArray(foreplayCreatives.id, batch));
    }
    console.log(`[DB] Deduplicated ${toDelete.length} duplicate creatives`);
  }

  return toDelete.length;
}

/**
 * Mark all creatives as seen (isNew = 0).
 */
export async function markAllCreativesSeen(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(foreplayCreatives).set({ isNew: 0 }).where(eq(foreplayCreatives.isNew, 1));
}

/**
 * Count new (unseen) creatives.
 */
export async function countNewCreatives(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select({ count: sql<number>`count(*)` }).from(foreplayCreatives).where(eq(foreplayCreatives.isNew, 1));
  return rows[0]?.count || 0;
}

/**
 * Get a single foreplay creative by its internal DB id.
 */
export async function getForeplayCreativeById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(foreplayCreatives).where(eq(foreplayCreatives.id, id)).limit(1);
  return rows[0] || null;
}

/**
 * Update AI analysis fields on a foreplay creative.
 */
export async function updateForeplayCreativeAnalysis(id: number, data: {
  summary: string;
  qualityScore: number;
  suggestedConfig: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(foreplayCreatives).set({
    summary: data.summary,
    qualityScore: data.qualityScore,
    suggestedConfig: data.suggestedConfig,
  }).where(eq(foreplayCreatives.id, id));
}

// ============================================================
// Background helpers
// ============================================================
export async function createBackground(data: InsertBackground) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(backgrounds).values(data);
  return (result as any)[0]?.insertId;
}

export async function listBackgrounds(category?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (category) {
    return db.select().from(backgrounds).where(eq(backgrounds.category, category)).orderBy(desc(backgrounds.createdAt));
  }
  return db.select().from(backgrounds).orderBy(desc(backgrounds.createdAt));
}

export async function deleteBackground(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(backgrounds).where(eq(backgrounds.id, id));
}

export async function getBackground(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(backgrounds).where(eq(backgrounds.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertProductInfo(data: InsertProductInfo) {
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
      additionalNotes: data.additionalNotes,
    }).where(eq(productInfo.product, data.product));
    return existing[0].id;
  } else {
    const result = await db.insert(productInfo).values(data);
    return (result as any)[0]?.insertId;
  }
}

// ============================================================
// UGC Clone Engine
// ============================================================

export async function createUgcUpload(data: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(ugcUploads).values(data);
  return (result as any)[0]?.insertId;
}

export async function listUgcUploads(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(ugcUploads).orderBy(desc(ugcUploads.createdAt));
}

export async function getUgcUpload(id: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select().from(ugcUploads).where(eq(ugcUploads.id, id));
  return results[0] || null;
}

export async function updateUgcUpload(id: number, data: any): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(ugcUploads).set(data).where(eq(ugcUploads.id, id));
}

export async function createUgcVariant(data: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(ugcVariants).values(data);
  return (result as any)[0]?.insertId;
}

export async function getUgcVariant(id: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(ugcVariants).where(eq(ugcVariants.id, id));
  return results[0] || null;
}

export async function listUgcVariants(uploadId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(ugcVariants).where(eq(ugcVariants.uploadId, uploadId)).orderBy(ugcVariants.variantNumber);
}

export async function updateUgcVariant(id: number, data: any): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(ugcVariants).set(data).where(eq(ugcVariants.id, id));
}

// ============================================================
// HEADLINE BANK
// ============================================================

export async function listHeadlines(): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(headlineBank).orderBy(desc(headlineBank.rating), desc(headlineBank.createdAt));
}

export async function getHeadline(id: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  
  const results = await db.select().from(headlineBank).where(eq(headlineBank.id, id)).limit(1);
  return results[0] || null;
}

export async function createHeadline(data: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(headlineBank).values(data);
  return (result as any)[0]?.insertId;
}

export async function updateHeadline(id: number, data: any): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(headlineBank).set(data).where(eq(headlineBank.id, id));
}

export async function deleteHeadline(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(headlineBank).where(eq(headlineBank.id, id));
}

// ============================================================
// Face Swap Jobs
// ============================================================

export async function createFaceSwapJob(data: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(faceSwapJobs).values(data);
  return (result as any)[0]?.insertId;
}

export async function getFaceSwapJob(id: number): Promise<any | null> {
  const db = await getDb();
  if (!db) return null;
  const results = await db.select().from(faceSwapJobs).where(eq(faceSwapJobs.id, id)).limit(1);
  return results[0] || null;
}

export async function updateFaceSwapJob(id: number, data: any): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(faceSwapJobs).set(data).where(eq(faceSwapJobs.id, id));
}

export async function listFaceSwapJobs(limit = 50): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(faceSwapJobs).orderBy(desc(faceSwapJobs.createdAt)).limit(limit);
}

// ============================================================
// Organic Content Pipeline
// ============================================================

export async function createOrganicRun(data: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(organicRuns).values(data);
  return (result as any)[0]?.insertId;
}

export async function getOrganicRun(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(organicRuns).where(eq(organicRuns.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateOrganicRun(id: number, data: any): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(organicRuns).set(data).where(eq(organicRuns.id, id));
}

export async function listOrganicRuns(type?: string, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (type) {
    return db.select().from(organicRuns)
      .where(eq(organicRuns.type, type as any))
      .orderBy(desc(organicRuns.createdAt))
      .limit(limit);
  }
  return db.select().from(organicRuns).orderBy(desc(organicRuns.createdAt)).limit(limit);
}

/** List all content (both ad pipeline_runs and organic_runs) for the Content Library. */
export async function listAllContent(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [adRuns, organicRunsList] = await Promise.all([
    db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.createdAt)).limit(limit),
    db.select().from(organicRuns).orderBy(desc(organicRuns.createdAt)).limit(limit),
  ]);
  return { adRuns, organicRuns: organicRunsList };
}

/**
 * Parse videoInputPath from DB — handles both old single-URL strings
 * and new JSON-serialized arrays for backward compatibility.
 */
export function normalizeVideoInputPaths(videoInputPath: any): string[] {
  if (!videoInputPath) return [];
  if (Array.isArray(videoInputPath)) return videoInputPath;
  if (typeof videoInputPath === "string") {
    try {
      const parsed = JSON.parse(videoInputPath);
      return Array.isArray(parsed) ? parsed : [videoInputPath];
    } catch {
      return [videoInputPath];
    }
  }
  return [];
}

// ============================================================
// Caption Examples (few-shot training data)
// ============================================================

export async function createCaptionExample(data: any): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(captionExamples).values(data);
  return (result as any)[0]?.insertId;
}

export async function listCaptionExamples(pillar?: string, purpose?: string) {
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

export async function deleteCaptionExample(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(captionExamples).where(eq(captionExamples.id, id));
}

// Canva token management
export async function updateUserCanvaTokens(openId: string, accessToken: string, refreshToken: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(users)
    .set({
      canvaAccessToken: accessToken,
      canvaRefreshToken: refreshToken,
      canvaTokenExpiresAt: expiresAt,
    })
    .where(eq(users.openId, openId));
}

export async function getUserCanvaTokens(openId: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select({
    accessToken: users.canvaAccessToken,
    refreshToken: users.canvaRefreshToken,
    expiresAt: users.canvaTokenExpiresAt,
  })
  .from(users)
  .where(eq(users.openId, openId))
  .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ─── Meta user-scope token management ────────────────────────────────────────

/**
 * Update a user's Meta Facebook Login token. Passing `null` for both fields
 * disconnects the account.
 */
export async function updateUserMetaTokens(
  openId: string,
  accessToken: string | null,
  expiresAt: Date | null,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users)
    .set({
      metaUserAccessToken: accessToken,
      metaUserTokenExpiresAt: expiresAt,
      metaUserConnectedAt: accessToken ? new Date() : null,
    })
    .where(eq(users.openId, openId));
}

/** Fetch a specific user's Meta token + expiry + connectedAt. */
export async function getUserMetaTokens(openId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select({
    accessToken: users.metaUserAccessToken,
    expiresAt: users.metaUserTokenExpiresAt,
    connectedAt: users.metaUserConnectedAt,
    name: users.name,
  })
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

/**
 * Find the admin user's Meta token. Used by the preview flow which needs one
 * token to serve all analytics viewers (single-admin shop). Looks for the
 * OWNER_OPEN_ID first, then falls back to any user with role='admin' that has
 * a non-null token, ordered by most recently connected.
 */
export async function getAdminMetaTokens() {
  const db = await getDb();
  if (!db) return null;
  // Try owner first if configured.
  if (ENV.ownerOpenId) {
    const owner = await getUserMetaTokens(ENV.ownerOpenId);
    if (owner?.accessToken) return { ...owner, openId: ENV.ownerOpenId };
  }
  // Fallback: any admin with a token, newest connection first.
  const result = await db.select({
    openId: users.openId,
    accessToken: users.metaUserAccessToken,
    expiresAt: users.metaUserTokenExpiresAt,
    connectedAt: users.metaUserConnectedAt,
    name: users.name,
  })
    .from(users)
    .where(and(eq(users.role, "admin"), isNotNull(users.metaUserAccessToken)))
    .orderBy(desc(users.metaUserConnectedAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// ─── Script Structures ───────────────────────────────────────────────────────

export async function getScriptStructures() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(scriptStructures).orderBy(scriptStructures.category, scriptStructures.name);
}

export async function getScriptStructure(structureId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(scriptStructures).where(eq(scriptStructures.structureId, structureId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createScriptStructure(data: InsertScriptStructure) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scriptStructures).values(data);
  return (result as any)[0]?.insertId as number;
}

export async function updateScriptStructure(structureId: string, data: Partial<InsertScriptStructure>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(scriptStructures).set(data).where(eq(scriptStructures.structureId, structureId));
}

export async function deleteScriptStructure(structureId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(scriptStructures).where(eq(scriptStructures.structureId, structureId));
}

// ─── Script Audiences ────────────────────────────────────────────────────────

export async function getScriptAudiences() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(scriptAudiences).orderBy(scriptAudiences.label);
}

export async function getScriptAudience(audienceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(scriptAudiences).where(eq(scriptAudiences.audienceId, audienceId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createScriptAudience(data: InsertScriptAudience) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(scriptAudiences).values(data);
  return (result as any)[0]?.insertId as number;
}

export async function updateScriptAudience(audienceId: string, data: Partial<InsertScriptAudience>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(scriptAudiences).set(data).where(eq(scriptAudiences.audienceId, audienceId));
}

export async function deleteScriptAudience(audienceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(scriptAudiences).where(eq(scriptAudiences.audienceId, audienceId));
}

// ============================================================================
// Creative Analytics OS — DB helpers (added 2026-04-09)
// ============================================================================

// --- creativeAssets ---

export async function upsertCreativeAsset(data: InsertCreativeAsset): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db.insert(creativeAssets).values({ ...data, lastSeenAt: now }).onDuplicateKeyUpdate({
    set: {
      name: data.name,
      thumbnailUrl: data.thumbnailUrl,
      videoUrl: data.videoUrl,
      adCopyBody: data.adCopyBody,
      adCopyTitle: data.adCopyTitle,
      durationSeconds: data.durationSeconds,
      lastSeenAt: now,
      pipelineRunId: data.pipelineRunId,
      foreplayCreativeId: data.foreplayCreativeId,
      ugcVariantId: data.ugcVariantId,
    },
  });
  const result = await db.select({ id: creativeAssets.id }).from(creativeAssets).where(eq(creativeAssets.creativeHash, data.creativeHash)).limit(1);
  return result[0]?.id ?? 0;
}

export async function getCreativeAssetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(creativeAssets).where(eq(creativeAssets.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCreativeAssetByHash(creativeHash: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(creativeAssets).where(eq(creativeAssets.creativeHash, creativeHash)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listCreativeAssets(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(creativeAssets).orderBy(desc(creativeAssets.lastSeenAt)).limit(limit);
}

// --- ads ---

export async function upsertAd(data: InsertAd): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const now = new Date();
  await db.insert(ads).values({ ...data, lastSeenAt: now }).onDuplicateKeyUpdate({
    set: {
      creativeAssetId: data.creativeAssetId,
      adsetId: data.adsetId,
      adsetName: data.adsetName,
      campaignId: data.campaignId,
      campaignName: data.campaignName,
      adAccountId: data.adAccountId,
      name: data.name,
      permalink: data.permalink,
      launchDate: data.launchDate,
      status: data.status,
      lastSeenAt: now,
    },
  });
  const result = await db.select({ id: ads.id }).from(ads)
    .where(and(eq(ads.platform, data.platform), eq(ads.externalAdId, data.externalAdId)))
    .limit(1);
  return result[0]?.id ?? 0;
}

export async function getAdByExternalId(platform: string, externalAdId: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ads)
    .where(and(eq(ads.platform, platform), eq(ads.externalAdId, externalAdId)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAdById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ads).where(eq(ads.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listAdsForCreative(creativeAssetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ads).where(eq(ads.creativeAssetId, creativeAssetId)).orderBy(desc(ads.launchDate));
}

export async function listAdsForAccount(adAccountId: string, limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ads).where(eq(ads.adAccountId, adAccountId)).orderBy(desc(ads.launchDate)).limit(limit);
}

// --- adDailyStats ---

export async function upsertAdDailyStat(data: InsertAdDailyStat): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(adDailyStats).values(data).onDuplicateKeyUpdate({
    set: {
      spendCents: data.spendCents,
      impressions: data.impressions,
      clicks: data.clicks,
      reach: data.reach,
      cpmCents: data.cpmCents,
      cpcCents: data.cpcCents,
      ctrBp: data.ctrBp,
      outboundCtrBp: data.outboundCtrBp,
      videoPlayCount: data.videoPlayCount,
      video25Count: data.video25Count,
      video50Count: data.video50Count,
      video75Count: data.video75Count,
      video100Count: data.video100Count,
      videoThruplayCount: data.videoThruplayCount,
      videoAvgTimeMs: data.videoAvgTimeMs,
      thumbstopBp: data.thumbstopBp,
      holdRateBp: data.holdRateBp,
      metaPurchaseCount: data.metaPurchaseCount,
      metaPurchaseValueCents: data.metaPurchaseValueCents,
      metaRoasBp: data.metaRoasBp,
      actionsJson: data.actionsJson,
    },
  });
}

export async function bulkUpsertAdDailyStats(rows: InsertAdDailyStat[]): Promise<number> {
  let count = 0;
  for (const row of rows) {
    await upsertAdDailyStat(row);
    count++;
  }
  return count;
}

export async function getAdDailyStatsForAd(adId: number, dateFrom: Date, dateTo: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adDailyStats)
    .where(and(eq(adDailyStats.adId, adId), gte(adDailyStats.date, dateFrom), lte(adDailyStats.date, dateTo)))
    .orderBy(asc(adDailyStats.date));
}

// --- adAttributionStats ---

export async function upsertAdAttributionStat(data: InsertAdAttributionStat): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(adAttributionStats).values(data).onDuplicateKeyUpdate({
    set: {
      adId: data.adId,
      externalAdId: data.externalAdId,
      source: data.source,
      attributionModel: data.attributionModel,
      spendCents: data.spendCents,
      conversions: data.conversions,
      revenueCents: data.revenueCents,
      aovCents: data.aovCents,
      roasBp: data.roasBp,
      cpaCents: data.cpaCents,
    },
  });
}

export async function getAdAttributionStatsForAd(adId: number, dateFrom: Date, dateTo: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adAttributionStats)
    .where(and(eq(adAttributionStats.adId, adId), gte(adAttributionStats.date, dateFrom), lte(adAttributionStats.date, dateTo)))
    .orderBy(asc(adAttributionStats.date));
}

/** Links unlinked adAttributionStats rows to ads rows when Meta sync catches up. */
export async function linkAttributionStatsByHyrosAdId(hyrosAdId: string, adId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.update(adAttributionStats)
    .set({ adId })
    .where(and(eq(adAttributionStats.hyrosAdId, hyrosAdId), isNull(adAttributionStats.adId)));
  return (result as any)[0]?.affectedRows ?? 0;
}

/**
 * Bulk re-link ALL orphaned adAttributionStats rows to their corresponding ads
 * in a single UPDATE. Called at the end of Meta sync after new ads are upserted
 * so that Hyros rows previously written with adId=null (because Meta hadn't
 * seen the ad yet) get retroactively linked.
 *
 * This is the fix for the "Hyros sync writes rows but reportService drops them"
 * bug — the repair hook existed (linkAttributionStatsByHyrosAdId) but was never
 * called from any sync flow. Dead code until now.
 *
 * Returns the number of attribution rows that got linked.
 */
export async function relinkOrphanedAttributions(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Raw SQL via Drizzle template: the JOIN-UPDATE form is simpler here than
  // Drizzle's query builder (which doesn't expose UPDATE...JOIN directly).
  // Both sides indexed: adAttributionStats.hyrosAdId via the compound unique,
  // ads.externalAdId via ads_platform_external_unique.
  const result: any = await db.execute(sql`
    UPDATE adAttributionStats attr
    JOIN ads a ON a.externalAdId = attr.hyrosAdId AND a.platform = 'meta'
    SET attr.adId = a.id
    WHERE attr.adId IS NULL
  `);
  // MySQL UPDATE via mysql2 returns [ResultSetHeader, ...] or a single ResultSetHeader
  // depending on the driver wrapper. Handle both.
  const header = Array.isArray(result) ? result[0] : result;
  return (header?.affectedRows as number) ?? 0;
}

// --- creativeScores ---

export async function upsertCreativeScore(data: InsertCreativeScore): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(creativeScores).values(data).onDuplicateKeyUpdate({
    set: {
      hookScore: data.hookScore,
      watchScore: data.watchScore,
      clickScore: data.clickScore,
      convertScore: data.convertScore,
      aggregatedImpressions: data.aggregatedImpressions,
      aggregatedSpendCents: data.aggregatedSpendCents,
      coverage: data.coverage,
    },
  });
}

export async function getLatestCreativeScore(creativeAssetId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(creativeScores)
    .where(eq(creativeScores.creativeAssetId, creativeAssetId))
    .orderBy(desc(creativeScores.date))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// --- adCreativeLinks ---

export async function createAdCreativeLink(data: InsertAdCreativeLink): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(adCreativeLinks).values(data);
  return (result as any)[0]?.insertId as number;
}

export async function listAdCreativeLinksForAd(adId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adCreativeLinks).where(eq(adCreativeLinks.adId, adId));
}

export async function listUnlinkedAds(adAccountId?: string, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  // Ads that have no entry in adCreativeLinks
  const linkedAdIds = db.select({ adId: adCreativeLinks.adId }).from(adCreativeLinks).where(sql`${adCreativeLinks.adId} IS NOT NULL`);
  if (adAccountId) {
    return db.select().from(ads)
      .where(and(eq(ads.adAccountId, adAccountId), sql`${ads.id} NOT IN ${linkedAdIds}`))
      .limit(limit);
  }
  return db.select().from(ads).where(sql`${ads.id} NOT IN ${linkedAdIds}`).limit(limit);
}

// --- creativeAiTags ---

export async function upsertCreativeAiTag(data: InsertCreativeAiTag): Promise<void> {
  const dbInst = await getDb();
  if (!dbInst) throw new Error("Database not available");
  await dbInst.insert(creativeAiTags).values(data).onDuplicateKeyUpdate({
    set: {
      messagingAngle: data.messagingAngle,
      hookTactic: data.hookTactic,
      visualFormat: data.visualFormat,
      hookText: data.hookText,
      confidence: data.confidence,
      taggedAt: data.taggedAt,
    },
  });
}

export async function getCreativeAiTag(creativeAssetId: number, tagVersion = 1) {
  const dbInst = await getDb();
  if (!dbInst) return null;
  const result = await dbInst.select().from(creativeAiTags)
    .where(and(eq(creativeAiTags.creativeAssetId, creativeAssetId), eq(creativeAiTags.tagVersion, tagVersion)))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// --- adSyncState ---

export async function getSyncState(sourceName: string, adAccountId?: string) {
  const db = await getDb();
  if (!db) return null;
  const conditions = [eq(adSyncState.sourceName, sourceName)];
  if (adAccountId) conditions.push(eq(adSyncState.adAccountId, adAccountId));
  const result = await db.select().from(adSyncState).where(and(...conditions)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function listSyncStates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(adSyncState).orderBy(desc(adSyncState.lastSyncCompletedAt));
}

export async function upsertSyncState(data: InsertAdSyncState): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSyncState(data.sourceName, data.adAccountId ?? undefined);
  if (existing) {
    await db.update(adSyncState).set(data).where(eq(adSyncState.id, existing.id));
  } else {
    await db.insert(adSyncState).values(data);
  }
}

export async function updateSyncState(sourceName: string, adAccountId: string | undefined, patch: Partial<InsertAdSyncState>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getSyncState(sourceName, adAccountId);
  if (existing) {
    await db.update(adSyncState).set(patch).where(eq(adSyncState.id, existing.id));
  } else {
    await db.insert(adSyncState).values({ sourceName, adAccountId, ...patch } as InsertAdSyncState);
  }
}

// ─── Script Intelligence: Review Calibration Data ──────────────────────────

export interface ReviewCalibrationExample {
  hook: string;
  reviewScore: number;
  hookScore: number;
  convertScore: number;
  divergenceType: "high_review_low_production" | "low_review_high_production";
}

/**
 * Find scripts where the expert review score diverged significantly from
 * real-world production performance. Used to calibrate the review panel.
 */
export async function getReviewCalibrationData(limit = 4): Promise<ReviewCalibrationExample[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get scripts that have both review scores (in scriptsJson) and production scores
    const rows = await db.execute(sql`
      SELECT
        pr.scriptsJson,
        MAX(cs.hookScore) AS hookScore,
        MAX(cs.convertScore) AS convertScore
      FROM ${pipelineRuns} pr
      JOIN ${creativeAssets} ca ON ca.pipelineRunId = pr.id
      JOIN ${creativeScores} cs ON cs.creativeAssetId = ca.id
      WHERE pr.pipelineType IN ('script', 'video')
        AND pr.status = 'completed'
        AND pr.scriptsJson IS NOT NULL
        AND cs.aggregatedImpressions >= 100
      GROUP BY pr.id
      ORDER BY pr.createdAt DESC
      LIMIT 50
    `);

    const examples: ReviewCalibrationExample[] = [];

    for (const r of (rows as any)[0] || []) {
      const scripts = typeof r.scriptsJson === "string" ? JSON.parse(r.scriptsJson) : r.scriptsJson;
      const scriptArr = Array.isArray(scripts) ? scripts : [scripts];
      const hookScore = Number(r.hookScore) || 0;
      const convertScore = Number(r.convertScore) || 0;

      for (const script of scriptArr) {
        const reviewScore = script?.review?.finalScore;
        const hook = script?.hook;
        if (!reviewScore || !hook) continue;

        // High review, low production
        if (reviewScore >= 85 && hookScore <= 40) {
          examples.push({ hook, reviewScore, hookScore, convertScore, divergenceType: "high_review_low_production" });
        }
        // Low review, high production
        if (reviewScore < 80 && hookScore >= 80) {
          examples.push({ hook, reviewScore, hookScore, convertScore, divergenceType: "low_review_high_production" });
        }
      }
    }

    // Return balanced examples: up to limit/2 of each type
    const half = Math.ceil(limit / 2);
    const highLow = examples.filter(e => e.divergenceType === "high_review_low_production").slice(0, half);
    const lowHigh = examples.filter(e => e.divergenceType === "low_review_high_production").slice(0, half);
    return [...highLow, ...lowHigh];
  } catch (err: any) {
    console.error("[DB] getReviewCalibrationData failed:", err.message);
    return [];
  }
}

// ─── Script Intelligence: Winning Scripts by Context ───────────────────────

export interface WinningScript {
  runId: number;
  scriptsJson: any;
  scriptStyle: string | null;
  scriptFunnelStage: string | null;
  scriptAngle: string | null;
  product: string | null;
  hookScore: number;
  convertScore: number;
}

/**
 * Fetch the top-performing scripts by composite score (hookScore + convertScore).
 *
 * Ranks by window-aggregate scores computed from the same raw inputs the
 * Creative Performance dashboard uses (summed impressions, clicks, video*Count,
 * spend from adDailyStats; summed revenue/conversions from adAttributionStats
 * as a SEPARATE subquery to avoid spend × attribution-row multiplication).
 *
 * Why not MAX(cs.hookScore)? That picks a single outlier day per creative. A
 * creative with one 95-hook day + six 30-hook days ranks above one with a
 * steady 70-hook week — noise wins over signal. Window-aggregate recompute
 * fixes this. See reportService.ts:197 for the same separated-attribution
 * pattern + commit 525d81b for the spend/revenue multiplication fix.
 *
 * KNOWN BUG (not fixed here, flagged by codex): this function groups by
 * pr.id — one run → one script — but a run can produce multiple assets or
 * scripts; fetchWinningExamples blindly uses scriptsJson[0]. If the winning
 * asset isn't the first-index script, the wrong script gets injected. Fix
 * requires returning (runId, scriptIndex) tuples keyed to the winning asset.
 * Separate TODO.
 */
export async function getWinningScriptsByContext(
  product: string,
  funnelStage?: string,
  scriptStyle?: string,
  limit = 3,
  windowDays = 30
): Promise<WinningScript[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const funnelFilter = funnelStage
      ? sql`AND pr.scriptFunnelStage = ${funnelStage}`
      : sql``;
    const styleFilter = scriptStyle
      ? sql`AND pr.scriptStyle = ${scriptStyle}`
      : sql``;

    const dateFrom = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Separated-attribution pattern: SUM(adDailyStats) and SUM(adAttributionStats)
    // computed in independent subqueries, joined on creativeAssetId. Mixing
    // both in one FROM clause multiplies spend by attribution-row count.
    const rows = await db.execute(sql`
      SELECT
        pr.id AS runId,
        pr.scriptsJson,
        pr.scriptStyle,
        pr.scriptFunnelStage,
        pr.scriptAngle,
        pr.product,
        ca.id AS creativeAssetId,
        COALESCE(daily.impressions, 0) AS impressions,
        COALESCE(daily.clicks, 0) AS clicks,
        COALESCE(daily.videoPlayCount, 0) AS videoPlayCount,
        COALESCE(daily.video50Count, 0) AS video50Count,
        COALESCE(daily.spendCents, 0) AS spendCents,
        COALESCE(attr.revenueCents, 0) AS revenueCents,
        COALESCE(attr.conversions, 0) AS conversions
      FROM ${pipelineRuns} pr
      JOIN ${creativeAssets} ca ON ca.pipelineRunId = pr.id
      LEFT JOIN (
        SELECT
          a.creativeAssetId,
          SUM(d.impressions) AS impressions,
          SUM(d.clicks) AS clicks,
          SUM(d.videoPlayCount) AS videoPlayCount,
          SUM(d.video50Count) AS video50Count,
          SUM(d.spendCents) AS spendCents
        FROM adDailyStats d
        JOIN ads a ON a.id = d.adId
        WHERE d.date >= ${dateFrom}
          AND d.source = 'meta'
        GROUP BY a.creativeAssetId
      ) daily ON daily.creativeAssetId = ca.id
      LEFT JOIN (
        SELECT
          a.creativeAssetId,
          SUM(attr.revenueCents) AS revenueCents,
          SUM(attr.conversions) AS conversions
        FROM adAttributionStats attr
        JOIN ads a ON a.id = attr.adId
        WHERE attr.date >= ${dateFrom}
          AND attr.attributionModel = ${ENV.hyrosAttributionModel}
        GROUP BY a.creativeAssetId
      ) attr ON attr.creativeAssetId = ca.id
      WHERE pr.product = ${product}
        AND pr.pipelineType IN ('script', 'video')
        AND pr.status = 'completed'
        AND COALESCE(daily.impressions, 0) >= 100
        ${funnelFilter}
        ${styleFilter}
      ORDER BY daily.spendCents DESC
      LIMIT 200
    `);

    const { scoresFromAggregates, getCachedBenchmarks } = await import("./services/creativeAnalytics/reportService");
    const benchmarks = await getCachedBenchmarks();
    const rawRows: any[] = (rows as any)[0] ?? [];

    // Compute window-aggregate scores per row, then sort by (hook + convert) desc.
    const scored = rawRows.map((r: any) => {
      const impressions = Number(r.impressions) || 0;
      const clicks = Number(r.clicks) || 0;
      const videoPlayCount = Number(r.videoPlayCount) || 0;
      const video50Count = Number(r.video50Count) || 0;
      const spendCents = Number(r.spendCents) || 0;
      const revenueCents = Number(r.revenueCents) || 0;
      const conversions = Number(r.conversions) || 0;

      const scores = scoresFromAggregates(
        { impressions, clicks, videoPlayCount, video50Count, conversions, spendCents, revenueCents },
        benchmarks,
      );

      return {
        runId: Number(r.runId),
        scriptsJson: typeof r.scriptsJson === "string" ? JSON.parse(r.scriptsJson) : r.scriptsJson,
        scriptStyle: r.scriptStyle,
        scriptFunnelStage: r.scriptFunnelStage,
        scriptAngle: r.scriptAngle,
        product: r.product,
        hookScore: scores.hookScore,
        convertScore: scores.convertScore,
      };
    });

    scored.sort((a, b) => (b.hookScore + b.convertScore) - (a.hookScore + a.convertScore));

    // Dedupe by runId — a run can produce multiple creativeAssets, each
    // scored independently here. Without dedup, `slice(limit)` can return
    // the same run multiple times with identical scriptsJson, burning slots
    // that should go to distinct winners. Keep the highest-scoring asset
    // per run.
    const seenRunIds = new Set<number>();
    const deduped: typeof scored = [];
    for (const row of scored) {
      if (seenRunIds.has(row.runId)) continue;
      seenRunIds.add(row.runId);
      deduped.push(row);
      if (deduped.length >= limit) break;
    }
    return deduped;
  } catch (err: any) {
    console.error("[DB] getWinningScriptsByContext failed:", err.message);
    return [];
  }
}

// ─── Script Intelligence: Pattern Insights ─────────────────────────────────

export async function insertPatternInsight(data: InsertPatternInsight): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(patternInsights).values(data);
}

export async function getPatternInsights(limit = 20): Promise<PatternInsight[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(patternInsights).orderBy(desc(patternInsights.createdAt)).limit(limit);
}

export async function getPatternBreakers(limit = 10): Promise<PatternInsight[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(patternInsights)
    .where(eq(patternInsights.insightType, "pattern_breaker"))
    .orderBy(desc(patternInsights.createdAt))
    .limit(limit);
}
