import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const connectionString = process.env.DATABASE_URL ?? "postgresql://roboreha:roboreha@localhost:55432/roboreha";
const schemaName = process.env.DB_SCHEMA?.trim() ?? "";
if (schemaName && !/^[a-z][a-z0-9_]{2,62}$/.test(schemaName)) throw new Error("DB_SCHEMA contains unsupported characters.");
const client = new pg.Client({ connectionString, ...(schemaName ? { options: `-c search_path=${schemaName},public` } : {}) });

await client.connect();
try {
  if (schemaName) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}", public`);
  }
  if (process.argv.includes("--reset")) {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  }
  const root = path.resolve(import.meta.dirname, "..");
  const schema = await fs.readFile(path.join(root, "db", "schema.sql"), "utf8");
  const seed = await fs.readFile(path.join(root, "db", "seed.sql"), "utf8");
  await client.query(schema);
  await client.query(seed);
  console.log("Database schema and demo data are ready.");
} finally {
  await client.end();
}
