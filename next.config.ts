import type { NextConfig } from "next";

const githubPagesBasePath = "/sakura.github.io";
const siteBasePath =
  process.env.NEXT_PUBLIC_SITE_BASE_PATH ??
  (process.env.NETLIFY === "true" ? "" : process.env.NODE_ENV === "production" ? githubPagesBasePath : "");

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_SITE_BASE_PATH: siteBasePath,
  },
  ...(siteBasePath
    ? {
        basePath: siteBasePath,
        assetPrefix: `${siteBasePath}/`,
      }
    : {}),
};

export default nextConfig;
