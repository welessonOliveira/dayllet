import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Upload de extrato vai até 1 MB (src/lib/statement.ts); 2 MB dá folga pro FormData.
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
