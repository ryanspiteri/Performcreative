/**
 * One-off migration: apply the static-iteration sign-off schema changes.
 *
 * Drizzle-kit's interactive push flags the `imageModel` enum expansion as
 * "data loss" because it treats any enum modification as destructive, even
 * when we're only adding a value. Adding an enum value in MySQL via
 * `MODIFY COLUMN` preserves every existing row — this script bypasses the
 * false-positive gate and applies the changes directly.
 *
 * Run once: `pnpm tsx scripts/apply-iteration-signoff-migration.ts`
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection({ uri: url, multipleStatements: false });
  console.log("Connected.");

  const statements: { label: string; sql: string }[] = [
    {
      label: "ADD COLUMN styleMode",
      sql: "ALTER TABLE pipeline_runs ADD COLUMN styleMode VARCHAR(32) NULL",
    },
    {
      label: "ADD COLUMN adAngle",
      sql: "ALTER TABLE pipeline_runs ADD COLUMN adAngle VARCHAR(32) NULL",
    },
    {
      label: "ADD COLUMN selectedPersonIds",
      sql: "ALTER TABLE pipeline_runs ADD COLUMN selectedPersonIds TEXT NULL",
    },
    {
      label: "ADD COLUMN briefQualityWarning",
      sql: "ALTER TABLE pipeline_runs ADD COLUMN briefQualityWarning INT NOT NULL DEFAULT 0",
    },
    {
      label: "MODIFY imageModel enum (+ openai_gpt_image)",
      sql: "ALTER TABLE pipeline_runs MODIFY COLUMN imageModel ENUM('nano_banana_pro','nano_banana_2','openai_gpt_image') DEFAULT 'nano_banana_pro'",
    },
  ];

  for (const { label, sql } of statements) {
    try {
      await conn.execute(sql);
      console.log(`✓ ${label}`);
    } catch (err: any) {
      if (err?.code === "ER_DUP_FIELDNAME") {
        console.log(`↷ ${label} — column already exists, skipping`);
        continue;
      }
      console.error(`✗ ${label}: ${err?.message ?? err}`);
      throw err;
    }
  }

  await conn.end();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
