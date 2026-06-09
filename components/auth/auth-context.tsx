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
  verifying: boolean; // true selagi /api/verify jalan di background (opsional dipakai UI)
  login: (role: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "supreme_token";
const ROLE_KEY = "supreme_role";
const VIP_ROLES: Role[] = ["PRO", "MASTER"];

export function AuthProvider({ children }: { children: ReactNode }) {
  // Mulai FREE agar cocok dengan render server (hindari hydration mismatch).
  const [role, setRole] = useState<Role>("FREE");
  const [token, setToken] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    // Bersihkan sisa key lama dari versi sebelumnya.
    localStorage.removeItem("supreme_device_id");
    localStorage.removeItem("supreme_display_code");

    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) return; // tetap FREE, app sudah tampil — tanpa spinner

    setToken(saved);

    // OPTIMIS: pakai role terakhir yang diketahui supaya VIP langsung kebuka
    // tanpa menunggu jaringan. Server tetap re-validasi tiap aksi terkunci,
    // jadi ini aman walau token ternyata sudah kadaluarsa.
    const cachedRole = localStorage.getItem(ROLE_KEY) as Role | null;
    if (cachedRole && VIP_ROLES.includes(cachedRole)) setRole(cachedRole);

    // Verifikasi di BACKGROUND — tidak memblok tampilan.
    setVerifying(true);
    (async () => {
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: saved }),
        });
        const json = await res.json();
        if (json.valid) {
          setRole(json.role);
          localStorage.setItem(ROLE_KEY, json.role);
        } else {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(ROLE_KEY);
          setToken(null);
          setRole("FREE");
        }
      } catch {
        // Jaringan gagal: biarkan role optimis apa adanya.
        // Aksi VIP tetap dijaga server, jadi offline pun tetap nyaman.
      } finally {
        setVerifying(false);
      }
    })();
  }, []);

  const login = useCallback((r: string, t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(ROLE_KEY, r);
    setToken(t);
    setRole(r as Role);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
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
