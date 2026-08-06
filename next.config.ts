import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
