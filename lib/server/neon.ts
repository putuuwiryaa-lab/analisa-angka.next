import "server-only";

import { neon } from "@neondatabase/serverless";

let cachedSql: ReturnType<typeof neon> | null = null;

export function isAdaptiveDatabaseConfigured(): boolean {
  return Boolean(process.env.NEON_DATABASE_URL?.trim());
}

export function getAdaptiveSql(): ReturnType<typeof neon> {
  if (cachedSql) return cachedSql;

  const databaseUrl = process.env.NEON_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
  }

  cachedSql = neon(databaseUrl);
  return cachedSql;
}
