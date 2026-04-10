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

async function startServer() {
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

  /**
   * EMERGENCY MIGRATION ENDPOINT — ADDED AS A HOTFIX
   *
   * PR #6 added metaUserAccessToken/ExpiresAt/ConnectedAt columns to the
   * users table via a tRPC-gated migration procedure, but the Drizzle
   * schema queries include those columns in every `users` SELECT. This
   * means login is broken until the columns exist, but the admin UI that
   * triggers the migration requires login. Chicken-and-egg.
   *
   * This endpoint runs the same idempotent ALTER TABLE outside the auth
   * flow, gated by a simple token derived from META_APP_SECRET so only
   * someone with DO env access can trigger it.
   *
   * After running this once successfully, remove this endpoint in a
   * follow-up commit. It is NOT intended to be permanent.
   *
   * Usage:
   *   curl -X POST "https://www.performcreative.io/api/_emergency/add-meta-columns?token=<sha256 of META_APP_SECRET>"
   */
  app.post("/api/_emergency/add-meta-columns", async (req, res) => {
    try {
      // Token gate — prevents random strangers from poking the endpoint.
      // Uses SHA-256 of the app secret so we don't have to expose the raw
      // secret in curl history. Compute locally with:
      //   echo -n "$META_APP_SECRET" | shasum -a 256 | cut -d' ' -f1
      const crypto = await import("crypto");
      if (!ENV.metaAppSecret) {
        return res.status(503).json({ error: "META_APP_SECRET not set — cannot gate endpoint" });
      }
      const expected = crypto.createHash("sha256").update(ENV.metaAppSecret).digest("hex");
      const provided = (req.query.token as string | undefined) ?? "";
      if (provided !== expected) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const dbConn = await db.getDb();
      if (!dbConn) {
        return res.status(500).json({ error: "Database not available" });
      }

      const { sql } = await import("drizzle-orm");
      const requiredColumns = [
        { name: "metaUserAccessToken", ddl: "TEXT NULL" },
        { name: "metaUserTokenExpiresAt", ddl: "TIMESTAMP NULL" },
        { name: "metaUserConnectedAt", ddl: "TIMESTAMP NULL" },
      ];

      const results: { column: string; status: "exists" | "added" | "failed"; error?: string }[] = [];

      for (const col of requiredColumns) {
        try {
          const existing: any = await dbConn.execute(sql`
            SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = ${col.name}
            LIMIT 1
          `);
          const rows = Array.isArray(existing[0]) ? existing[0] : existing;
          if (rows.length > 0) {
            results.push({ column: col.name, status: "exists" });
            continue;
          }
          await dbConn.execute(sql.raw(`ALTER TABLE \`users\` ADD COLUMN \`${col.name}\` ${col.ddl}`));
          results.push({ column: col.name, status: "added" });
        } catch (err: any) {
          results.push({ column: col.name, status: "failed", error: err?.message ?? String(err) });
        }
      }

      const addedCount = results.filter((r) => r.status === "added").length;
      const existedCount = results.filter((r) => r.status === "exists").length;
      const failedCount = results.filter((r) => r.status === "failed").length;

      return res.json({
        success: failedCount === 0,
        summary: `${addedCount} added, ${existedCount} already existed, ${failedCount} failed`,
        results,
        note: "Remove this endpoint in a follow-up commit once login is working.",
      });
    } catch (err: any) {
      console.error("[EmergencyMigration] failed:", err);
      return res.status(500).json({ error: err?.message ?? String(err) });
    }
  });
  
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
