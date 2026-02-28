"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  patient_id: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  patientId: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_PATIENT_ID = "demo-patient";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("jegsmedlab_token");
    const storedUser = localStorage.getItem("jegsmedlab_user");
    if (!stored || !storedUser) return;

    let parsed: AuthUser | null = null;
    try { parsed = JSON.parse(storedUser); } catch {}

    if (!parsed) {
      localStorage.removeItem("jegsmedlab_token");
      localStorage.removeItem("jegsmedlab_user");
      return;
    }

    // Optimistically set user from localStorage for instant UI
    setToken(stored);
    setUser(parsed);

    // Then validate token against backend — clears session if expired or secret changed
    fetch("/auth/me", { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => {
        if (!r.ok) throw new Error("invalid");
        return r.json();
      })
      .then((data) => {
        // Refresh user data in case it changed server-side
        const refreshed: AuthUser = {
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          patient_id: data.patient_id || parsed!.patient_id,
        };
        setUser(refreshed);
        localStorage.setItem("jegsmedlab_user", JSON.stringify(refreshed));
      })
      .catch(() => {
        // Token invalid (expired, server restarted with new key, etc.) — clear session
        setUser(null);
        setToken(null);
        localStorage.removeItem("jegsmedlab_token");
        localStorage.removeItem("jegsmedlab_user");
      });
  }, []);

  const login = async (email: string, password: string) => {
    // Use relative URL so Next.js proxy handles routing — no CORS needed
    const params = new URLSearchParams({ email, password });
    const res = await fetch(`/auth/login?${params}`, { method: "POST" });
    if (!res.ok) {
      let detail = "Login failed";
      try { const err = await res.json(); detail = err.detail || detail; } catch {}
      throw new Error(detail);
    }
    const data = await res.json();
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.full_name,
      patient_id: data.patient_id,
    };
    setToken(data.access_token);
    setUser(authUser);
    localStorage.setItem("jegsmedlab_token", data.access_token);
    localStorage.setItem("jegsmedlab_user", JSON.stringify(authUser));
  };

  const register = async (email: string, password: string, fullName: string) => {
    // Use relative URL so Next.js proxy handles routing — no CORS needed
    const params = new URLSearchParams({ email, password, full_name: fullName });
    const res = await fetch(`/auth/register?${params}`, { method: "POST" });
    if (!res.ok) {
      let detail = "Registration failed";
      try { const err = await res.json(); detail = err.detail || detail; } catch {}
      throw new Error(detail);
    }
    const data = await res.json();
    const authUser: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.full_name,
      patient_id: data.patient_id,
    };
    setToken(data.access_token);
    setUser(authUser);
    localStorage.setItem("jegsmedlab_token", data.access_token);
    localStorage.setItem("jegsmedlab_user", JSON.stringify(authUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("jegsmedlab_token");
    localStorage.removeItem("jegsmedlab_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        patientId: user?.patient_id || DEMO_PATIENT_ID,
        login,
        register,
        logout,
        isDemo: !user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Returns headers with Authorization token if logged in. */
export function useAuthHeaders(): HeadersInit {
  const { token } = useAuth();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
