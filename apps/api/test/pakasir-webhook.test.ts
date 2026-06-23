import { beforeEach, describe, expect, it, vi } from "vitest";

let payment: any;
let updateReturns: any[];
let subscriptionsInserted: any[];
let selectCount = 0;

function chain(rows: any[]) {
  return {
    from: () => chain(rows),
    where: () => chain(rows),
    limit: () => Promise.resolve(rows),
    then: (r: any) => Promise.resolve(rows).then(r),
  };
}

function makeDb() {
  return {
    select: () => {
      selectCount++;
      return chain(selectCount === 1 ? [payment] : [{ id: "plan1", durationDays: 7 }]);
    },
    update: () => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve(updateReturns) }),
      }),
    }),
    insert: (table: any) => ({
      values: (value: any) => {
        if (table.__name === "subscriptions") subscriptionsInserted.push(value);
        return Promise.resolve();
      },
    }),
  };
}

vi.mock("@dramaplay/db", () => ({
  createDb: () => makeDb(),
  payments: {
    id: "payment.id",
    status: "payment.status",
    pakasirReference: "payment.ref",
    __name: "payments",
  },
  subscriptions: { __name: "subscriptions" },
  plans: { id: "plans.id", __name: "plans" },
}));

import { pakasir } from "../src/routes/pakasir";

const env = { DATABASE_URL: "x", PAKASIR_PROJECT_SLUG: "dramaplay", PAKASIR_API_KEY: "key" } as any;
const body = { amount: 15000, order_id: "ref1", project: "dramaplay", status: "completed" };

beforeEach(() => {
  selectCount = 0;
  subscriptionsInserted = [];
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
  });
});
