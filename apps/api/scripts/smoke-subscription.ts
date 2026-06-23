const api = process.env.API_URL ?? "https://api.dramaplay.my.id";
const token = process.env.SMOKE_USER_TOKEN;

if (!token) {
  console.error("SMOKE_USER_TOKEN is required");
  process.exit(1);
}

async function req(path: string, init: RequestInit = {}) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(path, res.status, JSON.stringify(body).slice(0, 300));
  return { res, body };
}

const plans = await req("/billing/plans");
if (!plans.res.ok) process.exit(1);

const me = await req("/auth/me");
if (!me.res.ok) process.exit(1);

const checkout = await req("/billing/checkout", {
  method: "POST",
  body: JSON.stringify({ planCode: "vip_weekly" }),
});
if (!checkout.res.ok) process.exit(1);

console.log("Manual next step: pay checkoutUrl, then run this script again and verify /auth/me user.isVip is true.");
