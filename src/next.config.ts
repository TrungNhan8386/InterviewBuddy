import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local integration worktrees can reuse the main checkout's node_modules.
  ...(process.env.INTERVIEW_LINKED_DEPENDENCY_ROOT ? {
    experimental: { turbopackAdditionalRoots: {
      interviewDependencies: { path: process.env.INTERVIEW_LINKED_DEPENDENCY_ROOT },
    } },
  } : {}),
  // Cache Components (and partialPrefetching, which depends on it) is turned off
  // for now: with it on, every page that reads the Supabase session cookie must
  // sit inside <Suspense>, otherwise the build fails. We can enable it later.
  cacheComponents: false,
  // pdf-parse (used by /api/extract-cv) loads the pdf.js worker from its own
  // folder at runtime, so it must not be bundled.
  serverExternalPackages: ["pdf-parse"],
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
