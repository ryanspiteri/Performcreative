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
import { handleCanvaCallback } from "../routers/canva";
import multer from "multer";
import * as db from "../db";
import { storagePut } from "../storage";

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

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));
  
  // Multer for multipart file uploads (bypasses tRPC for large files)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Canva OAuth callback
  app.get("/api/canva/callback", handleCanvaCallback);
  
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
          const { transcribeAudio } = await import("../_core/voiceTranscription");
          const { extractStructureBlueprint } = await import("../services/ugcClone");
          
          // Transcribe audio
          const transcription = await transcribeAudio({ audioUrl: url });
          
          if ('error' in transcription) {
            throw new Error(`Transcription failed: ${transcription.error}`);
          }
          
          console.log(`[UGC Upload] Transcription complete for upload #${id}`);
          
          // Extract structure
          const blueprint = await extractStructureBlueprint(transcription.text, url);
          console.log(`[UGC Upload] Structure extraction complete for upload #${id}`);
          
          // Update database with results
          await db.updateUgcUpload(id, {
            transcript: transcription.text,
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
    // Start auto-sync from Foreplay
    startAutoSync();
  });
}

startServer().catch(console.error);
