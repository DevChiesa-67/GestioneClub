// src/app/manifest.ts

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gestione Club",
    short_name: "Club",
    description: "Gestionale per club sportivi",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#dc2626",
    orientation: "portrait",
    icons: [
      {
        src: "/api/pwa/icon?size=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/api/pwa/icon?size=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}