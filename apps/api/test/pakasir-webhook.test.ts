import { beforeEach, describe, expect, it, vi } from "vitest";

let payment: any;
let updateReturns: any[];
let subscriptionsInserted: any[];
let subscriptionsUpdated: any[];
let activeSub: any | null;
let selectCount = 0;

function chain(rows: any[]) {
  return {
    from: () => chain(rows),
    where: () => chain(rows),
    orderBy: () => chain(rows),
    limit: () => Promise.resolve(rows),
    then: (r: any) => Promise.resolve(rows).then(r),
  };
}

function makeDb() {
  const db = {
    select: () => {
      selectCount++;
      // 1: payment by order_id
      // 2: pending payment precondition inside completeVerifiedPayment
      // 3: plan by id
      // 4: active subscription lookup inside grantOrExtendSubscription
      if (selectCount === 1) return chain([payment]);
      if (selectCount === 2) return chain([{ planId: "plan1" }]);
      if (selectCount === 3) return chain([{ id: "plan1", durationDays: 7 }]);
      return chain(activeSub ? [activeSub] : []);
    },
    update: (table: any) => ({
      set: (value: any) => ({
        where: () => ({
          returning: () => {
            if (table.__name === "subscriptions") {
              subscriptionsUpdated.push(value);
              return Promise.resolve([{ id: activeSub?.id ?? "sub1", expiresAt: value.expiresAt }]);
            }
            return Promise.resolve(updateReturns);
          },
        }),
      }),
    }),
    insert: (table: any) => ({
      values: (value: any) => {
        if (table.__name === "subscriptions") {
          subscriptionsInserted.push(value);
          return {
            returning: () =>
              Promise.resolve([{ id: "sub-new", expiresAt: value.expiresAt }]),
          };
        }
        return Promise.resolve();
      },
    }),
  };
  return { ...db, transaction: (run: (tx: typeof db) => Promise<unknown>) => run(db) };
}

vi.mock("@dramaplay/db", () => ({
  createDb: () => makeDb(),
  payments: {
    id: "payment.id",
    status: "payment.status",
    pakasirReference: "payment.ref",
    __name: "payments",
  },
  paidCampaignReservations: {
    paymentId: "reservation.payment_id",
    __name: "paid_campaign_reservations",
  },
  subscriptions: {
    id: "subscriptions.id",
    userId: "subscriptions.user_id",
    status: "subscriptions.status",
    expiresAt: "subscriptions.expires_at",
    __name: "subscriptions",
  },
  plans: { id: "plans.id", __name: "plans" },
}));

import { pakasir } from "../src/routes/pakasir";

const env = { DATABASE_URL: "x", PAKASIR_PROJECT_SLUG: "dramaplay", PAKASIR_API_KEY: "key" } as any;
const body = { amount: 15000, order_id: "ref1", project: "dramaplay", status: "completed" };

beforeEach(() => {
  selectCount = 0;
  subscriptionsInserted = [];
  subscriptionsUpdated = [];
  activeSub = null;
  payment = {
    id: "pay1",
    userId: "u1",
    planId: "plan1",
    amountIdr: 15000,
    status: "pending",
    pakasirReference: "ref1",
  };
  updateReturns = [{ ...payment, status: "paid" }];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            transaction: {
              status: "completed",
              amount: 15000,
              order_id: "ref1",
              project: "dramaplay",
            },
          }),
        ),
    ),
  );
});

describe("pakasir webhook idempotency", () => {
  it("does not create subscription when payment is already paid", async () => {
    payment.status = "paid";

    const res = await pakasir.request(
      "/webhook",
      { method: "POST", body: JSON.stringify(body) },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(subscriptionsInserted).toEqual([]);
    expect(subscriptionsUpdated).toEqual([]);
  });

  it("does not create subscription when conditional payment update loses race", async () => {
    updateReturns = [];

    const res = await pakasir.request(
      "/webhook",
      { method: "POST", body: JSON.stringify(body) },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(subscriptionsInserted).toEqual([]);
    expect(subscriptionsUpdated).toEqual([]);
  });

  it("creates one subscription after pending payment update succeeds", async () => {
    const res = await pakasir.request(
      "/webhook",
      { method: "POST", body: JSON.stringify(body) },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(subscriptionsInserted).toHaveLength(1);
    expect(subscriptionsInserted[0]).toMatchObject({
      userId: "u1",
      planId: "plan1",
      status: "active",
    });
    expect(subscriptionsUpdated).toEqual([]);
  });

  it("extends existing active subscription instead of stacking", async () => {
    activeSub = {
      id: "sub-old",
      userId: "u1",
      planId: "plan1",
      status: "active",
      expiresAt: new Date(Date.now() + 2 * 86_400_000),
    };

    const res = await pakasir.request(
      "/webhook",
      { method: "POST", body: JSON.stringify(body) },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(subscriptionsInserted).toEqual([]);
    expect(subscriptionsUpdated).toHaveLength(1);
    expect(subscriptionsUpdated[0].planId).toBe("plan1");
    expect(subscriptionsUpdated[0].expiresAt.getTime()).toBeGreaterThan(activeSub.expiresAt.getTime());
  });
});
