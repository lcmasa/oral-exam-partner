import type { NextConfig } from "next";

const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const pagesExport = pagesBasePath.length > 0;

const nextConfig: NextConfig = {
  ...(pagesExport
    ? {
        output: "export",
        basePath: pagesBasePath,
        images: { unoptimized: true },
      }
    : {
        cacheComponents: true,
        partialPrefetching: true,
      }),
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
