import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundling @sparticuz/chromium relocates its code away from bin/ (the actual
  // Chromium binary), which is not JS and cannot be bundled — launch then fails
  // with "input directory .../bin does not exist". Externalizing keeps both
  // packages in node_modules where the file tracer ships them whole.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
  // The render route reads these from disk at runtime (fs.readFile), which the
  // serverless file tracer cannot see. Without this list the deployed lambda
  // has no layout CSS, no logos, and no fonts.
  outputFileTracingIncludes: {
    "/api/render": [
      "./lib/layouts/**/*.css",
      "./public/templates/**",
      "./public/fonts/**",
    ],
  },
};

export default nextConfig;
