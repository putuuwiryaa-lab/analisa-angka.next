import "server-only";

/**
 * Ambil environment variable yang wajib ada.
 * Throw kalau belum di-set — dipakai semua route handler & modul server.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} belum diatur di environment variables`);
  }
  return value;
}
