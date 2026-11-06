import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "M.E.G.A: Make Eating Great Again",
    short_name: "M.E.G.A",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF4D6",
    theme_color: "#F7922A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
