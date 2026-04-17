import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startAutoSync } from "../services/foreplaySync";
import { startAutoMetaSync } from "../integrations/meta/metaAdsSyncService";
import { startAutoHyrosSync } from "../integrations/hyros/hyrosSyncService";
import { handleCanvaCallback, handleCanvaWebhook } from "../routers/canva";
import { handleMetaCallback } from "../routers/meta";
import multer from "multer";
import * as db from "../db";
import { storagePut } from "../storage";
import bcrypt from "bcryptjs";
import axios from "axios";
import { sdk } from "./sdk";
import { ENV } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function seedAdminUser() {
  try {
    const existing = await db.getUserByEmail("ryan@onesthealth.com");
    if (existing?.passwordHash) return;
    const passwordHash = await bcrypt.hash("TeamOnest", 10);
    await db.upsertUser({
      openId: "onest-admin-user",
      name: "Ryan Spiteri",
      email: "ryan@onesthealth.com",
      role: "admin",
      passwordHash,
    });
    console.log("[Seed] Admin user created/updated with hashed password");
  } catch (error) {
    console.error("[Seed] Failed to seed admin user:", error);
  }
}

/**
 * Run additive startup migrations that the Drizzle schema depends on.
 *
 * Why this exists: when schema.ts adds a column to an existing table,
 * every SELECT Drizzle generates includes that column. If the column
 * doesn't exist in the DB yet, EVERY query against that table fails —
 * including login. This traps us in a chicken-and-egg where the admin UI
 * migration endpoint needs login to access, but login is broken until
 * the migration runs.
 *
 * Fix: run the column additions here, at the top of startServer, BEFORE
 * any route is registered. Idempotent via INFORMATION_SCHEMA pre-flight
 * so re-running does nothing on subsequent boots. Non-fatal on error so
 * a DB hiccup doesn't brick the whole app.
 *
 * Only use this for ADDITIVE changes (ADD COLUMN, ADD INDEX). Destructive
 * migrations should still go through an explicit admin flow with a
 * confirmation step.
 */
