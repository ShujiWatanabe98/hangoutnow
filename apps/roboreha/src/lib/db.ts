import { Pool, type PoolClient, type QueryResultRow } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://roboreha:roboreha@localhost:55432/roboreha";
const schema = process.env.DB_SCHEMA?.trim() ?? "";

if (schema && !/^[a-z][a-z0-9_]{2,62}$/.test(schema)) {
  throw new Error("DB_SCHEMA contains unsupported characters.");
}

const globalForDb = globalThis as unknown as { roborehaPool?: Pool };

export const pool =
  globalForDb.roborehaPool ??
  new Pool({
    connectionString,
    ...(schema ? { options: `-c search_path=${schema},public` } : {}),
    max: 10,
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.roborehaPool = pool;

export async function query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return pool.query<T>(text, values);
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
