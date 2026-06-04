import "server-only";
import jwt from "jsonwebtoken";
import { requireEnv } from "./env";

export const TOKEN_VERSION = Number(process.env.TOKEN_VERSION || 2);

export type Role = "TRIAL" | "PRO" | "MASTER";

export interface TokenPayload {
  role: Role;
  deviceId: string;
  displayCode: string;
  tokenVersion: number;
}

/**
 * Tanda tangani JWT. tokenVersion otomatis diisi dari env (default 2).
 * expiresIn contoh: "14d" (trial), "60d" (pro), "365d" (master).
 */
export function signToken(
  payload: Omit<TokenPayload, "tokenVersion">,
  expiresIn: jwt.SignOptions["expiresIn"],
): string {
  return jwt.sign(
    { ...payload, tokenVersion: TOKEN_VERSION },
    requireEnv("JWT_SECRET"),
    { expiresIn },
  );
}

/** Verifikasi JWT. Throw kalau invalid / kadaluarsa (TokenExpiredError). */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, requireEnv("JWT_SECRET")) as TokenPayload;
}

/** Ambil token dari header Authorization: "Bearer <token>". */
export function getBearerToken(headers: Headers): string {
  const auth =
    headers.get("authorization") || headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}
