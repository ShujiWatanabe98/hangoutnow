import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString = process.env.DATABASE_URL ?? "postgresql://roboreha:roboreha@localhost:55432/roboreha";
const schemaName = process.env.DB_SCHEMA?.trim() ?? "";
const bootstrapOnlyIfEmpty = process.argv.includes("--if-empty");
if (schemaName && !/^[a-z][a-z0-9_]{2,62}$/.test(schemaName)) throw new Error("DB_SCHEMA contains unsupported characters.");
const client = new pg.Client({ connectionString, ...(schemaName ? { options: `-c search_path=${schemaName},public` } : {}) });

await client.connect();
let inTransaction = false;
let lockHeld = false;
try {
  await client.query("SELECT pg_advisory_lock(hashtext('roboreha-bootstrap-v1'))");
  lockHeld = true;
  if (schemaName) {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}", public`);
  }
  await client.query("SET TIME ZONE 'Asia/Tokyo'");
  const root = path.resolve(import.meta.dirname, "..");
  const schema = await fs.readFile(path.join(root, "db", "schema.sql"), "utf8");
  const seed = await fs.readFile(path.join(root, "db", "seed.sql"), "utf8");
  const testData = await fs.readFile(path.join(root, "db", "full-test-data.sql"), "utf8");
  await client.query("BEGIN");
  inTransaction = true;
  await client.query(schema);
  await client.query("COMMIT");
  inTransaction = false;

  const initialized = bootstrapOnlyIfEmpty
    ? await client.query("SELECT EXISTS (SELECT 1 FROM stores WHERE id='10000000-0000-0000-0000-000000000001') AS ready")
    : { rows: [{ ready: false }] };
  if (initialized.rows[0].ready) {
    console.log("Gunma demo data already exists; schema is current and seed refresh was skipped.");
  } else {
    await client.query("BEGIN");
    inTransaction = true;
    await client.query(seed);
    await client.query(testData);
    await client.query("COMMIT");
    inTransaction = false;
    console.log("Gunma full test data is ready: 100 customers, 6 staff, August records, September appointments.");
  }
} catch (error) {
  if (inTransaction) await client.query("ROLLBACK");
  throw error;
} finally {
  if (lockHeld) await client.query("SELECT pg_advisory_unlock(hashtext('roboreha-bootstrap-v1'))");
  await client.end();
}
