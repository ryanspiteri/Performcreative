import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, pipelineRuns, InsertPipelineRun, productRenders, InsertProductRender, productInfo, InsertProductInfo, foreplayCreatives, InsertForeplayCreative, backgrounds, InsertBackground, ugcUploads, ugcVariants, headlineBank, faceSwapJobs } from "../drizzle/schema";
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

export async function listPipelineRuns(limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.createdAt)).limit(limit);
}

// ============================================================
// Product Render helpers
// ============================================================
export async function createProductRender(data: InsertProductRender) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productRenders).values(data);
  return (result as any)[0]?.insertId;
}

export async function listProductRenders(product?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (product) {
    return db.select().from(productRenders).where(eq(productRenders.product, product)).orderBy(desc(productRenders.createdAt));
  }
  return db.select().from(productRenders).orderBy(desc(productRenders.createdAt));
}

export async function getProductRendersByProduct(product: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productRenders).where(eq(productRenders.product, product)).orderBy(desc(productRenders.createdAt));
}

export async function deleteProductRender(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(productRenders).where(eq(productRenders.id, id));
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
    await db.insert(foreplayCreatives).values(sanitised).onDuplicateKeyUpdate({
      set: { syncedAt: new Date() },
    });
    return true;
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
export async function listForeplayCreatives(type?: "VIDEO" | "STATIC", limit = 100) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (type) {
    return db.select().from(foreplayCreatives)
      .where(eq(foreplayCreatives.type, type))
      .orderBy(desc(foreplayCreatives.createdAt))
      .limit(limit);
  }
  return db.select().from(foreplayCreatives)
    .orderBy(desc(foreplayCreatives.createdAt))
    .limit(limit);
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
