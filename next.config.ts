import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['chokidar', 'better-sqlite3'],
};

export default nextConfig;
