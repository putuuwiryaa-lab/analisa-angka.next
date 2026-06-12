"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { deviceAuthHeader } from "@/lib/auth/device";

export type Role = "TRIAL" | "PRO" | "MASTER";

interface AuthState {
  role: Role | null;
  token: string | null;
  verifying: boolean;
  login: (role: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "aa_token";
const ROLE_KEY = "aa_role";
const EXPIRES_KEY = "aa_expires_at";
const TELEGRAM_ID_KEY = "aa_telegram_user_id";

function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem(TELEGRAM_ID_KEY);
}

function normalizeRole(value: unknown): Role | null {
  return value === "TRIAL" || value === "PRO" || value === "MASTER" ? value : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) return;

    setToken(saved);

    const cachedRole = normalizeRole(localStorage.getItem(ROLE_KEY));
    if (cachedRole) setRole(cachedRole);

    setVerifying(true);
    (async () => {
      try {
        const res = await fetch("/api/verify-session", {
          method: "GET",
          headers: { Authorization: `Bearer ${saved}`, ...deviceAuthHeader() },
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (res.ok && json.success) {
          const verifiedRole = normalizeRole(json.role) || "TRIAL";
          setRole(verifiedRole);
          setToken(saved);
          localStorage.setItem(TOKEN_KEY, saved);
          localStorage.setItem(ROLE_KEY, verifiedRole);
          localStorage.setItem(EXPIRES_KEY, json.expires_at || "");
          localStorage.setItem(TELEGRAM_ID_KEY, String(json.telegram_user_id || ""));
        } else {
          clearStoredAuth();
          setToken(null);
          setRole(null);
        }
      } catch {
      } finally {
        setVerifying(false);
      }
    })();
  }, []);

  const login = useCallback((r: string, t: string) => {
    const nextRole = normalizeRole(r) || "TRIAL";
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(ROLE_KEY, nextRole);
    setToken(t);
    setRole(nextRole);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ role, token, verifying, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
