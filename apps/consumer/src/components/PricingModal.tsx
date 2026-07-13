import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { isPricingModalCloseBlocked } from "../lib/paid-campaign";
import { getAuthToken, supabase } from "../lib/supabase";
import CouponCodeEntry from "./CouponCodeEntry";

interface Plan {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  priceIdr: number;
}

export default function PricingModal({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const loadingCodeRef = useRef(loadingCode);
  const couponBusyRef = useRef(couponBusy);
  loadingCodeRef.current = loadingCode;
  couponBusyRef.current = couponBusy;

  function loadPlans() {
    setPlansLoading(true);
    setPlansError(false);
    api<{ items: Plan[] }>("/billing/plans")
      .then((r) => {
        setPlans(r.items);
        setPlansError(false);
      })
      .catch(() => {
        setPlans([]);
        setPlansError(true);
      })
      .finally(() => setPlansLoading(false));
  }

  useEffect(() => {
    loadPlans();
    const el = dialogRef.current;
    if (!el) return;
    if (!el.open) el.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      if (isPricingModalCloseBlocked(loadingCodeRef.current, couponBusyRef.current)) return;
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe(code: string) {
    try {
      setLoadingCode(code);
      setFeedback(null);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? getAuthToken();
      if (!token) {
        const returnTo = window.location.pathname + window.location.search;
        window.location.assign(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }

      const res = await api<{ checkoutUrl: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode: code }),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res?.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      setFeedback({ ok: false, text: "Checkout gagal. Silakan coba lagi." });
    } catch {
      setFeedback({ ok: false, text: "Checkout gagal. Silakan coba masuk kembali." });
    } finally {
      setLoadingCode(null);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (isPricingModalCloseBlocked(loadingCode, couponBusy)) return;
    if (e.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby="pricing-title"
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-end justify-center border-0 bg-black/75 p-0 text-white backdrop:bg-black/75 open:flex"
    >
      <div className="relative w-full max-w-md rounded-t-[32px] bg-zinc-950/95 border-t border-zinc-900 px-6 py-6 pb-10 text-white shadow-2xl flex flex-col">
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-5" aria-hidden="true" />

        <div className="text-center mb-6">
          <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
            💎 Akses Premium
          </span>
          <h2 id="pricing-title" className="text-xl font-extrabold mt-2 text-gradient-gold">
            Aktifkan VIP Premium
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Buka episode VIP selama masa aktif paket. Pembayaran sekali, tidak diperpanjang otomatis.
          </p>
        </div>

        <div className="space-y-3 mb-6 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-900">
          <BenefitItem text="Buka semua episode VIP selama masa aktif" icon="🔓" />
          <BenefitItem text="Pembayaran satu kali, tidak diperpanjang otomatis" icon="💳" />
          <BenefitItem text="Perpanjang kapan saja dengan membeli paket lagi" icon="🔁" />
        </div>

        <div className="space-y-3">
          {plansLoading ? (
            <p className="py-6 text-center text-xs text-zinc-500">Memuat paket...</p>
          ) : null}
          {plansError ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-center text-sm text-zinc-300">
              <p>Paket gagal dimuat.</p>
              <button
                type="button"
                onClick={loadPlans}
                className="mt-3 rounded-full bg-rose-500 px-4 py-2 text-xs font-bold text-white"
              >
                Coba Lagi
              </button>
            </div>
          ) : null}
          {!plansLoading && !plansError && plans.length === 0 ? (
            <p className="py-4 text-center text-xs text-zinc-500">Belum ada paket tersedia.</p>
          ) : null}
          {!plansLoading && !plansError
            ? plans.map((p) => {
                const isLoading = loadingCode === p.code;
                const badge =
                  p.durationDays <= 1
                    ? { label: "Coba Dulu", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" }
                    : p.durationDays <= 7
                      ? { label: "Populer", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" }
                      : {
                          label: "Paling Hemat",
                          cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                        };
                const highlight =
                  p.durationDays <= 7
                    ? "bg-zinc-900 border-amber-500/40 hover:border-amber-400 hover:bg-zinc-900/90"
                    : "bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900";
                return (
                  <button
                    key={p.code}
                    type="button"
                    disabled={loadingCode !== null || plansLoading}
                    onClick={() => subscribe(p.code)}
                    className={`relative w-full rounded-2xl p-4 text-left transition-all flex items-center justify-between border ${highlight} disabled:opacity-60`}
                  >
                    <span
                      className={`absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[8px] font-extrabold border uppercase tracking-wider ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-sm text-zinc-100">{p.name}</h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Bayar sekali • aktif {p.durationDays} hari
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="font-extrabold text-sm text-amber-400">
                        Rp {p.priceIdr.toLocaleString("id-ID")}
                      </p>
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin" />
                      ) : (
                        <svg
                          className="w-4 h-4 text-zinc-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            : null}
        </div>

        <CouponCodeEntry disabled={loadingCode !== null} onBusyChange={setCouponBusy} />

        {feedback ? (
          <p
            role="status"
            aria-live="polite"
            className={`mt-2 text-[11px] font-semibold ${feedback.ok ? "text-emerald-400" : "text-rose-400"}`}
          >
            {feedback.text}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          disabled={isPricingModalCloseBlocked(loadingCode, couponBusy)}
          aria-label="Tutup paket VIP"
          className="mt-6 w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-300 py-2 disabled:opacity-40"
        >
          Kembali ke Drama
        </button>
      </div>
    </dialog>
  );
}

function BenefitItem({ text, icon }: { text: string; icon: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-sm shrink-0 mt-0.5" aria-hidden="true">
        {icon}
      </span>
      <span className="text-xs text-zinc-300 font-medium leading-normal">{text}</span>
    </div>
  );
}
