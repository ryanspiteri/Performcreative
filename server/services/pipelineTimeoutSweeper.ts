import { and, eq, lt } from "drizzle-orm";
import { getDb } from "../db";
import { pipelineRuns } from "../../drizzle/schema";
import { ENV } from "../_core/env";

const TAG = "[PipelineTimeoutSweeper]";

let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;

const AUTO_STOP_PREFIX = "Auto-stopped:";

export function autoStopMessage(idleMinutes: number) {
  return `${AUTO_STOP_PREFIX} idle for >${idleMinutes} min. ClickUp not pushed — re-run or push manually.`;
}

export function isAutoStopped(errorMessage: string | null | undefined) {
  return !!errorMessage && errorMessage.startsWith(AUTO_STOP_PREFIX);
}

async function sweepStaleRuns() {
  const db = await getDb();
  if (!db) return;

  const idleMin = Math.max(5, ENV.pipelineIdleTimeoutMinutes);
  const cutoff = new Date(Date.now() - idleMin * 60 * 1000);

  const stale = await db.select({
    id: pipelineRuns.id,
    pipelineType: pipelineRuns.pipelineType,
    updatedAt: pipelineRuns.updatedAt,
  }).from(pipelineRuns).where(and(
    eq(pipelineRuns.status, "running"),
    lt(pipelineRuns.updatedAt, cutoff),
  ));

  if (stale.length === 0) return;

  console.log(`${TAG} Auto-stopping ${stale.length} stale running pipeline(s) (idle > ${idleMin} min)`);

  await db.update(pipelineRuns).set({
    status: "completed",
    completedAt: new Date(),
    errorMessage: autoStopMessage(idleMin),
  }).where(and(
    eq(pipelineRuns.status, "running"),
    lt(pipelineRuns.updatedAt, cutoff),
  ));

  for (const row of stale) {
    console.log(`${TAG}   - run ${row.id} (${row.pipelineType}), last updated ${row.updatedAt?.toISOString?.() ?? row.updatedAt}`);
  }
}

async function tick() {
  if (_running) return;
  _running = true;
  try {
    await sweepStaleRuns();
  } catch (err) {
    console.error(`${TAG} sweep failed:`, err);
  } finally {
    _running = false;
  }
}

export function startPipelineTimeoutSweeper() {
  if (_timer) return;
  const intervalMin = Math.max(1, ENV.pipelineSweepIntervalMinutes);
  const intervalMs = intervalMin * 60 * 1000;
  console.log(`${TAG} Starting — idle timeout ${ENV.pipelineIdleTimeoutMinutes} min, sweep every ${intervalMin} min`);
  // Run once shortly after boot so dashboards clear quickly
  setTimeout(() => { void tick(); }, 30_000);
  _timer = setInterval(() => { void tick(); }, intervalMs);
}

export function stopPipelineTimeoutSweeper() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

