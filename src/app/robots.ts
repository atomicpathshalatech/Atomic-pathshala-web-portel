import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/team", "/founder-dashboard", "/parent/", "/dashboard", "/guru/admin"],
    },
    sitemap: "https://ap.atomicpathshala.in/sitemap.xml",
  };
}
