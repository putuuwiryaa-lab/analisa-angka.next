"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type AuthStatus = "LOADING" | "LOCKED" | "READY";
export type Role = "TRIAL" | "PRO" | "MASTER" | "FREE";

interface AuthState {
  status: AuthStatus;
  role: Role;
  deviceId: string;
  displayCode: string;
  token: string | null;
  login: (role: string, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const DEVICE_KEY = "supreme_device_id";
const CODE_KEY = "supreme_display_code";
const TOKEN_KEY = "supreme_token";

function getDeviceIdentity() {
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  let displayCode = localStorage.getItem(CODE_KEY);
  if (!displayCode || displayCode.length !== 6) {
    displayCode = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem(CODE_KEY, displayCode);
  }
  return { deviceId, displayCode };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("LOADING");
  const [role, setRole] = useState<Role>("FREE");
  const [deviceId, setDeviceId] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const id = getDeviceIdentity();
    setDeviceId(id.deviceId);
    setDisplayCode(id.displayCode);

    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      setRole("FREE");
      setStatus("READY");
      return;
    }
    setToken(saved);

    (async () => {
      try {
        const res = await fetch("/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: saved, deviceId: id.deviceId }),
        });
        const json = await res.json();
        if (json.valid) {
          setRole(json.role);
          setStatus("READY");
        } else {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setRole("FREE");
          setStatus("READY");
        }
      } catch {
        setRole("FREE");
        setStatus("READY");
      }
    })();
  }, []);

  const login = useCallback((r: string, t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setRole(r as Role);
    setStatus("READY");
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setRole("FREE");
    setStatus("READY");
  }, []);

  return (
    <AuthContext.Provider
      value={{ status, role, deviceId, displayCode, token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return ctx;
}
