import type { NextConfig } from "next";

// Use NEXT_PUBLIC_API_URL (set in Vercel dashboard / vercel.json) or fall back to local dev
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Health check — must come BEFORE the generic /api/:path* rule
      // Backend exposes /health (not /api/health), so we map both
      {
        source: "/api/health",
        destination: `${API_URL}/health`,
      },
      // Auth routes — proxied so browser never makes cross-origin requests
      {
        source: "/auth/:path*",
        destination: `${API_URL}/auth/:path*`,
      },
      // Shared report token routes
      {
        source: "/shared/:path*",
        destination: `${API_URL}/api/shared/:path*`,
      },
      // All other /api/* routes → backend /api/*
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
