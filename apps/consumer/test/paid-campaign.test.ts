import { describe, expect, it, vi } from "vitest";
import {
  FB15K_OFFER,
  buildCampaignCheckoutBody,
  campaignCheckoutErrorCopy,
  campaignStatusCopy,
  formatOfferPrice,
  freeCouponErrorCopy,
  isPaidCampaignCode,
  isPricingModalCloseBlocked,
  normalizeCampaignCode,
  parseCampaignAttribution,
  parsePublicCampaignResponse,
  promoAuthReturnPath,
  resolveManualCodeAction,
  submitManualPromoCode,
} from "../src/lib/paid-campaign";

describe("normalizeCampaignCode", () => {
  it("trims and uppercases the public campaign code", () => {
    expect(normalizeCampaignCode(" fb15k ")).toBe("FB15K");
    expect(normalizeCampaignCode("Fb15K")).toBe("FB15K");
  });
});

describe("isPaidCampaignCode", () => {
  it("recognizes FB15K case-insensitively and rejects free coupon codes", () => {
    expect(isPaidCampaignCode("fb15k")).toBe(true);
    expect(isPaidCampaignCode("FB15K")).toBe(true);
    expect(isPaidCampaignCode("LAUNCH50")).toBe(false);
    expect(isPaidCampaignCode("")).toBe(false);
  });
});

describe("parseCampaignAttribution", () => {
  it("reads optional UTM params without inventing values", () => {
    expect(
      parseCampaignAttribution(
        "utm_source=facebook&utm_medium=group&utm_campaign=fb15k&utm_content=group-a&other=1",
      ),
    ).toEqual({
      utmSource: "facebook",
      utmMedium: "group",
      utmCampaign: "fb15k",
      utmContent: "group-a",
    });
    expect(parseCampaignAttribution("")).toEqual({});
    expect(parseCampaignAttribution("foo=bar")).toEqual({});
  });
});

describe("promoAuthReturnPath", () => {
  it("keeps the promo path and UTM query for post-login return", () => {
    expect(promoAuthReturnPath("fb15k", "utm_source=facebook&utm_content=group-a")).toBe(
      "/promo/fb15k?utm_source=facebook&utm_content=group-a",
    );
    expect(promoAuthReturnPath("FB15K", "")).toBe("/promo/fb15k");
  });
});

describe("buildCampaignCheckoutBody", () => {
  it("sends normalized code and camelCase attribution for campaign-checkout", () => {
    expect(
      buildCampaignCheckoutBody("fb15k", {
        utmSource: "facebook",
        utmMedium: "group",
        utmCampaign: "fb15k",
        utmContent: "group-a",
      }),
    ).toEqual({
      code: "FB15K",
      attribution: {
        utmSource: "facebook",
        utmMedium: "group",
        utmCampaign: "fb15k",
        utmContent: "group-a",
      },
    });
    expect(buildCampaignCheckoutBody("FB15K", {})).toEqual({
      code: "FB15K",
      attribution: {},
    });
  });
});

describe("FB15K offer copy helpers", () => {
  it("exposes truthful commercial terms for the landing page", () => {
    expect(FB15K_OFFER.amountIdr).toBe(15_000);
    expect(FB15K_OFFER.durationDays).toBe(30);
    expect(FB15K_OFFER.capacity).toBe(500);
    expect(formatOfferPrice(FB15K_OFFER.amountIdr)).toBe("Rp15.000");
  });
});

describe("parsePublicCampaignResponse", () => {
  it("consumes explicit available|full|unavailable without collapsing disabled into full", () => {
    expect(parsePublicCampaignResponse({ status: "available", amountIdr: 15_000, durationDays: 30, capacity: 500 }))
      .toEqual({
        status: "available",
        amountIdr: 15_000,
        durationDays: 30,
        capacity: 500,
      });
    expect(parsePublicCampaignResponse({ status: "full", amountIdr: 15_000, durationDays: 30, capacity: 500 }).status)
      .toBe("full");
    expect(parsePublicCampaignResponse({ status: "unavailable", amountIdr: 15_000, durationDays: 30 }).status)
      .toBe("unavailable");
  });

  it("maps available boolean without treating false as full", () => {
    expect(
      parsePublicCampaignResponse({
        code: "FB15K",
        amountIdr: 15_000,
        durationDays: 30,
        available: true,
      }),
    ).toMatchObject({ status: "available", amountIdr: 15_000, durationDays: 30 });
    expect(
      parsePublicCampaignResponse({
        code: "FB15K",
        amountIdr: 15_000,
        durationDays: 30,
        available: false,
      }).status,
    ).toBe("unavailable");
  });

  it("prefers explicit status over available boolean", () => {
    expect(
      parsePublicCampaignResponse({
        status: "full",
        available: false,
        amountIdr: 12_000,
        durationDays: 14,
        capacity: 100,
      }),
    ).toEqual({
      status: "full",
      amountIdr: 12_000,
      durationDays: 14,
      capacity: 100,
    });
  });

  it("falls back to offline defaults only for missing commercial fields", () => {
    expect(parsePublicCampaignResponse({ status: "available" })).toEqual({
      status: "available",
      amountIdr: FB15K_OFFER.amountIdr,
      durationDays: FB15K_OFFER.durationDays,
      capacity: FB15K_OFFER.capacity,
    });
    expect(parsePublicCampaignResponse(null).status).toBe("unavailable");
  });
});

