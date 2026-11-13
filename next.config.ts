import type { NextConfig } from "next";

const config: NextConfig = {
  // Don't have `next dev` write an AGENTS.md into the repo.
  agentRules: false,
};

export default config;
