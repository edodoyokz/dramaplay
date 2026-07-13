import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/lib/api";
import { campaignCheckoutErrorCopy } from "../src/lib/paid-campaign";

describe("api error bodies", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retains the server JSON error code in the thrown Error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: "not_eligible" }),
      }),
    );

    await expect(api("/billing/campaign-checkout", { method: "POST" })).rejects.toThrow(
      /not_eligible/,
    );

    try {
      await api("/billing/campaign-checkout", { method: "POST" });
      expect.unreachable("api should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      const message = e instanceof Error ? e.message : "";
      expect(message).toContain("not_eligible");
      expect(campaignCheckoutErrorCopy(message)).toMatch(/belum pernah bayar|tidak memenuhi/i);
    }
  });

  it("falls back to status and path when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: async () => "<html>bad gateway</html>",
      }),
    );

    await expect(api("/billing/campaign-checkout")).rejects.toThrow(
      "502 /billing/campaign-checkout",
    );
  });

  it("still returns JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ checkoutUrl: "https://pay.example/ok" }),
      }),
    );

    await expect(api<{ checkoutUrl: string }>("/billing/campaign-checkout")).resolves.toEqual({
      checkoutUrl: "https://pay.example/ok",
    });
  });
});
