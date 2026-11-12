import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let other devices on the same Wi-Fi use the dev server (by IP or Bonjour name).
  allowedDevOrigins: ["172.30.1.4", "*.local"],
};

export default nextConfig;
