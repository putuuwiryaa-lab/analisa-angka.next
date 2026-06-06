import "server-only";
import jwt from "jsonwebtoken";
import { requireEnv } from "./env";

export const TOKEN_VERSION = Number(process.env.TOKEN_VERSION || 2);

export type Role = "TRIAL" | "PRO" | "MASTER";

export interface TokenPayload {
  role: Role;
  tokenVersion: number;
  accountId?: string;
  phone?: string;
}

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

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, requireEnv("JWT_SECRET")) as TokenPayload;
}

export function getBearerToken(headers: Headers): string {
  const auth = headers.get("authorization") || headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}
