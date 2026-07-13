import { useState } from "react";
import { api } from "../lib/api";
import { submitManualPromoCode } from "../lib/paid-campaign";
import { getAuthToken, supabase } from "../lib/supabase";

type Feedback = { ok: boolean; text: string };

export default function CouponCodeEntry({
  disabled,
  onBusyChange,
}: {
  disabled: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [coupon, setCoupon] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function onSubmit() {
    const value = coupon.trim();
    if (!value || redeeming || disabled) return;
    setFeedback(null);
    setRedeeming(true);
    onBusyChange?.(true);
    try {
      const result = await submitManualPromoCode(value, {
        returnTo: window.location.pathname + window.location.search,
        getToken: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? getAuthToken();
        },
        campaignCheckout: (body, token) =>
          api<{ checkoutUrl: string }>("/billing/campaign-checkout", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { Authorization: `Bearer ${token}` },
          }),
        redeem: (code, token) =>
          api<{ planName: string; durationDays: number }>("/billing/redeem", {
            method: "POST",
            body: JSON.stringify({ code }),
            headers: { Authorization: `Bearer ${token}` },
          }),
      });

      switch (result.kind) {
        case "auth":
          window.location.assign(`/auth?returnTo=${encodeURIComponent(result.returnTo)}`);
          return;
        case "redirect":
          window.location.assign(result.url);
          return;
        case "success":
          setFeedback({ ok: true, text: result.text });
          setTimeout(() => window.location.reload(), 1500);
          return;
        case "error":
          setFeedback({ ok: false, text: result.text });
          return;
        default: {
          const _exhaustive: never = result;
          return _exhaustive;
        }
      }
    } finally {
      setRedeeming(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="mt-5 pt-5 border-t border-zinc-900">
      <label
        htmlFor="coupon-code"
        className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2 block"
      >
        Punya kode kupon?
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          placeholder="Masukkan kode kupon"
          autoCapitalize="characters"
          className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none uppercase"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={redeeming || !coupon.trim() || disabled}
          className="rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-extrabold text-zinc-950 disabled:opacity-40 active:scale-95 duration-100"
        >
          {redeeming ? "..." : "Tukar"}
        </button>
      </div>
      {feedback ? (
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 text-[11px] font-semibold ${feedback.ok ? "text-emerald-400" : "text-rose-400"}`}
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
