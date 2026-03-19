-- Add isDefault to product_renders. One default per product; pipelines use it.
-- Apply via Manus Database UI or your MySQL client, then run the backfill.

ALTER TABLE `product_renders`
ADD COLUMN `isDefault` int NOT NULL DEFAULT 0;

-- Backfill: set the most recent render per product as default (preserves previous behaviour).
UPDATE `product_renders` r
INNER JOIN (
  SELECT product, MAX(id) AS max_id
  FROM `product_renders`
  GROUP BY product
) latest ON r.product = latest.product AND r.id = latest.max_id
SET r.isDefault = 1;
