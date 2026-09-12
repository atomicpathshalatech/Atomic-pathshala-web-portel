import type { MetadataRoute } from "next";

/**
 * Web App Manifest — served at /manifest.webmanifest by Next's metadata
 * route. Makes the Atomic Pathshala student web app installable from
 * Chrome (Android + desktop) with no APK. The Capacitor native build is
 * unaffected — it loads the same origin in a WebView and simply ignores
 * this file.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atomic Pathshala",
    short_name: "Atomic Pathshala",
    description:
      "Atomic Pathshala — live classes, tests, DPPs and doubt solving for NEET, JEE and Boards.",
    id: "/",
    start_url: "/dashboard?utm_source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#090D16",
    theme_color: "#090D16",
    lang: "en-IN",
    dir: "ltr",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Live Classes", short_name: "Live", url: "/schedule?utm_source=pwa" },
      { name: "My Tests", short_name: "Tests", url: "/tests?utm_source=pwa" },
      { name: "My DPP", short_name: "DPP", url: "/dpp?utm_source=pwa" },
      { name: "Doubts", short_name: "Doubts", url: "/doubts?utm_source=pwa" },
    ],
  };
}
