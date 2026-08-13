import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Gli allegati medici arrivano tramite Server Actions. Il limite include
    // anche l'overhead multipart, quindi resta leggermente sopra i 10 MB
    // consentiti e validati dall'action.
    serverActions: {
      bodySizeLimit: "55mb",
    },
    proxyClientMaxBodySize: "55mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gszaqrospzlnqkiabhbr.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