async function runStartupColumnMigrations() {
  const TAG = "[StartupMigration]";
  try {
    const dbConn = await db.getDb();
    if (!dbConn) {
      console.warn(`${TAG} DB not available, skipping — login queries will fail if columns are missing`);
      return;
    }

    const { sql } = await import("drizzle-orm");

    // List of required columns on existing tables. Add new entries here
    // any time schema.ts adds a column to a shipped table.
    const requiredColumns: Array<{ table: string; column: string; ddl: string }> = [
      // PR #6 — Meta Facebook Login user-scope tokens
      { table: "users", column: "metaUserAccessToken", ddl: "TEXT NULL" },
      { table: "users", column: "metaUserTokenExpiresAt", ddl: "TIMESTAMP NULL" },
      { table: "users", column: "metaUserConnectedAt", ddl: "TIMESTAMP NULL" },
      // Wave 1 — Store Meta ad copy (body/title) for the AI tag engine
      { table: "creativeAssets", column: "adCopyBody", ddl: "TEXT NULL" },
      { table: "creativeAssets", column: "adCopyTitle", ddl: "TEXT NULL" },
      // Wave 1d — Traceability: creative source stamping
      { table: "pipeline_runs", column: "creativeSource", ddl: "ENUM('human','ai-winner','ai-playbook') DEFAULT 'human'" },
      { table: "pipeline_runs", column: "sourceCreativeAssetId", ddl: "INT NULL" },
      // Meta purchase metrics — cross-check Hyros revenue against Meta's own pixel/CAPI data
      { table: "adDailyStats", column: "metaPurchaseCount", ddl: "INT NOT NULL DEFAULT 0" },
      { table: "adDailyStats", column: "metaPurchaseValueCents", ddl: "INT NOT NULL DEFAULT 0" },
      { table: "adDailyStats", column: "metaRoasBp", ddl: "INT NOT NULL DEFAULT 0" },
      // Sync state: informational note separate from error (used for intentional
      // skips like the AUD currency gate, so the admin UI doesn't render them
      // as red "failed" banners).
      { table: "adSyncState", column: "lastSyncNote", ddl: "TEXT NULL" },
    ];

    let added = 0;
    let existed = 0;
    let failed = 0;

    // Also create new tables if they don't exist (separate from column adds).
    const requiredTables: Array<{ name: string; ddl: string }> = [
      {
        name: "creativeAiTags",
        ddl: `CREATE TABLE IF NOT EXISTS \`creativeAiTags\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`creativeAssetId\` int NOT NULL,
          \`messagingAngle\` varchar(64) DEFAULT NULL,
          \`hookTactic\` varchar(64) DEFAULT NULL,
          \`visualFormat\` varchar(64) DEFAULT NULL,
          \`hookText\` text DEFAULT NULL,
          \`confidence\` int NOT NULL DEFAULT 0,
          \`taggedAt\` timestamp NULL DEFAULT NULL,
          \`tagVersion\` int NOT NULL DEFAULT 1,
          \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`ai_tags_asset_version_unique\` (\`creativeAssetId\`, \`tagVersion\`),
          KEY \`ai_tags_angle_idx\` (\`messagingAngle\`),
          KEY \`ai_tags_tactic_idx\` (\`hookTactic\`),
          KEY \`ai_tags_format_idx\` (\`visualFormat\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      },
      {
        name: "patternInsights",
        ddl: `CREATE TABLE IF NOT EXISTS \`patternInsights\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`creativeAssetId\` int NOT NULL,
          \`insightType\` enum('pattern_breaker','confirmed_pattern') NOT NULL,
          \`dimension\` varchar(64) NOT NULL,
          \`combination\` varchar(128) NOT NULL,
          \`expectedScore\` int NOT NULL DEFAULT 0,
          \`actualScore\` int NOT NULL DEFAULT 0,
          \`deviation\` int NOT NULL DEFAULT 0,
          \`insight\` text DEFAULT NULL,
          \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`),
          KEY \`pi_creative_idx\` (\`creativeAssetId\`),
          KEY \`pi_type_idx\` (\`insightType\`, \`createdAt\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      },
    ];

    for (const tbl of requiredTables) {
      try {
        const existing: any = await dbConn.execute(sql`
          SELECT TABLE_NAME FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ${tbl.name}
          LIMIT 1
        `);
        const rows = Array.isArray(existing[0]) ? existing[0] : existing;
        if (rows.length > 0) {
          existed++;
          continue;
        }
        await dbConn.execute(sql.raw(tbl.ddl));
        console.log(`${TAG} created table ${tbl.name}`);
        added++;
      } catch (err: any) {
        failed++;
        console.error(`${TAG} failed to create table ${tbl.name}: ${err?.message ?? err}`);
      }
    }

    for (const col of requiredColumns) {
      try {
        const existing: any = await dbConn.execute(sql`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ${col.table}
            AND COLUMN_NAME = ${col.column}
          LIMIT 1
        `);
        const rows = Array.isArray(existing[0]) ? existing[0] : existing;
        if (rows.length > 0) {
          existed++;
          continue;
        }
        await dbConn.execute(
          sql.raw(`ALTER TABLE \`${col.table}\` ADD COLUMN \`${col.column}\` ${col.ddl}`),
        );
        console.log(`${TAG} added ${col.table}.${col.column}`);
        added++;
      } catch (err: any) {
        failed++;
        console.error(`${TAG} failed to add ${col.table}.${col.column}: ${err?.message ?? err}`);
      }
    }

    // Enum widening: adSyncState.lastSyncStatus needs to accept 'skipped'. MySQL
    // MODIFY COLUMN on an ENUM is additive-safe (existing values keep their
    // mappings) and idempotent — re-running with the same enum set is a no-op.
    try {
      const colInfo: any = await dbConn.execute(sql`
        SELECT COLUMN_TYPE FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'adSyncState'
          AND COLUMN_NAME = 'lastSyncStatus'
        LIMIT 1
      `);
      const colRows = Array.isArray(colInfo[0]) ? colInfo[0] : colInfo;
      const currentType: string = (colRows[0]?.COLUMN_TYPE ?? "").toString();
      if (currentType && !currentType.includes("'skipped'")) {
        await dbConn.execute(sql.raw(
          `ALTER TABLE \`adSyncState\` MODIFY COLUMN \`lastSyncStatus\` ` +
          `ENUM('idle','running','success','failed','partial','skipped') NOT NULL DEFAULT 'idle'`,
        ));
        console.log(`${TAG} widened adSyncState.lastSyncStatus enum to include 'skipped'`);
      }
    } catch (err: any) {
      console.error(`${TAG} failed to widen lastSyncStatus enum:`, err?.message ?? err);
    }

    console.log(`${TAG} done: ${added} added, ${existed} already existed, ${failed} failed`);
  } catch (err: any) {
    console.error(`${TAG} unexpected error — app will continue starting:`, err?.message ?? err);
  }
}

