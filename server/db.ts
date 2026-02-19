import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, pipelineRuns, InsertPipelineRun, productRenders, InsertProductRender, productInfo, InsertProductInfo } from "../drizzle/schema";
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
