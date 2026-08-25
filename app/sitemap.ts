import type { MetadataRoute } from "next";
import { exhibits } from "@/content/exhibits";

const BASE = "https://bug-museum.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, priority: 1 },
    { url: `${BASE}/about`, priority: 0.5 },
    ...exhibits.map((exhibit) => ({
      url: `${BASE}/exhibits/${exhibit.slug}`,
      priority: 0.8,
    })),
  ];
}
