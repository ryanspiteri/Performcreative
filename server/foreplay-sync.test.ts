import { describe, it, expect, beforeEach, vi } from "vitest";
import * as db from "./db";
import { syncFromForeplay, getSyncStatus } from "./services/foreplaySync";
import type { InsertForeplayCreative } from "../drizzle/schema";

describe("Foreplay Sync", () => {
  describe("DB helpers", () => {
    it("should upsert a Foreplay creative", async () => {
      const creative: InsertForeplayCreative = {
        foreplayAdId: `test-ad-${Date.now()}-1`,
        type: "VIDEO",
        board: "inspo",
        title: "Test Video",
        brandName: "Test Brand",
        thumbnailUrl: "https://example.com/thumb.jpg",
        mediaUrl: "https://example.com/video.mp4",
        isNew: 1,
      };

      await db.upsertForeplayCreative(creative);

      const creatives = await db.listForeplayCreatives("VIDEO");
      expect(creatives.length).toBeGreaterThan(0);
      expect(creatives.some(c => c.foreplayAdId === creative.foreplayAdId)).toBe(true);
    });

    it("should deduplicate by foreplayAdId", async () => {
      const id = `test-ad-dedup-${Date.now()}`;
      const creative: InsertForeplayCreative = {
        foreplayAdId: id,
        type: "STATIC",
        board: "static_inspo",
        title: "Test Static",
        brandName: "Test Brand",
        imageUrl: "https://example.com/image.jpg",
        isNew: 1,
      };

      await db.upsertForeplayCreative(creative);
      await db.upsertForeplayCreative(creative);

      const existingIds = await db.getExistingForeplayAdIds();
      const count = Array.from(existingIds).filter(existId => existId === id).length;
      expect(count).toBe(1);
    });

    it("should list creatives by type", async () => {
      const timestamp = Date.now();
      const videoCreative: InsertForeplayCreative = {
        foreplayAdId: `video-test-${timestamp}`,
        type: "VIDEO",
        board: "inspo",
        title: "Video",
        isNew: 1,
      };

      const staticCreative: InsertForeplayCreative = {
        foreplayAdId: `static-test-${timestamp}`,
        type: "STATIC",
        board: "static_inspo",
        title: "Static",
        isNew: 1,
      };

      await db.upsertForeplayCreative(videoCreative);
      await db.upsertForeplayCreative(staticCreative);

      const videos = await db.listForeplayCreatives("VIDEO");
      const statics = await db.listForeplayCreatives("STATIC");

      expect(videos.some(c => c.foreplayAdId === videoCreative.foreplayAdId)).toBe(true);
      expect(statics.some(c => c.foreplayAdId === staticCreative.foreplayAdId)).toBe(true);
    });

    it("should count new creatives", async () => {
      const newCreative: InsertForeplayCreative = {
        foreplayAdId: `new-creative-${Date.now()}`,
        type: "VIDEO",
        board: "inspo",
        title: "New Creative",
        isNew: 1,
      };

      await db.upsertForeplayCreative(newCreative);

      const count = await db.countNewCreatives();
      expect(count).toBeGreaterThan(0);
    });

    it("should mark all creatives as seen", async () => {
      const creative: InsertForeplayCreative = {
        foreplayAdId: `mark-seen-${Date.now()}`,
        type: "STATIC",
        board: "static_inspo",
        title: "Mark Seen Test",
        isNew: 1,
      };

      await db.upsertForeplayCreative(creative);
      await db.markAllCreativesSeen();

      const creatives = await db.listForeplayCreatives();
      expect(creatives.every(c => c.isNew === 0)).toBe(true);
    });
  });

  describe("Sync status", () => {
    it("should return sync status", () => {
      const status = getSyncStatus();
      expect(status).toHaveProperty("lastSyncAt");
      expect(status).toHaveProperty("isSyncing");
      expect(status).toHaveProperty("autoSyncActive");
      expect(typeof status.isSyncing).toBe("boolean");
      expect(typeof status.autoSyncActive).toBe("boolean");
    });
  });
});
