import { describe, it, expect, afterAll } from "vitest";
import * as db from "./db";
import { getSyncStatus } from "./services/foreplaySync";
import type { InsertForeplayCreative } from "../drizzle/schema";
import { getDb } from "./db";
import { foreplayCreatives } from "../drizzle/schema";
import { inArray } from "drizzle-orm";

// Track all test IDs for cleanup
const TEST_PREFIX = `__vitest_${Date.now()}_`;
const testIds: string[] = [];

// Clean up all test data after the suite
afterAll(async () => {
  const dbConn = await getDb();
  if (dbConn && testIds.length > 0) {
    await dbConn.delete(foreplayCreatives).where(
      inArray(foreplayCreatives.foreplayAdId, testIds)
    );
  }
});

describe("Foreplay Sync", () => {
  describe("DB helpers", () => {
    it("should upsert a Foreplay creative", async () => {
      const id = `${TEST_PREFIX}upsert1`;
      testIds.push(id);
      const creative: InsertForeplayCreative = {
        foreplayAdId: id,
        type: "VIDEO",
        board: "inspo",
        title: "Test Video Upsert",
        brandName: "Test Brand",
        thumbnailUrl: "https://r2.foreplay.co/test-thumb.jpg",
        mediaUrl: "https://r2.foreplay.co/test-video.mp4",
        isNew: 1,
      };

      await db.upsertForeplayCreative(creative);

      const creatives = await db.listForeplayCreatives("VIDEO");
      expect(creatives.some(c => c.foreplayAdId === id)).toBe(true);
    });

    it("should deduplicate by foreplayAdId", async () => {
      const id = `${TEST_PREFIX}dedup1`;
      testIds.push(id);
      const creative: InsertForeplayCreative = {
        foreplayAdId: id,
        type: "STATIC",
        board: "static_inspo",
        title: "Test Static Dedup",
        brandName: "Test Brand",
        imageUrl: "https://r2.foreplay.co/test-image.jpg",
        isNew: 1,
      };

      await db.upsertForeplayCreative(creative);
      await db.upsertForeplayCreative(creative);

      const existingIds = await db.getExistingForeplayAdIds();
      const count = Array.from(existingIds).filter(existId => existId === id).length;
      expect(count).toBe(1);
    });

    it("should list creatives by type", async () => {
      const videoId = `${TEST_PREFIX}video1`;
      const staticId = `${TEST_PREFIX}static1`;
      testIds.push(videoId, staticId);

      await db.upsertForeplayCreative({
        foreplayAdId: videoId,
        type: "VIDEO",
        board: "inspo",
        title: "Test Video List",
        isNew: 1,
      });

      await db.upsertForeplayCreative({
        foreplayAdId: staticId,
        type: "STATIC",
        board: "static_inspo",
        title: "Test Static List",
        isNew: 1,
      });

      const videos = await db.listForeplayCreatives("VIDEO");
      const statics = await db.listForeplayCreatives("STATIC");

      expect(videos.some(c => c.foreplayAdId === videoId)).toBe(true);
      expect(statics.some(c => c.foreplayAdId === staticId)).toBe(true);
    });

    it("should count new creatives", async () => {
      const id = `${TEST_PREFIX}newcount1`;
      testIds.push(id);

      await db.upsertForeplayCreative({
        foreplayAdId: id,
        type: "VIDEO",
        board: "inspo",
        title: "New Count Test",
        isNew: 1,
      });

      const count = await db.countNewCreatives();
      expect(count).toBeGreaterThan(0);
    });

    it("should mark all creatives as seen", async () => {
      const id = `${TEST_PREFIX}markseen1`;
      testIds.push(id);

      await db.upsertForeplayCreative({
        foreplayAdId: id,
        type: "STATIC",
        board: "static_inspo",
        title: "Mark Seen Test",
        isNew: 1,
      });

      await db.markAllCreativesSeen();

      const creatives = await db.listForeplayCreatives();
      // All creatives including test ones should be marked seen
      const testCreative = creatives.find(c => c.foreplayAdId === id);
      expect(testCreative?.isNew).toBe(0);
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
