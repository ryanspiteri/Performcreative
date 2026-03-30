/**
 * Run custom SQL migrations (0020, 0021) that are not in Drizzle's journal.
 * Usage: npx tsx scripts/run-custom-migrations.ts
 * Requires: DATABASE_URL in .env
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import mysql from "mysql2/promise";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle", "migrations");

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required. Set it in .env");
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);
  console.log("Connected to database.\n");

  const migrations = [
    "0020_add_is_default_product_renders.sql",
    "0021_add_iteration_source_type_adaptation.sql",
    "0022_add_script_pipeline_columns.sql",
  ];

  for (const name of migrations) {
    const path = join(MIGRATIONS_DIR, name);
    let sql: string;
    try {
      sql = readFileSync(path, "utf-8");
    } catch (e) {
      console.error(`Could not read ${path}:`, e);
      process.exit(1);
    }
    // Strip comments and empty lines, split by semicolon for separate statements
    const statements = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`Running ${name}...`);
    for (const statement of statements) {
      if (!statement) continue;
      try {
        await conn.execute(statement + ";");
        console.log("  OK:", statement.slice(0, 60) + (statement.length > 60 ? "..." : ""));
      } catch (err: any) {
        if (err.code === "ER_DUP_FIELDNAME" || err.message?.includes("Duplicate column")) {
          console.log("  Skip (column already exists):", statement.slice(0, 50) + "...");
        } else {
          console.error("  Failed:", err.message);
          await conn.end();
          process.exit(1);
        }
      }
    }
    console.log(`  Done ${name}\n`);
  }

  await conn.end();
  console.log("Migrations finished.");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
