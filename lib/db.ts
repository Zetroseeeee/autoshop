import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Postgres via node-postgres. Works against Neon (use the pooled "-pooler" host on
 * Vercel) and against a local Postgres for development.
 */
function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — see .env.example");
  }
  const host = safeHost(connectionString);
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: local || /sslmode=disable/.test(connectionString) ? undefined : { rejectUnauthorized: true },
  });
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const globalForDb = globalThis as unknown as { __basketPool?: Pool };
const pool = globalForDb.__basketPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__basketPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
