const ATTRIBUTION_LIMIT = 100;

type Capacity = {
  readonly paid: number;
  readonly reserved: number;
  readonly capacity: number;
};

type AttributionInput = {
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly utmContent?: string;
};

export type CampaignAttribution = AttributionInput;

export type CampaignCheckoutBody = {
  readonly code: string;
  readonly attribution: CampaignAttribution;
};

type PublicCampaignInput = {
  readonly code: string;
  readonly amountIdr: number;
  readonly durationDays: number;
  readonly capacity: number;
  readonly isEnabled: boolean;
};

export function normalizeCampaignCode(code: string): string {
  return code.trim().toUpperCase();
}

export function campaignExpiry(now: Date, reservationHours: number): Date {
  return new Date(now.getTime() + reservationHours * 60 * 60 * 1000);
}

export function campaignAvailability(counts: Capacity): boolean {
  return counts.paid + counts.reserved < counts.capacity;
}

export function normalizeAttribution(input: AttributionInput): CampaignAttribution {
  return Object.fromEntries(
    Object.entries(input).flatMap(([key, value]) => {
      const normalized = value?.trim().slice(0, ATTRIBUTION_LIMIT);
      return normalized ? [[key, normalized]] : [];
    }),
  );
}

export function parseCampaignCheckoutBody(input: unknown): CampaignCheckoutBody | null {
  if (typeof input !== "object" || input === null) return null;
  const code = Reflect.get(input, "code");
  const rawAttribution = Reflect.get(input, "attribution");
  if (typeof code !== "string") return null;
  if (typeof rawAttribution !== "object" || rawAttribution === null) {
    return { code, attribution: {} };
  }
  const fields = ["utmSource", "utmMedium", "utmCampaign", "utmContent"] as const;
  const attribution = Object.fromEntries(
    fields.flatMap((field) => {
      const value = Reflect.get(rawAttribution, field);
      return typeof value === "string" ? [[field, value]] : [];
    }),
  );
  return { code, attribution: normalizeAttribution(attribution) };
}

type CheckoutErrorKind = "unavailable" | "ineligible" | "full";

export function campaignCheckoutError(kind: CheckoutErrorKind) {
  switch (kind) {
    case "unavailable":
      return { error: "campaign_unavailable", status: 404 } as const;
    case "ineligible":
      return { error: "not_eligible", status: 409 } as const;
    case "full":
      return { error: "campaign_full", status: 409 } as const;
  }
}

export function publicCampaignStatus(campaign: PublicCampaignInput, occupied: number) {
  const status =
    !campaign.isEnabled
      ? ("unavailable" as const)
      : occupied >= campaign.capacity
        ? ("full" as const)
        : ("available" as const);
  return {
    code: campaign.code,
    amountIdr: campaign.amountIdr,
    durationDays: campaign.durationDays,
    capacity: campaign.capacity,
    available: status === "available",
    status,
  };
}
