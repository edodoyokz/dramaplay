import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { createDb, dramaProviders, dramas, episodes, providers, reports } from "@dramaplay/db";
import type { Env } from "../env";
import { getUserId } from "../middleware/auth";

type Reason = "video_error" | "subtitle_error" | "payment_error" | "wrong_episode" | "other";

const reasons = new Set<Reason>([
  "video_error",
  "subtitle_error",
  "payment_error",
  "wrong_episode",
  "other",
]);
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60_000;
const MAX_REPORTS = 5;

export const reportRoutes = new Hono<{ Bindings: Env }>();

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isRateLimited(key: string, now = Date.now()) {
  const fresh = (hits.get(key) ?? []).filter((ts) => now - ts < WINDOW_MS);
  if (fresh.length >= MAX_REPORTS) {
    hits.set(key, fresh);
    return true;
  }
  fresh.push(now);
  hits.set(key, fresh);
  return false;
}

reportRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.json({ error: "bad_request" }, 400);

  const reason = clean((body as any).reason, 40) as Reason;
  if (!reasons.has(reason)) return c.json({ error: "invalid_reason" }, 400);

  const auth = c.req.header("authorization") ?? "";
  const reporterId = auth.startsWith("Bearer ") ? await getUserId(c.env, auth.slice(7)) : null;
  const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  if (isRateLimited(reporterId ?? ip)) return c.json({ error: "rate_limited" }, 429);

  const targetType = clean((body as any).targetType, 20) || "other";
  if (!["episode", "payment", "subtitle", "other"].includes(targetType))
    return c.json({ error: "invalid_target" }, 400);

  const message = clean((body as any).message, 500);
  const dramaSlug = clean((body as any).dramaSlug, 160);
  const episodeNumber = Number((body as any).episodeNumber);
  const client =
    typeof (body as any).client === "object" && (body as any).client ? (body as any).client : {};
  const path = clean(client.path, 200);
  const userAgent = clean(client.userAgent, 300);

  const db = createDb(c.env.DATABASE_URL);
  let targetId: string | null = null;
  let providerCode = "";
  let title = "";

  if (targetType === "episode" && dramaSlug && Number.isFinite(episodeNumber)) {
    const [row] = await db
      .select({ episodeId: episodes.id, title: dramas.title, providerCode: providers.code })
      .from(episodes)
      .innerJoin(dramas, eq(episodes.dramaId, dramas.id))
      .leftJoin(
        dramaProviders,
        and(eq(dramaProviders.dramaId, dramas.id), eq(dramaProviders.isPrimary, true)),
      )
      .leftJoin(providers, eq(dramaProviders.providerId, providers.id))
      .where(and(eq(dramas.slug, dramaSlug), eq(episodes.episodeNumber, episodeNumber)));
    targetId = row?.episodeId ?? null;
    providerCode = row?.providerCode ?? "";
    title = row?.title ?? "";
  }

  await db.insert(reports).values({
    reporterId,
    targetType: targetType as "episode" | "payment" | "subtitle" | "other",
    targetId,
    reason,
    note: JSON.stringify({ message, dramaSlug, episodeNumber, path, userAgent, providerCode }),
  });

  c.executionCtx.waitUntil(
    sendReportEmail(c.env, {
      reason,
      message,
      dramaSlug,
      episodeNumber,
      path,
      providerCode,
      title,
    }),
  );
  return c.json({ ok: true });
});

async function sendReportEmail(
  env: Env,
  report: {
    reason: string;
    message: string;
    dramaSlug: string;
    episodeNumber: number;
    path: string;
    providerCode: string;
    title: string;
  },
) {
  if (!env.RESEND_API_KEY || !env.REPORT_EMAIL_TO) return;
  const text = [
    "Dramaplay error report",
    `Reason: ${report.reason}`,
    `Provider: ${report.providerCode || "unknown"}`,
    `Title: ${report.title || "unknown"}`,
    `Drama slug: ${report.dramaSlug || "-"}`,
    `Episode: ${Number.isFinite(report.episodeNumber) ? report.episodeNumber : "-"}`,
    `Path: ${report.path || "-"}`,
    "",
    "Message:",
    report.message || "-",
  ].join("\n");

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "Dramaplay <onboarding@resend.dev>",
      to: env.REPORT_EMAIL_TO,
      subject: "Dramaplay error report",
      text,
    }),
  }).catch(() => undefined);
}
