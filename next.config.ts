import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  async rewrites() {
    // npm run dev（固定 3002）时把 /api 转发到 dev:api（3001），避免与 start.sh 占用的 3000 冲突
    if (process.env.NODE_ENV !== "development") return [];
    const apiPort = process.env.API_PORT || "3001";
    return [
      {
        source: "/api/:path*",
        destination: `http://127.0.0.1:${apiPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
