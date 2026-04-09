import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true, // Docker-safe: no Vercel image optimization
  },
  // Standard Node.js server — no Edge Runtime, no ISR
  // This keeps the app Docker-portable
};

export default nextConfig;
