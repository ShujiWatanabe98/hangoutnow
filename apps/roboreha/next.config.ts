import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_ROBOREHA_BASE_PATH?.trim() ?? "";

if (basePath && !/^\/[a-z0-9][a-z0-9-]{15,80}$/.test(basePath)) {
  throw new Error("NEXT_PUBLIC_ROBOREHA_BASE_PATH must be a non-root lowercase path with at least 16 characters.");
}

if (process.env.NODE_ENV === "production" && !basePath) {
  throw new Error("NEXT_PUBLIC_ROBOREHA_BASE_PATH is required for a production build.");
}

const nextConfig: NextConfig = {
  basePath,
  reactStrictMode: true,
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
