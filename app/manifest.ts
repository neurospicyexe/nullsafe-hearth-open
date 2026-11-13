import type { MetadataRoute } from "next";

// Home-screen app (2026-10-27). id/scope pin the installed app to the whole site; start_url opens
// straight into Home. Icons come from /pwa-icon (public routes); iOS uses app/apple-icon.tsx instead.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hearth",
    short_name: "Hearth",
    description: "Halseth system dashboard",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e0b08",
    theme_color: "#e8a83e",
    orientation: "portrait",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
