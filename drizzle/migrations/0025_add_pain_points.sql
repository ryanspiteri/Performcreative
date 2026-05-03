-- Pain-point-driven iteration pipeline.
-- Adds the master pain-point list to product_info and the per-run candidate +
-- selection columns on pipeline_runs. All nullable, additive only.
-- Apply via Manus Database UI or `pnpm db:migrate`.

ALTER TABLE `product_info`
ADD COLUMN `painPoints` text NULL;

ALTER TABLE `pipeline_runs`
ADD COLUMN `iterationPainPointCandidates` text NULL,
ADD COLUMN `iterationSelectedPainPoints` text NULL;
