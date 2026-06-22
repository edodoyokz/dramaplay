import { Hono } from "hono";
import type { Env } from "./env";
import { catalog } from "./routes/catalog";
import { watch } from "./routes/watch";
import { billing } from "./routes/billing";
import { pakasir } from "./routes/pakasir";
import { admin } from "./routes/admin";
import { events } from "./routes/events";
import { auth } from "./routes/auth";
import { createDb } from "@dramaplay/db";
import { providers, analyticsEvents } from "@dramaplay/db";
import { eq, lt, sql } from "drizzle-orm";
import { syncProvider } from "./sync/sync";

const app = new Hono<{ Bindings: Env }>();

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
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/vnd.apple.mpegurl",
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
        await db.delete(analyticsEvents).where(lt(analyticsEvents.createdAt, new Date(Date.now() - 7 * 86400_000)));
        const enabled = await db.select().from(providers).where(eq(providers.isEnabled, true));
        for (const p of enabled) {
          try {
            await syncProvider(env.DATABASE_URL, p.code, env.PROVIDER_BASE_URL, env.PROVIDER_API_TOKEN);
          } catch {
            // errors already logged inside syncProvider
          }
        }
      })()
    );
  },
} satisfies ExportedHandler<Env>;
