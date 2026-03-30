-- Add script generator pipeline columns to pipeline_runs
ALTER TABLE `pipeline_runs` MODIFY COLUMN `pipelineType` enum('video','static','iteration','script') NOT NULL;
ALTER TABLE `pipeline_runs` ADD `scriptStyle` varchar(16);
ALTER TABLE `pipeline_runs` ADD `scriptSubStructure` varchar(16);
ALTER TABLE `pipeline_runs` ADD `scriptFunnelStage` enum('cold','warm','retargeting','retention');
ALTER TABLE `pipeline_runs` ADD `scriptArchetype` varchar(32);
ALTER TABLE `pipeline_runs` ADD `scriptConcept` text;
ALTER TABLE `pipeline_runs` ADD `scriptCount` int;
ALTER TABLE `pipeline_runs` ADD `scriptStage` varchar(64);
