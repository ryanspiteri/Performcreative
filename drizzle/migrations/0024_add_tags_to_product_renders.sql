-- Add tags column to product_renders.
-- Free-form comma-separated labels (e.g., "hero,clean,white-bg").
-- Apply via Manus Database UI or your MySQL client.

ALTER TABLE `product_renders`
ADD COLUMN `tags` varchar(256) NULL;
