import "server-only";

type NeonModule = typeof import("@neondatabase/serverless");
type AdaptiveSql = ReturnType<NeonModule["neon"]>;

let cachedSql: AdaptiveSql | null = null;

export function isAdaptiveDatabaseConfigured(): boolean {
  return Boolean(process.env.NEON_DATABASE_URL?.trim());
}

export async function getAdaptiveSql(): Promise<AdaptiveSql> {
  if (cachedSql) return cachedSql;

  const databaseUrl = process.env.NEON_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("NEON_DATABASE_URL belum dikonfigurasi.");
  }

  const { neon } = await import("@neondatabase/serverless");
  cachedSql = neon(databaseUrl);
  return cachedSql;
}
