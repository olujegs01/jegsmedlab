"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export const ED_API = "/ed-api";
export const ED_WS = "wss://mediscan-backend-m6lr.onrender.com";

const TOKEN_VALIDATE_TIMEOUT_MS = 8000;
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // refresh 5 min before expiry

interface EDUser {
  username: string;
  role: string;
  name: string;
  token: string;
}

interface EDAuthContextValue {
  user: EDUser | null;
  login: (username: string, password: string, totp_code?: string) => Promise<any>;
  loginWithToken: (accessToken: string) => void;
  logout: () => void;
  loading: boolean;
  warming: boolean;
}

const EDAuthContext = createContext<EDAuthContextValue | null>(null);

function decodeTokenPayload(token: string): any {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function EDAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<EDUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [warming, setWarming] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    localStorage.removeItem("mediscan_token");
    setUser(null);
  }, []);

  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const payload = decodeTokenPayload(token);
    if (!payload?.exp) return;

    const expiresAt = payload.exp * 1000;
    const delay = Math.max(10_000, expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${ED_API}/auth/refresh`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { logout(); return; }
        const data = await res.json();
        const newToken = data.access_token;
        localStorage.setItem("mediscan_token", newToken);
        setUser(prev => prev ? { ...prev, token: newToken } : prev);
        scheduleRefresh(newToken);
      } catch {
        // Network blip — token still valid; will retry on next page load
      }
    }, delay);
  }, [logout]);

  // Validate stored token on load
  useEffect(() => {
    const token = localStorage.getItem("mediscan_token");
    if (!token) { setLoading(false); return; }

    const controller = new AbortController();
    const warmTimer = setTimeout(() => setWarming(true), 2500);
    const killTimer = setTimeout(() => controller.abort(), TOKEN_VALIDATE_TIMEOUT_MS);

    fetch(`${ED_API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data: any) => {
        setUser({ ...data, token });
        scheduleRefresh(token);
      })
      .catch(logout)
      .finally(() => {
        clearTimeout(warmTimer);
        clearTimeout(killTimer);
        setLoading(false);
        setWarming(false);
      });

    return () => {
      clearTimeout(warmTimer);
      clearTimeout(killTimer);
      controller.abort();
    };
  }, [logout, scheduleRefresh]);

  const login = async (username: string, password: string, totp_code?: string) => {
    const res = await fetch(`${ED_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, ...(totp_code ? { totp_code } : {}) }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    if (data.mfa_required) return data;
    localStorage.setItem("mediscan_token", data.access_token);
    setUser({ username, role: data.role, name: data.name, token: data.access_token });
    scheduleRefresh(data.access_token);
    return data;
  };

  const loginWithToken = (accessToken: string) => {
    const payload = decodeTokenPayload(accessToken);
    localStorage.setItem("mediscan_token", accessToken);
    setUser({
      username: payload?.sub || "demo",
      role: payload?.role || "physician",
      name: payload?.sub === "demo" ? "Demo User" : payload?.sub,
      token: accessToken,
    });
    scheduleRefresh(accessToken);
  };

  return (
    <EDAuthContext.Provider value={{ user, login, loginWithToken, logout, loading, warming }}>
      {children}
    </EDAuthContext.Provider>
  );
}

export const useEDAuth = () => {
  const ctx = useContext(EDAuthContext);
  if (!ctx) throw new Error("useEDAuth must be used within EDAuthProvider");
  return ctx;
};
