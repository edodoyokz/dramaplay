import { Hono } from "hono";
import type { Env } from "../env";
import { createDb, dramas } from "@dramaplay/db";
import { isNotNull, eq, and } from "drizzle-orm";

export function sitemapRoutes(app: Hono<{ Bindings: Env }>) {
  app.get("/sitemap.xml", async (c) => {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db
      .select({ slug: dramas.slug, updatedAt: dramas.updatedAt })
      .from(dramas)
      .where(and(isNotNull(dramas.slug), eq(dramas.visibility, "public")));
    const urls = rows.map(
      (r) =>
        `  <url><loc>https://dramaplay.my.id/drama/${r.slug}</loc><lastmod>${r.updatedAt?.toISOString().slice(0, 10) ?? "2026-06-01"}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
    );
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://dramaplay.my.id/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://dramaplay.my.id/search</loc><changefreq>weekly</changefreq><priority>0.5</priority></url>
${urls.join("\n")}
</urlset>`;
    return c.text(xml, 200, { "Content-Type": "application/xml; charset=utf-8" });
  });
}
