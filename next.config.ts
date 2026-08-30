import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  // Wildcards the last octet so phone/LAN testing keeps working across DHCP
  // renewals on this subnet, without needing to re-edit this file each time.
  allowedDevOrigins: ["10.0.0.*"],
};

export default nextConfig;