async function startServer() {
  // Run additive column migrations BEFORE any route that queries the users
  // table. Without this, every login fails with "Unknown column" until
  // someone manually runs the migration via admin UI — which requires login.
  await runStartupColumnMigrations();

  const app = express();
  const server = createServer(app);
  // Canva webhook — must be registered BEFORE express.json() to capture raw body for HMAC verification
  app.post("/api/canva/webhook", express.raw({ type: "application/json" }), handleCanvaWebhook);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));
  
  // Multer for multipart file uploads (bypasses tRPC for large files)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
  });
  // Diagnostic health endpoint — tests DB connectivity + table existence (no auth)
  app.get("/api/health/db", async (_req, res) => {
    const requiredTables = [
      "users", "pipeline_runs", "product_renders", "product_info", "people",
      "foreplay_creatives", "backgrounds", "ugc_uploads", "ugc_variants",
      "headline_bank", "face_swap_jobs", "organic_runs", "caption_examples",
      "scriptStructures", "scriptAudiences",
      // Creative Analytics OS
      "creativeAssets", "ads", "adDailyStats", "adAttributionStats",
      "creativeScores", "adCreativeLinks", "adSyncState",
      "patternInsights",
    ];
    try {
      const dbConn = await db.getDb();
      if (!dbConn) {
        return res.status(503).json({ ok: false, error: "Database not available", tables: {} });
      }
      // Query information_schema to check which tables exist
      const rows: any[] = await dbConn.execute(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()"
      );
      const existingTables = new Set(
        (Array.isArray(rows[0]) ? rows[0] : rows).map((r: any) => r.TABLE_NAME)
      );
      const tables: Record<string, boolean> = {};
      const missing: string[] = [];
      for (const t of requiredTables) {
        const exists = existingTables.has(t);
        tables[t] = exists;
        if (!exists) missing.push(t);
      }
      if (missing.length > 0) {
        return res.status(503).json({ ok: false, error: `Missing tables: ${missing.join(", ")}`, tables });
      }
      return res.json({ ok: true, tables });
    } catch (err: any) {
      return res.status(503).json({ ok: false, error: err.message || "DB health check failed", tables: {} });
    }
  });

  // TEMPORARY — one-shot KPI audit for ~10x Creative Performance inflation
  // investigation. Token-guarded so it can be hit without a session. REMOVE
  // this entire handler in the follow-up cleanup commit once root cause
  // is identified.
  app.get("/api/_debug/kpi-audit", async (req, res) => {
    const DEBUG_TOKEN = "c8e1f4ad-9b2e-4c3f-8a71-6d5fae2b7c0a";
    if (req.query.token !== DEBUG_TOKEN) {
      return res.status(404).end();
    }
    try {
      const dbConn = await db.getDb();
      if (!dbConn) return res.status(503).json({ error: "db unavailable" });
      const { sql: s } = await import("drizzle-orm");
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 86400_000);
      const unwrap = (r: any) => Array.isArray(r[0]) ? r[0] : r;

      const daily = unwrap(await dbConn.execute(s`
        SELECT COUNT(*) AS rowCount,
               COUNT(DISTINCT adId, date, source) AS distinctKeys,
               COALESCE(SUM(spendCents),0) AS spendCents,
               COUNT(DISTINCT adId) AS distinctAds,
               MIN(date) AS minDate, MAX(date) AS maxDate
        FROM adDailyStats
        WHERE source='meta' AND date >= ${from} AND date <= ${now}`))[0];

      const attr = unwrap(await dbConn.execute(s`
        SELECT COUNT(*) AS rowCount,
               COUNT(DISTINCT hyrosAdId, date, attributionModel) AS distinctKeys,
               COALESCE(SUM(revenueCents),0) AS revenueCents,
               COALESCE(SUM(conversions),0) AS conversions,
               COUNT(DISTINCT hyrosAdId) AS distinctHyrosAds,
               MIN(date) AS minDate, MAX(date) AS maxDate
        FROM adAttributionStats
        WHERE date >= ${from} AND date <= ${now}`))[0];

      const adsTotals = unwrap(await dbConn.execute(s`
        SELECT COUNT(*) AS total, COUNT(DISTINCT platform, externalAdId) AS distinctExternal FROM ads`))[0];

      const caTotals = unwrap(await dbConn.execute(s`
        SELECT COUNT(*) AS total, COUNT(DISTINCT creativeHash) AS distinctHash FROM creativeAssets`))[0];

      const dupDaily = unwrap(await dbConn.execute(s`
        SELECT adId, date, source, COUNT(*) AS dupes, SUM(spendCents) AS spend
        FROM adDailyStats
        WHERE source='meta' AND date >= ${from} AND date <= ${now}
        GROUP BY adId, date, source
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC LIMIT 10`));

      const dupAttr = unwrap(await dbConn.execute(s`
        SELECT hyrosAdId, date, attributionModel, COUNT(*) AS dupes, SUM(revenueCents) AS rev
        FROM adAttributionStats
        WHERE date >= ${from} AND date <= ${now}
        GROUP BY hyrosAdId, date, attributionModel
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC LIMIT 10`));

      const indexes = unwrap(await dbConn.execute(s`
        SELECT table_name AS tbl, index_name AS idx, non_unique AS nonUnique,
               GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name IN ('adDailyStats','adAttributionStats','ads','creativeAssets')
        GROUP BY table_name, index_name, non_unique
        ORDER BY table_name, index_name`));

      const spendByDay = unwrap(await dbConn.execute(s`
        SELECT DATE(date) AS day, SUM(spendCents) AS spend, COUNT(*) AS rowCount, COUNT(DISTINCT adId) AS ads
        FROM adDailyStats
        WHERE source='meta' AND date >= ${from} AND date <= ${now}
        GROUP BY DATE(date) ORDER BY day`));

      return res.json({
        window: { from, to: now },
        adDailyStats_7d: daily,
        adAttributionStats_7d: attr,
        ads: adsTotals,
        creativeAssets: caTotals,
        spendByDay,
        dupDailyStatsKeys: dupDaily,
        dupAttributionKeys: dupAttr,
        indexes,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // TEMPORARY — one-shot duplicate cleanup + UNIQUE-constraint install.
  // Migration 0023 declared UNIQUE KEYs on adDailyStats/adAttributionStats/ads
  // but prod only has plain (non-unique) indexes with the same columns, so
  // every `onDuplicateKeyUpdate` has silently been a plain INSERT. Result:
  // 11-18x duplicate rows per key, which is why KPIs showed ~10x real.
  //
  // This endpoint runs in a predictable idempotent order:
  //   1. DELETE duplicates keeping MIN(id) per business-unique key
  //   2. ADD UNIQUE KEY with the name migration 0023 used
  // If the UNIQUE already exists (second run, or was just added) the
  // CREATE is swallowed so the handler stays idempotent.
  //
  // Gated by a hardcoded token so it can't be hit in error. Remove this
  // entire handler (and /api/_debug/kpi-audit above) in the cleanup commit
  // after the KPI strip is verified correct.
  app.get("/api/_debug/kpi-fix", async (req, res) => {
    const DEBUG_TOKEN = "c8e1f4ad-9b2e-4c3f-8a71-6d5fae2b7c0a";
    if (req.query.token !== DEBUG_TOKEN) return res.status(404).end();
    try {
      const dbConn = await db.getDb();
      if (!dbConn) return res.status(503).json({ error: "db unavailable" });
      const { sql: s } = await import("drizzle-orm");
      const unwrap = (r: any) => (Array.isArray(r[0]) ? r[0] : r) as any[];
      const affectedRows = (r: any) => Number((Array.isArray(r[0]) ? r[0]?.affectedRows : r[0]?.affectedRows ?? (r as any).affectedRows) ?? 0);

      const result: any = { dedup: {}, uniqueAdded: {}, errors: [] as string[] };

      // --- 1. adDailyStats: dedupe on (adId, date, source) keep MIN(id) ---
      try {
        const del = await dbConn.execute(s`
          DELETE d1 FROM adDailyStats d1
          INNER JOIN adDailyStats d2
            ON d1.adId = d2.adId
           AND d1.date = d2.date
           AND d1.source = d2.source
           AND d1.id > d2.id
        `);
        result.dedup.adDailyStats = affectedRows(del);
      } catch (err: any) {
        result.errors.push(`adDailyStats dedupe: ${err?.message ?? err}`);
      }
      try {
        await dbConn.execute(s`
          ALTER TABLE adDailyStats
          ADD UNIQUE KEY ad_daily_stats_ad_date_source_unique (adId, date, source)
        `);
        result.uniqueAdded.adDailyStats = "added";
      } catch (err: any) {
        const m = String(err?.message ?? err);
        if (m.includes("Duplicate key name") || m.includes("already exists")) {
          result.uniqueAdded.adDailyStats = "exists";
        } else {
          result.errors.push(`adDailyStats alter: ${m}`);
        }
      }

      // --- 2. adAttributionStats: dedupe on (hyrosAdId, date, attributionModel) ---
      try {
        const del = await dbConn.execute(s`
          DELETE a1 FROM adAttributionStats a1
          INNER JOIN adAttributionStats a2
            ON a1.hyrosAdId = a2.hyrosAdId
           AND a1.date = a2.date
           AND a1.attributionModel = a2.attributionModel
           AND a1.id > a2.id
        `);
        result.dedup.adAttributionStats = affectedRows(del);
      } catch (err: any) {
        result.errors.push(`adAttributionStats dedupe: ${err?.message ?? err}`);
      }
      try {
        await dbConn.execute(s`
          ALTER TABLE adAttributionStats
          ADD UNIQUE KEY attr_hyros_date_model_unique (hyrosAdId, date, attributionModel)
        `);
        result.uniqueAdded.adAttributionStats = "added";
      } catch (err: any) {
        const m = String(err?.message ?? err);
        if (m.includes("Duplicate key name") || m.includes("already exists")) {
          result.uniqueAdded.adAttributionStats = "exists";
        } else {
          result.errors.push(`adAttributionStats alter: ${m}`);
        }
      }

      // --- 3. ads: dedupe on (platform, externalAdId) keep MIN(id) ---
      // This is trickier because child rows (adDailyStats.adId, adAttributionStats.adId)
      // point at specific ads.id values. Before deleting dupe ads rows, repoint
      // any child rows from the soon-to-be-deleted ads.id to the surviving MIN(id).
      try {
        // Repoint adDailyStats.adId to the surviving ad row
        await dbConn.execute(s`
          UPDATE adDailyStats d
          INNER JOIN ads dup ON dup.id = d.adId
          INNER JOIN ads keep
            ON keep.platform = dup.platform
           AND keep.externalAdId = dup.externalAdId
           AND keep.id < dup.id
          SET d.adId = keep.id
          WHERE dup.id <> keep.id
        `);
        // Repoint adAttributionStats.adId to the surviving ad row
        await dbConn.execute(s`
          UPDATE adAttributionStats a
          INNER JOIN ads dup ON dup.id = a.adId
          INNER JOIN ads keep
            ON keep.platform = dup.platform
           AND keep.externalAdId = dup.externalAdId
           AND keep.id < dup.id
          SET a.adId = keep.id
          WHERE dup.id <> keep.id
        `);
        // Now the dup ads rows have no children pointing at them — safe to delete
        const del = await dbConn.execute(s`
          DELETE a1 FROM ads a1
          INNER JOIN ads a2
            ON a1.platform = a2.platform
           AND a1.externalAdId = a2.externalAdId
           AND a1.id > a2.id
        `);
        result.dedup.ads = affectedRows(del);
      } catch (err: any) {
        result.errors.push(`ads dedupe: ${err?.message ?? err}`);
      }
      try {
        await dbConn.execute(s`
          ALTER TABLE ads
          ADD UNIQUE KEY ads_platform_external_unique (platform, externalAdId)
        `);
        result.uniqueAdded.ads = "added";
      } catch (err: any) {
        const m = String(err?.message ?? err);
        if (m.includes("Duplicate key name") || m.includes("already exists")) {
          result.uniqueAdded.ads = "exists";
        } else {
          result.errors.push(`ads alter: ${m}`);
        }
      }

      // Dedupe the redundant repointing now that ads.id is clean:
      // after the ads dedupe+repoint, child tables may have new duplicate
      // keys (two rows with same adId/date because they were pointing at
      // different dupe ads that got collapsed). Re-run the dedupe.
      try {
        const del = await dbConn.execute(s`
          DELETE d1 FROM adDailyStats d1
          INNER JOIN adDailyStats d2
            ON d1.adId = d2.adId AND d1.date = d2.date AND d1.source = d2.source
           AND d1.id > d2.id
        `);
        result.dedup.adDailyStats_afterRepoint = affectedRows(del);
      } catch {}
      try {
        const del = await dbConn.execute(s`
          DELETE a1 FROM adAttributionStats a1
          INNER JOIN adAttributionStats a2
            ON a1.hyrosAdId = a2.hyrosAdId AND a1.date = a2.date AND a1.attributionModel = a2.attributionModel
           AND a1.id > a2.id
        `);
        result.dedup.adAttributionStats_afterRepoint = affectedRows(del);
      } catch {}

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // Image download proxy — avoids CORS issues when downloading from S3/CDN
  app.get("/api/download-image", async (req, res) => {
    try {
      const urlParam = req.query.url as string;
      const filename = (req.query.filename as string) || "download.png";

      if (!urlParam) {
        return res.status(400).json({ error: "url parameter required" });
      }

      // Auth check: reuse SDK session verification
      try {
        await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Security: validate URL against allowed CDN domains
      let parsed: URL;
      try {
        parsed = new URL(urlParam);
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      if (parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Only HTTPS URLs allowed" });
      }
      if (parsed.username || parsed.password) {
        return res.status(400).json({ error: "URLs with credentials not allowed" });
      }

      const allowedHost = `${ENV.doSpacesBucket}.${ENV.doSpacesRegion}.cdn.digitaloceanspaces.com`;
      if (parsed.hostname !== allowedHost) {
        return res.status(403).json({ error: "URL not from allowed CDN domain" });
      }

      // Fetch the image server-side with timeout and size limit
      const response = await axios.get(urlParam, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024, // 50MB
      });

      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      res.set("Content-Type", response.headers["content-type"] || "image/png");
      res.set("Content-Disposition", `attachment; filename="${sanitizedFilename}"`);
      res.send(response.data);
    } catch (err: any) {
      console.error("[Download] Proxy error:", err.message);
      return res.status(500).json({ error: "Download failed" });
    }
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Canva OAuth callback
  app.get("/api/canva/callback", handleCanvaCallback);
  app.get("/api/meta/callback", handleMetaCallback);
  
  // UGC video upload endpoint (multipart, bypasses tRPC)
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
      
      const id = await db.createUgcUpload({
        fileName: req.file.originalname,
        fileKey,
        videoUrl: url,
        product,
        audienceTag: audienceTag || undefined,
        desiredOutputVolume: volume,
        status: "uploaded",
      });
      
      console.log(`[UGC Upload] Database record created: ID ${id}`);
      
      // Trigger background transcription and structure extraction
      (async () => {
        try {
          console.log(`[UGC Upload] Starting background transcription for upload #${id}`);
          await db.updateUgcUpload(id, { status: "transcribing" });
          
          // Import services dynamically to avoid circular dependencies
          // Use whisper.ts which extracts audio via ffmpeg first (handles video files correctly)
          const { transcribeVideo } = await import("../services/whisper");
          const { extractStructureBlueprint } = await import("../services/ugcClone");
          
          // Transcribe: download video → extract audio with ffmpeg → send to Whisper API
          const transcriptText = await transcribeVideo(url);
          
          console.log(`[UGC Upload] Transcription complete for upload #${id}, length: ${transcriptText.length} chars`);
          
          // Extract structure blueprint from transcript
          const blueprint = await extractStructureBlueprint(transcriptText, url);
          console.log(`[UGC Upload] Structure extraction complete for upload #${id}`);
          
          // Update database with results
          await db.updateUgcUpload(id, {
            transcript: transcriptText,
            structureBlueprint: blueprint,
            status: "structure_extracted",
          });
          
          console.log(`[UGC Upload] Background processing complete for upload #${id}`);
        } catch (error: any) {
          console.error(`[UGC Upload] Background processing failed for upload #${id}:`, error);
          await db.updateUgcUpload(id, { status: "failed" });
        }
      })();
      
      res.json({ id, url });
    } catch (error: any) {
      console.error(`[UGC Upload] Error:`, error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  });
  // Organic video upload endpoint (multipart, bypasses tRPC)
  app.post("/api/organic/upload-video", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const ext = req.file.originalname.split(".").pop()?.toLowerCase() || "mp4";
      const allowedExts = ["mp4", "mov", "avi", "mkv", "webm"];
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({ error: `Unsupported format: .${ext}. Allowed: ${allowedExts.join(", ")}` });
      }

      console.log(`[Organic Upload] Received: ${req.file.originalname}, ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);

      const suffix = Math.random().toString(36).slice(2, 8);
      const fileKey = `organic-videos/${Date.now()}-${suffix}.${ext}`;

      const { url } = await storagePut(fileKey, req.file.buffer, req.file.mimetype);
      console.log(`[Organic Upload] S3 upload complete: ${url}`);

      res.json({ url, fileKey });
    } catch (error: any) {
      console.error(`[Organic Upload] Error:`, error);
      const isConfigError = error.message?.includes("Storage proxy credentials missing");
      res.status(isConfigError ? 503 : 500).json({
        error: isConfigError
          ? "Video storage is temporarily unavailable. Please contact support."
          : "Upload failed. Please try again.",
      });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
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

  // Increase timeout for large file uploads (default is 2 minutes)
  server.timeout = 10 * 60 * 1000; // 10 minutes
  server.keepAliveTimeout = 65000; // 65 seconds (slightly higher than typical proxy timeout)
  server.headersTimeout = 66000; // 66 seconds (must be higher than keepAliveTimeout)

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    console.log(`Server timeout: ${server.timeout}ms`);
    // Seed admin user with hashed password
    seedAdminUser();
    // Start auto-sync from Foreplay
    startAutoSync();
    // Creative Analytics OS: start Meta + Hyros sync if configured
    if (ENV.metaAccessToken && ENV.metaAdAccountIds) {
      startAutoMetaSync();
    } else {
      console.log("[Startup] Meta sync skipped (META_ACCESS_TOKEN or META_AD_ACCOUNT_IDS not set)");
    }
    if (ENV.hyrosApiKey) {
      startAutoHyrosSync();
    } else {
      console.log("[Startup] Hyros sync skipped (HYROS_API_KEY not set)");
    }
  });
}

startServer().catch(console.error);
