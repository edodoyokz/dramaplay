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
