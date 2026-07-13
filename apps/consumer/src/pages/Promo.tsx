import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  FB15K_OFFER,
  buildCampaignCheckoutBody,
  campaignCheckoutErrorCopy,
  campaignStatusCopy,
  formatOfferPrice,
  isPaidCampaignCode,
  normalizeCampaignCode,
  parseCampaignAttribution,
  parsePublicCampaignResponse,
  promoAuthReturnPath,
  type CampaignOfferTerms,
  type CampaignPublicStatus,
  type ParsedPublicCampaign,
} from "../lib/paid-campaign";
import { SeoHead } from "../lib/seo";
import { getAuthToken, supabase } from "../lib/supabase";

type ViewState =
  | { phase: "loading" }
  | { phase: "ready"; campaign: ParsedPublicCampaign }
  | { phase: "error"; campaign: ParsedPublicCampaign };

const FALLBACK_TERMS: CampaignOfferTerms = {
  amountIdr: FB15K_OFFER.amountIdr,
  durationDays: FB15K_OFFER.durationDays,
  capacity: FB15K_OFFER.capacity,
};

function initialView(known: boolean): ViewState {
  if (!known) {
    return {
      phase: "ready",
      campaign: { status: "unavailable", ...FALLBACK_TERMS },
    };
  }
  return { phase: "loading" };
}

export default function Promo() {
  const { code = "" } = useParams();
  const [searchParams] = useSearchParams();
  const search = searchParams.toString();
  const attribution = useMemo(() => parseCampaignAttribution(search), [search]);
  const normalized = normalizeCampaignCode(code);
  const known = isPaidCampaignCode(code);

  const [view, setView] = useState<ViewState>(() => initialView(known));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!known) return;

    let cancelled = false;
    setError("");

    api<unknown>(`/billing/campaigns/${encodeURIComponent(normalized)}`)
      .then((res) => {
        if (cancelled) return;
        setView({ phase: "ready", campaign: parsePublicCampaignResponse(res) });
      })
      .catch(() => {
        if (cancelled) return;
        setView({
          phase: "error",
          campaign: { status: "unavailable", ...FALLBACK_TERMS },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [known, normalized]);

  const campaign: ParsedPublicCampaign =
    view.phase === "loading"
      ? { status: "unavailable", ...FALLBACK_TERMS }
      : view.campaign;
  const status: CampaignPublicStatus | "loading" =
    view.phase === "loading" ? "loading" : campaign.status;
  const terms: CampaignOfferTerms = {
    amountIdr: campaign.amountIdr,
    durationDays: campaign.durationDays,
    capacity: campaign.capacity,
  };

  async function startCheckout() {
    if (!known || status !== "available" || busy) return;
    setError("");
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? getAuthToken();
      if (!token) {
        const returnTo = promoAuthReturnPath(normalized, search);
        window.location.assign(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      const body = buildCampaignCheckoutBody(normalized, attribution);
      const res = await api<{ checkoutUrl: string }>("/billing/campaign-checkout", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res?.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      setError(campaignCheckoutErrorCopy("unknown"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(campaignCheckoutErrorCopy(msg));
    } finally {
      setBusy(false);
    }
  }

  const ctaDisabled = busy || status !== "available";
  const statusText =
    status === "loading" ? "Memuat promo..." : campaignStatusCopy(status, terms);

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-5 pb-20 relative overflow-hidden">
      <SeoHead
        title="Promo FB15K"
        description={`${formatOfferPrice(terms.amountIdr)} VIP ${terms.durationDays} hari untuk ${terms.capacity} pengguna baru.`}
      />
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      <Link to="/" className="relative z-10 text-sm text-zinc-400 hover:text-zinc-200">
        ← Kembali
      </Link>

      <div className="relative z-10 mt-8 max-w-sm mx-auto text-center">
        <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
          Promo Facebook
        </span>
        <h1 className="mt-3 text-2xl font-extrabold text-gradient-gold">
          VIP {terms.durationDays} Hari
        </h1>
        <p className="mt-2 text-3xl font-black text-amber-400">
          {formatOfferPrice(terms.amountIdr)}
        </p>
        <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
          Bayar sekali, aktif {terms.durationDays} hari. Tidak diperpanjang otomatis. Khusus
          akun yang belum pernah bayar. Kuota {terms.capacity} pengguna.
        </p>
      </div>

      <div className="relative z-10 mt-8 max-w-sm mx-auto space-y-3 rounded-2xl bg-zinc-900/50 border border-zinc-900 p-4">
        <Benefit text={`VIP ${terms.durationDays} hari setelah pembayaran berhasil`} />
        <Benefit text="Hanya untuk pengguna yang belum pernah bayar" />
        <Benefit text="Sekali klaim per akun, tanpa perpanjang otomatis" />
        <Benefit text={`Kuota terbatas: ${terms.capacity} pengguna`} />
      </div>

      <div className="relative z-10 mt-6 max-w-sm mx-auto">
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-zinc-300 font-medium leading-relaxed text-center"
        >
          {statusText}
        </p>

        {error ? (
          <p
            role="alert"
            aria-live="polite"
            className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/25 px-4 py-3 text-xs font-medium text-rose-400"
          >
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={startCheckout}
          disabled={ctaDisabled}
          className="mt-5 w-full rounded-xl bg-gradient-sunset py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-rose-500/15 disabled:opacity-40 active:scale-98"
        >
          {busy ? "Memproses..." : status === "available" ? "Klaim Promo" : "Promo Tidak Tersedia"}
        </button>
        <p className="mt-3 text-center text-[10px] text-zinc-600">
          Kode: {known ? normalized : code || "—"}
        </p>
      </div>
    </div>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-left">
      <span className="text-amber-400 text-sm shrink-0" aria-hidden="true">
        ✓
      </span>
      <span className="text-xs text-zinc-300 font-medium leading-normal">{text}</span>
    </div>
  );
}
