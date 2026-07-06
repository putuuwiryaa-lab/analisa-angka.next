export const TOKEN_VERSION = 0;
export type Role = "TRIAL" | "PRO" | "SUPER";
export interface TokenPayload {
  role?: Role;
  tokenVersion?: number;
  accountId?: string;
  phone?: string;
  sessionId?: string;
  deviceHash?: string;
  userAgentHash?: string;
  exp?: number;
}

export function signToken(...args: any[]): string {
  void args;
  return "";
}

export function verifyToken(...args: any[]): TokenPayload {
  void args;
  return { role: "SUPER", tokenVersion: TOKEN_VERSION };
}

export function getBearerToken(headers: Headers): string {
  const value = headers.get("authorization") || headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
