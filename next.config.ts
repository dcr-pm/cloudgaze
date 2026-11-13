import type { NextConfig } from "next";

const config: NextConfig = {
  // Receipt photos are downscaled in the browser, but leave headroom.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default config;
