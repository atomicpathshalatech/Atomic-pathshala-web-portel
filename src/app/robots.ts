import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/teachers",
          "/teachers/*",
          "/neet",
          "/jee",
          "/class-10",
          "/class-11",
          "/class-12",
          "/boards",
          "/chemistry",
          "/physics",
          "/biology",
          "/modules",
          "/pyq",
          "/pyq/*",
          "/blog",
          "/blog/*",
          "/about-founder",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/team/",
          "/team",
          "/student/",
          "/student",
          "/parent/",
          "/parent",
          "/founder-dashboard",
          "/dashboard",
          "/guru/admin",
          "/obs-stage/",
          "/board-render/",
          "/checkout/",
          "/verify/",
          "/install",
        ],
      },
    ],
    sitemap: "https://atomicpathshala.in/sitemap.xml",
  };
}
