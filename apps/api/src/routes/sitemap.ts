import { Hono } from "hono";
import type { Env } from "../env";
import { createDb, dramas, providers } from "@dramaplay/db";
import { isNotNull, eq, and, asc } from "drizzle-orm";

export function sitemapRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/sitemap.xml", async (c) => {
    const db = createDb(c.env.DATABASE_URL);

    // Drama pages with image extension
    const dramaRows = await db
      .select({
        slug: dramas.slug,
        title: dramas.title,
        posterUrl: dramas.posterUrl,
        updatedAt: dramas.updatedAt,
      })
      .from(dramas)
      .where(and(isNotNull(dramas.slug), eq(dramas.visibility, "public"), eq(dramas.isPublished, true)));

    const dramaUrls = dramaRows.map((r) => {
      const imgTag = r.posterUrl
        ? `\n    <image:image><image:loc>${escXml(r.posterUrl)}</image:loc><image:title>${escXml(r.title)}</image:title></image:image>`
        : "";
      return `  <url><loc>https://dramaplay.my.id/drama/${r.slug}</loc><lastmod>${r.updatedAt?.toISOString().slice(0, 10) ?? "2026-06-01"}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority>${imgTag}</url>`;
    });

    // Provider pages
    const providerRows = await db
      .select({ code: providers.code })
      .from(providers)
      .where(eq(providers.isEnabled, true))
      .orderBy(asc(providers.name));

    const providerUrls = providerRows.map(
      (p) => `  <url><loc>https://dramaplay.my.id/provider/${p.code}</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>`
    );

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url><loc>https://dramaplay.my.id/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://dramaplay.my.id/search</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
${providerUrls.join("\n")}
${dramaUrls.join("\n")}
</urlset>`;
    return c.text(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
  });
}

// ponytail: inline XML escaper, no dep needed
function escXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
