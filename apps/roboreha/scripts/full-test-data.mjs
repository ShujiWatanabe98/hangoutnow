import fs from "node:fs/promises";
import path from "node:path";
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
  const root = path.resolve(import.meta.dirname, "..");
  const schema = await fs.readFile(path.join(root, "db", "schema.sql"), "utf8");
  const seed = await fs.readFile(path.join(root, "db", "seed.sql"), "utf8");
  const testData = await fs.readFile(path.join(root, "db", "full-test-data.sql"), "utf8");
  await client.query("BEGIN");
  await client.query(schema);
  await client.query(seed);
  await client.query(testData);
  await client.query("COMMIT");
  console.log("Gunma full test data is ready: 100 customers, 6 staff, August records, September appointments.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
