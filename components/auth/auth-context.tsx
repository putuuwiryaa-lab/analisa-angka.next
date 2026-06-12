"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Role = "TRIAL" | "PRO" | "MASTER" | "FREE";

interface AuthState {
  role: Role;
  token: string | null;
  verifying: boolean;
  login: (role: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "aa_token";
const ROLE_KEY = "aa_role";
const EXPIRES_KEY = "aa_expires_at";
const LEGACY_TOKEN_KEY = "supreme_token";
const LEGACY_ROLE_KEY = "supreme_role";
const ACCESS_ROLES: Role[] = ["TRIAL", "PRO", "MASTER"];

function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  localStorage.removeItem("aa_telegram_user_id");
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ROLE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("FREE");
  const [token, setToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    localStorage.removeItem("supreme_device_id");
    localStorage.removeItem("supreme_display_code");

    const saved = localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
    if (!saved) return;

    setToken(saved);

    const cachedRole = (localStorage.getItem(ROLE_KEY) || localStorage.getItem(LEGACY_ROLE_KEY)) as Role | null;
    if (cachedRole && ACCESS_ROLES.includes(cachedRole)) {
      setRole(cachedRole);
    }

    setVerifying(true);
    (async () => {
      try {
        const res = await fetch("/api/verify-session", {
          method: "GET",
          headers: { Authorization: `Bearer ${saved}` },
        });
        const json = await res.json().catch(() => ({}));

        if (res.ok && json.success) {
          const verifiedRole = String(json.role || "TRIAL") as Role;
          setRole(verifiedRole);
          setToken(saved);
          localStorage.setItem(TOKEN_KEY, saved);
          localStorage.setItem(ROLE_KEY, verifiedRole);
          localStorage.setItem(EXPIRES_KEY, json.expires_at || "");
          localStorage.setItem("aa_telegram_user_id", String(json.telegram_user_id || ""));
          localStorage.setItem(LEGACY_TOKEN_KEY, saved);
          localStorage.setItem(LEGACY_ROLE_KEY, verifiedRole);
        } else {
          clearStoredAuth();
          setToken(null);
          setRole("FREE");
        }
      } catch {
        // Jika jaringan gagal, biarkan role lokal sementara.
        // AuthGate tetap akan cek ulang saat membuka halaman terkunci.
      } finally {
        setVerifying(false);
      }
    })();
  }, []);

  const login = useCallback((r: string, t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(ROLE_KEY, r);
    localStorage.setItem(LEGACY_TOKEN_KEY, t);
    localStorage.setItem(LEGACY_ROLE_KEY, r);
    setToken(t);
    setRole(r as Role);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setToken(null);
    setRole("FREE");
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
