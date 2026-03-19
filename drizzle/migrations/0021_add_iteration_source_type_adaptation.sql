-- Competitor Ad mode: source type and adaptation mode for Iterate pipeline.
-- Apply via your MySQL client or Manus Database UI.

ALTER TABLE `pipeline_runs`
ADD COLUMN `iterationSourceType` enum('own_ad','competitor_ad') DEFAULT 'own_ad',
ADD COLUMN `iterationAdaptationMode` enum('concept','style') DEFAULT NULL;
