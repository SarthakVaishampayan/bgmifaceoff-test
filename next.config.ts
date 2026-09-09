import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Most pages depend on Supabase at runtime — skip static pre-rendering
  // This is the correct mode for auth-gated, dynamic apps
  staticPageGenerationTimeout: 120,
  experimental: {
    // Allow build to succeed even if some pages can't pre-render (they'll render at request time)
  },
};

export default nextConfig;
