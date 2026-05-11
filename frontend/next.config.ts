import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["lvh.me", "*.lvh.me", "localhost", "*.localhost"],
};

export default nextConfig;
