import { Hono } from "hono";
import type { Env } from "./env";
import { catalog } from "./routes/catalog";
import { watch } from "./routes/watch";
import { billing } from "./routes/billing";
import { pakasir } from "./routes/pakasir";
import { admin } from "./routes/admin";
import { events } from "./routes/events";
import { createDb } from "@dramaplay/db";
import { providers } from "@dramaplay/db";
import { eq } from "drizzle-orm";
import { syncProvider } from "./sync/sync";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true, name: "dramaplay-api" }));

app.route("/catalog", catalog);
app.route("/watch", watch);
app.route("/billing", billing);
app.route("/pakasir", pakasir);
app.route("/events", events);
app.route("/admin", admin);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const db = createDb(env.DATABASE_URL);
        const enabled = await db.select().from(providers).where(eq(providers.isEnabled, true));
        for (const p of enabled) {
          try {
            await syncProvider(env.DATABASE_URL, p.code, env.PROVIDER_BASE_URL);
          } catch {
            // errors already logged inside syncProvider
          }
        }
      })()
    );
  },
} satisfies ExportedHandler<Env>;
