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
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("jegsmedlab_token");
    const storedUser = localStorage.getItem("jegsmedlab_user");
    if (stored && storedUser) {
      try {
        setToken(stored);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("jegsmedlab_token");
        localStorage.removeItem("jegsmedlab_user");
      }
    }
  }, []);

  const login = async (email: string, password: string) => {
    const params = new URLSearchParams({ email, password });
    const res = await fetch(`${API_BASE}/auth/login?${params}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
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
    const params = new URLSearchParams({ email, password, full_name: fullName });
    const res = await fetch(`${API_BASE}/auth/register?${params}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Registration failed");
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
