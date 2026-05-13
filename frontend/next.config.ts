import type { NextConfig } from "next";

// Use NEXT_PUBLIC_API_URL (set in Vercel dashboard / vercel.json) or fall back to local dev
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.railway.app https://*.onrender.com https://*.vercel.app wss://mediscan-backend-m6lr.onrender.com",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  async rewrites() {
    return [
      // ED Gateway — MediScan backend proxy
      {
        source: "/ed-api/:path*",
        destination: "https://mediscan-backend-m6lr.onrender.com/:path*",
      },
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
