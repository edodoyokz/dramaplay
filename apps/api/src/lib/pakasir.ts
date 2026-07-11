import type { Env } from "../env";

/** Confirm a Pakasir order is completed for this project/amount. */
export async function verifyTransaction(
  env: Env,
  orderId: string,
  amount: number,
): Promise<boolean> {
  const url = new URL("https://app.pakasir.com/api/transactiondetail");
  url.searchParams.set("project", env.PAKASIR_PROJECT_SLUG);
  url.searchParams.set("amount", String(amount));
  url.searchParams.set("order_id", orderId);
  url.searchParams.set("api_key", env.PAKASIR_API_KEY);

  const res = await fetch(url);
  if (!res.ok) return false;
  const data = await res.json<{
    transaction?: { status?: string; amount?: number; order_id?: string; project?: string };
  }>();
  const trx = data.transaction;
  return (
    trx?.status === "completed" &&
    trx.amount === amount &&
    trx.order_id === orderId &&
    trx.project === env.PAKASIR_PROJECT_SLUG
  );
}
