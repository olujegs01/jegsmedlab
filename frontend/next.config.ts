import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${API_URL}/auth/:path*`,
      },
      {
        source: "/shared/:path*",
        destination: `${API_URL}/api/shared/:path*`,
      },
      {
        source: "/api/admin/:path*",
        destination: `${API_URL}/api/admin/:path*`,
      },
    ];
  },
};

export default nextConfig;
