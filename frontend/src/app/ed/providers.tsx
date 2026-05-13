"use client";
import { EDAuthProvider } from "@/contexts/EDAuthContext";

export default function EDProviders({ children }: { children: React.ReactNode }) {
  return <EDAuthProvider>{children}</EDAuthProvider>;
}
