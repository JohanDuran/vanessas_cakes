import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  // Wildcards the last octet so phone/LAN testing keeps working across DHCP
  // renewals on this subnet, without needing to re-edit this file each time.
  allowedDevOrigins: ["10.0.0.*"],
  experimental: {
    // Server Actions cap request bodies at 1MB by default. Every photo
    // upload in this app (design/portfolio photos, order reference images)
    // goes through a Server Action, and phone-camera photos routinely blow
    // past 1MB — the action then never runs at all, so nothing is saved and
    // no error surfaces to the customer or admin. Raised to cover a handful
    // of multi-MB photos per submission.
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
