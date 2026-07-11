import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { catalog } from "./routes/catalog";
import { watch } from "./routes/watch";
import { billing } from "./routes/billing";
import { pakasir } from "./routes/pakasir";
import { admin } from "./routes/admin";
import { events } from "./routes/events";
import { auth } from "./routes/auth";
import { reportRoutes } from "./routes/reports";
import { sitemapRoutes } from "./routes/sitemap";
import { createDb } from "@dramaplay/db";
import { providers, analyticsEvents } from "@dramaplay/db";
import { eq, lt, sql } from "drizzle-orm";
import { syncProvider } from "./sync/sync";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: ["https://dramaplay.my.id", "https://admin.dramaplay.my.id"] }));

app.get("/health", async (c) => {
  let db = "up";
  try {
    await createDb(c.env.DATABASE_URL).execute(sql`select 1`);
  } catch {
    db = "down";
  }
  return c.json({ ok: db === "up", name: "dramaplay-api", db }, db === "up" ? 200 : 503);
});

app.route("/catalog", catalog);
app.route("/watch", watch);
app.route("/billing", billing);
app.route("/pakasir", pakasir);
app.route("/events", events);
app.route("/admin", admin);
app.route("/auth", auth);
app.route("/reports", reportRoutes);
sitemapRoutes(app);

// Proxy for Sapimu providers whose play endpoint returns a raw manifest behind
// auth (e.g. dramaboxbaru /api/stream → m3u8 text). The manifest is small;
// its segments are public and play directly from the provider CDN.
app.get("/proxy/sapimu-stream", async (c) => {
  const path = c.req.query("path");
  if (!path || !c.env.PROVIDER_API_TOKEN || !c.env.PROVIDER_BASE_URL) {
    return c.json({ error: "bad_request" }, 400);
  }
  // Only allow proxying to the configured Sapimu base, not arbitrary hosts.
  if (!path.startsWith("/")) return c.json({ error: "bad_request" }, 400);
  try {
    const upstream = await fetch(c.env.PROVIDER_BASE_URL + path, {
      headers: { Authorization: `Bearer ${c.env.PROVIDER_API_TOKEN}`, "User-Agent": "Mozilla/5.0" },
    });
    if (!upstream.ok || !upstream.body) return c.json({ error: "upstream_error" }, 502);
    // Rewrite segment URLs through the same-origin /stream proxy so playback
    // matches the working path (reelshort): segments load same-origin with a
    // video/mp2t content-type instead of the CDN's text/plain + nosniff, which
    // some browsers/extensions refuse to feed to MSE.
    const text = await upstream.text();
    // ponytail: rewrite to absolute consumer origin so hls.js (loading the
    // manifest from api.dramaplay.my.id) resolves /stream against the consumer
    // Pages worker that actually handles it.
    const consumerOrigin = c.env.CONSUMER_URL.replace(/\/$/, "");
    const proxy = (ref: string) => `${consumerOrigin}/stream?u=${encodeURIComponent(ref)}`;
    const rewritten = text
      .split("\n")
      .map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith("#"))
          return line.replace(/URI="([^"]+)"/g, (_, ref) => `URI="${proxy(ref)}"`);
        return /^https?:\/\//.test(t) ? proxy(t) : line;
      })
      .join("\n");
    return new Response(rewritten, {
      status: 200,
      headers: {
        "content-type": "application/vnd.apple.mpegurl",
        "access-control-allow-origin": "*",
        "cache-control": "private, max-age=60",
      },
    });
  } catch {
    return c.json({ error: "upstream_error" }, 502);
  }
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const db = createDb(env.DATABASE_URL);
        // Anti-pause keep-alive (Supabase pauses after 7 days idle).
        await db.execute(sql`select 1`);
        // Analytics retention: purge events older than 7 days (caps 500MB DB).
        await db
          .delete(analyticsEvents)
          .where(lt(analyticsEvents.createdAt, new Date(Date.now() - 7 * 86400_000)));
        // ponytail: sync runs manually via scripts/sync-providers.ts;
        // free tier (10ms CPU, 50 subrequests) can't handle 200+ API calls per provider.
        // Add per-provider cron + Workers Standard ($5/mo) when needed.
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
