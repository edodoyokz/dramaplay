export const PAID_CAMPAIGN_CODES = ["FB15K"] as const;

export type PaidCampaignCode = (typeof PAID_CAMPAIGN_CODES)[number];

export type CampaignPublicStatus = "available" | "full" | "unavailable";

export type CampaignCheckoutErrorCode =
  | "not_eligible"
  | "campaign_full"
  | "campaign_unavailable"
  | "unknown";

export type CampaignAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
};

export type CampaignCheckoutBody = {
  code: string;
  attribution: CampaignAttribution;
};

export type ManualCodeAction =
  | { kind: "campaign_checkout"; code: PaidCampaignCode }
  | { kind: "redeem"; code: string };

export type CampaignOfferTerms = {
  amountIdr: number;
  durationDays: number;
  capacity: number;
};

export type ParsedPublicCampaign = {
  status: CampaignPublicStatus;
} & CampaignOfferTerms;

export const FB15K_OFFER = {
  code: "FB15K",
  amountIdr: 15_000,
  durationDays: 30,
  capacity: 500,
} as const;

const UTM_KEYS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_content", "utmContent"],
] as const;

export function normalizeCampaignCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isPaidCampaignCode(value: string): value is PaidCampaignCode {
  return (PAID_CAMPAIGN_CODES as readonly string[]).includes(normalizeCampaignCode(value));
}

export function parseCampaignAttribution(search: string): CampaignAttribution {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const attribution: CampaignAttribution = {};
  for (const [queryKey, field] of UTM_KEYS) {
    const raw = params.get(queryKey)?.trim();
    if (raw) attribution[field] = raw;
  }
  return attribution;
}

export function promoAuthReturnPath(code: string, search: string): string {
  const normalized = normalizeCampaignCode(code).toLowerCase();
  const path = `/promo/${normalized}`;
  const query = search.startsWith("?") ? search.slice(1) : search;
  return query ? `${path}?${query}` : path;
}

export function buildCampaignCheckoutBody(
  code: string,
  attribution: CampaignAttribution,
): CampaignCheckoutBody {
  return {
    code: normalizeCampaignCode(code),
    attribution: { ...attribution },
  };
}

export function formatOfferPrice(amountIdr: number): string {
  return `Rp${amountIdr.toLocaleString("id-ID")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function positiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function campaignPublicStatus(status: string | undefined): CampaignPublicStatus | null {
  if (status === "available" || status === "full" || status === "unavailable") return status;
  return null;
}

export function parsePublicCampaignResponse(input: unknown): ParsedPublicCampaign {
  const defaults: CampaignOfferTerms = {
    amountIdr: FB15K_OFFER.amountIdr,
    durationDays: FB15K_OFFER.durationDays,
    capacity: FB15K_OFFER.capacity,
  };
  if (!isRecord(input)) {
    return { status: "unavailable", ...defaults };
  }

  const amountIdr = positiveNumber(input.amountIdr) ?? defaults.amountIdr;
  const durationDays = positiveNumber(input.durationDays) ?? defaults.durationDays;
  const capacity = positiveNumber(input.capacity) ?? defaults.capacity;
  const terms = { amountIdr, durationDays, capacity };

  const explicit = campaignPublicStatus(
    typeof input.status === "string" ? input.status : undefined,
  );
  if (explicit) return { status: explicit, ...terms };

  if (input.available === true) return { status: "available", ...terms };
  if (input.available === false) return { status: "unavailable", ...terms };
  return { status: "unavailable", ...terms };
}

export function campaignStatusCopy(
  status: CampaignPublicStatus,
  terms: CampaignOfferTerms = {
    amountIdr: FB15K_OFFER.amountIdr,
    durationDays: FB15K_OFFER.durationDays,
    capacity: FB15K_OFFER.capacity,
  },
): string {
  switch (status) {
    case "available":
      return `${formatOfferPrice(terms.amountIdr)} untuk ${terms.durationDays} hari VIP. Kuota ${terms.capacity} pengguna baru. Bayar sekali, tanpa perpanjang otomatis.`;
    case "full":
      return "Kuota promo FB15K sudah penuh.";
    case "unavailable":
      return "Promo ini tidak tersedia saat ini.";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function campaignCheckoutErrorCopy(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized === "not_eligible" || normalized.includes("not_eligible")) {
    return "Promo hanya untuk akun yang belum pernah bayar.";
  }
  if (normalized === "campaign_full" || normalized.includes("campaign_full")) {
    return "Kuota promo sudah penuh.";
  }
  if (normalized === "campaign_unavailable" || normalized.includes("campaign_unavailable")) {
    return "Promo tidak tersedia.";
  }
  return "Checkout promo gagal. Silakan coba lagi.";
}

export function resolveManualCodeAction(value: string): ManualCodeAction {
  const trimmed = value.trim();
  if (isPaidCampaignCode(trimmed)) {
    return { kind: "campaign_checkout", code: normalizeCampaignCode(trimmed) as PaidCampaignCode };
  }
  return { kind: "redeem", code: trimmed };
}

export function freeCouponErrorCopy(message: string): string {
  if (message.includes("already_redeemed")) return "Kupon ini sudah pernah kamu pakai.";
  if (message.includes("coupon_exhausted")) return "Kuota kupon sudah habis.";
  if (message.includes("coupon_expired")) return "Kupon sudah kedaluwarsa.";
  return "Kupon tidak valid.";
}

export type ManualPromoSubmitResult =
  | { kind: "auth"; returnTo: string }
  | { kind: "redirect"; url: string }
  | { kind: "success"; text: string }
  | { kind: "error"; text: string };

export type ManualPromoSubmitDeps = {
  getToken: () => Promise<string | null>;
  campaignCheckout: (
    body: CampaignCheckoutBody,
    token: string,
  ) => Promise<{ checkoutUrl?: string }>;
  redeem: (
    code: string,
    token: string,
  ) => Promise<{ planName: string; durationDays: number }>;
  returnTo?: string;
};

export async function submitManualPromoCode(
  rawCode: string,
  deps: ManualPromoSubmitDeps,
): Promise<ManualPromoSubmitResult> {
  const value = rawCode.trim();
  if (!value) return { kind: "error", text: freeCouponErrorCopy("") };

  const token = await deps.getToken();
  if (!token) {
    return {
      kind: "auth",
      returnTo: deps.returnTo ?? "/",
    };
  }

  const action = resolveManualCodeAction(value);
  try {
    if (action.kind === "campaign_checkout") {
      const body = buildCampaignCheckoutBody(action.code, {});
      const res = await deps.campaignCheckout(body, token);
      if (res.checkoutUrl) return { kind: "redirect", url: res.checkoutUrl };
      return { kind: "error", text: campaignCheckoutErrorCopy("unknown") };
    }

    const res = await deps.redeem(action.code, token);
    return {
      kind: "success",
      text: `Kupon aktif! ${res.planName} (${res.durationDays} hari) telah ditambahkan.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (action.kind === "campaign_checkout") {
      return { kind: "error", text: campaignCheckoutErrorCopy(msg) };
    }
    return { kind: "error", text: freeCouponErrorCopy(msg) };
  }
}

export function isPricingModalCloseBlocked(
  loadingCode: string | null,
  couponBusy: boolean,
): boolean {
  return loadingCode !== null || couponBusy;
}

/** @deprecated use campaignPublicStatus / parsePublicCampaignResponse */
export function campaignPublicPath(status: string | undefined): CampaignPublicStatus {
  return campaignPublicStatus(status) ?? "unavailable";
}