describe("campaignStatusCopy", () => {
  it("uses server commercial terms when provided", () => {
    const copy = campaignStatusCopy("available", {
      amountIdr: 12_000,
      durationDays: 14,
      capacity: 100,
    });
    expect(copy).toMatch(/Rp12\.000/);
    expect(copy).toMatch(/14 hari/);
    expect(copy).toMatch(/100/);
    expect(campaignStatusCopy("full")).toMatch(/penuh|habis/i);
    expect(campaignStatusCopy("unavailable")).toMatch(/tidak tersedia/i);
  });
});

describe("campaignCheckoutErrorCopy", () => {
  it("maps server campaign failures to user-facing Indonesian copy", () => {
    expect(campaignCheckoutErrorCopy("not_eligible")).toMatch(/belum pernah bayar|tidak memenuhi/i);
    expect(campaignCheckoutErrorCopy("campaign_full")).toMatch(/penuh|habis/i);
    expect(campaignCheckoutErrorCopy("campaign_unavailable")).toMatch(/tidak tersedia/i);
    expect(campaignCheckoutErrorCopy("unknown")).toMatch(/gagal/i);
    expect(campaignCheckoutErrorCopy("checkout_expired")).toMatch(/gagal/i);
  });
});

describe("isPricingModalCloseBlocked", () => {
  it("blocks close while plan checkout or coupon redeem is busy", () => {
    expect(isPricingModalCloseBlocked(null, false)).toBe(false);
    expect(isPricingModalCloseBlocked("vip_7d", false)).toBe(true);
    expect(isPricingModalCloseBlocked(null, true)).toBe(true);
    expect(isPricingModalCloseBlocked("vip_7d", true)).toBe(true);
  });
});

describe("resolveManualCodeAction", () => {
  it("routes only FB15K to paid campaign checkout; other codes stay on free redeem", () => {
    expect(resolveManualCodeAction(" fb15k ")).toEqual({
      kind: "campaign_checkout",
      code: "FB15K",
    });
    expect(resolveManualCodeAction("LAUNCH50")).toEqual({
      kind: "redeem",
      code: "LAUNCH50",
    });
    expect(resolveManualCodeAction("vipfree")).toEqual({
      kind: "redeem",
      code: "vipfree",
    });
  });
});

describe("freeCouponErrorCopy", () => {
  it("maps free coupon failures without treating FB15K campaign errors", () => {
    expect(freeCouponErrorCopy("already_redeemed")).toBe("Kupon ini sudah pernah kamu pakai.");
    expect(freeCouponErrorCopy("coupon_exhausted")).toBe("Kuota kupon sudah habis.");
    expect(freeCouponErrorCopy("coupon_expired")).toBe("Kupon sudah kedaluwarsa.");
    expect(freeCouponErrorCopy("invalid_coupon")).toBe("Kupon tidak valid.");
  });
});

describe("submitManualPromoCode", () => {
  it("sends FB15K to campaign-checkout and free codes to redeem", async () => {
    const campaignCheckout = vi.fn().mockResolvedValue({
      checkoutUrl: "https://pay.example/fb15k",
    });
    const redeem = vi.fn();

    const paid = await submitManualPromoCode(" fb15k ", {
      getToken: async () => "tok",
      campaignCheckout,
      redeem,
    });
    expect(paid).toEqual({ kind: "redirect", url: "https://pay.example/fb15k" });
    expect(campaignCheckout).toHaveBeenCalledWith(
      { code: "FB15K", attribution: {} },
      "tok",
    );
    expect(redeem).not.toHaveBeenCalled();

    campaignCheckout.mockClear();
    redeem.mockResolvedValue({ planName: "VIP 7 Hari", durationDays: 7 });
    const free = await submitManualPromoCode("LAUNCH50", {
      getToken: async () => "tok",
      campaignCheckout,
      redeem,
    });
    expect(free).toEqual({
      kind: "success",
      text: "Kupon aktif! VIP 7 Hari (7 hari) telah ditambahkan.",
    });
    expect(redeem).toHaveBeenCalledWith("LAUNCH50", "tok");
    expect(campaignCheckout).not.toHaveBeenCalled();
  });

  it("returns auth when no token and maps campaign vs coupon errors", async () => {
    const auth = await submitManualPromoCode("FB15K", {
      getToken: async () => null,
      campaignCheckout: vi.fn(),
      redeem: vi.fn(),
      returnTo: "/profile",
    });
    expect(auth).toEqual({ kind: "auth", returnTo: "/profile" });

    const campaignErr = await submitManualPromoCode("FB15K", {
      getToken: async () => "tok",
      campaignCheckout: async () => {
        throw new Error("409 not_eligible");
      },
      redeem: vi.fn(),
    });
    expect(campaignErr.kind).toBe("error");
    if (campaignErr.kind === "error") {
      expect(campaignErr.text).toMatch(/belum pernah bayar|tidak memenuhi/i);
    }

    const couponErr = await submitManualPromoCode("OLD", {
      getToken: async () => "tok",
      campaignCheckout: vi.fn(),
      redeem: async () => {
        throw new Error("409 already_redeemed");
      },
    });
    expect(couponErr).toEqual({
      kind: "error",
      text: "Kupon ini sudah pernah kamu pakai.",
    });
  });
});
