"use client";
import { useEDAuth } from "@/contexts/EDAuthContext";
import EDApp from "@/components/ed/EDApp";
import EDLoginPage from "@/components/ed/EDLoginPage";

export default function EDGatewayPage() {
  const { user, loading } = useEDAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#050c18", display: "flex", alignItems: "center", justifyContent: "center", color: "#5eead4", fontSize: 16, gap: 12 }}>
        <div style={{ width: 24, height: 24, border: "3px solid #1e293b", borderTopColor: "#0d9488", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Loading…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!user) return <EDLoginPage />;
  return <EDApp />;
}
