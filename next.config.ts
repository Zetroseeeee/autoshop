import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / binary-backed packages must stay external so Vercel's file tracer ships them intact.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium", "pg", "sharp"],
};

export default nextConfig;
