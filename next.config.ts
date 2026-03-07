import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "@sparticuz/chromium", "puppeteer-core"],
};

export default nextConfig;
