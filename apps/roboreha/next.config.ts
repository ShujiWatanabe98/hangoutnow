import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_ROBOREHA_BASE_PATH?.trim() ?? "";

if (basePath && basePath !== "/roboreha-app") {
  throw new Error("NEXT_PUBLIC_ROBOREHA_BASE_PATH must be /roboreha-app.");
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
