import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { supabase, getAuthToken } from "../lib/supabase";

interface Plan {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  priceIdr: number;
}

export default function PricingModal({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingCode, setLoadingCode] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api<{ items: Plan[] }>("/billing/plans")
      .then((r) => setPlans(r.items))
      .catch(() => setPlans([]));
  }, []);

  async function subscribe(code: string) {
    try {
      setLoadingCode(code);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? getAuthToken();
      if (!token) {
        alert("Silakan login terlebih dahulu untuk melanjutkan pembayaran.");
        onClose();
        window.location.assign("/auth");
        return;
      }

      const res = await api<{ checkoutUrl: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planCode: code }),
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res?.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
      }
    } catch (e) {
      console.error("Checkout failed", e);
      alert("Terjadi kesalahan. Silakan coba masuk kembali terlebih dahulu.");
    } finally {
      setLoadingCode(null);
    }
  }

  async function redeemCoupon() {
    const value = coupon.trim();
    if (!value) return;
    setCouponMsg(null);
    setRedeeming(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? getAuthToken();
      if (!token) {
        alert("Silakan login terlebih dahulu untuk menukar kupon.");
        onClose();
        window.location.assign("/auth");
        return;
      }
      const res = await api<{ planName: string; durationDays: number }>("/billing/redeem", {
        method: "POST",
        body: JSON.stringify({ code: value }),
        headers: { Authorization: `Bearer ${token}` },
      });
      setCouponMsg({
        ok: true,
        text: `Kupon aktif! ${res.planName} (${res.durationDays} hari) telah ditambahkan.`,
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const text = msg.includes("already_redeemed")
        ? "Kupon ini sudah pernah kamu pakai."
        : msg.includes("coupon_exhausted")
          ? "Kuota kupon sudah habis."
          : msg.includes("coupon_expired")
            ? "Kupon sudah kedaluwarsa."
            : "Kupon tidak valid.";
      setCouponMsg({ ok: false, text });
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm animate-fadeIn">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Bottom Drawer Sheet */}
      <div className="relative w-full max-w-md rounded-t-[32px] bg-zinc-950/95 border-t border-zinc-900 px-6 py-6 pb-10 text-white shadow-2xl flex flex-col z-10 transition-transform duration-300">
        {/* Drawer Handle */}
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-5" onClick={onClose} />

        <div className="text-center mb-6">
          <span className="px-2.5 py-1 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
            💎 Akses Premium
          </span>
          <h2 className="text-xl font-extrabold mt-2 text-gradient-gold">Aktifkan VIP Premium</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Dapatkan pengalaman terbaik menonton vertical short drama tanpa batas.
          </p>
        </div>

        {/* Benefits Checklist */}
        <div className="space-y-3 mb-6 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-900">
          <BenefitItem text="Tonton semua episode VIP tanpa terkunci" icon="🔓" />
          <BenefitItem text="Bebas iklan pengganggu & buffering lambat" icon="🚫" />
          <BenefitItem text="Streaming dengan kualitas Full HD jernih" icon="🚀" />
          <BenefitItem text="Subtitle lengkap Bahasa Indonesia terakurat" icon="🇮🇩" />
        </div>

        {/* Plan Cards */}
        <div className="space-y-3">
          {plans.map((p) => {
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
                disabled={loadingCode !== null}
                onClick={() => subscribe(p.code)}
                className={`relative w-full rounded-2xl p-4 text-left transition-all flex items-center justify-between border ${highlight}`}
              >
                <span
                  className={`absolute -top-2.5 right-4 px-2 py-0.5 rounded-full text-[8px] font-extrabold border uppercase tracking-wider ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <div>
                  <h4 className="font-extrabold text-sm text-zinc-100 flex items-center gap-1.5">
                    {p.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Durasi Aktif: {p.durationDays} Hari
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <p className="font-extrabold text-sm text-amber-400">
                    Rp {p.priceIdr.toLocaleString("id-ID")}
                  </p>
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-amber-400/20 border-t-amber-400 rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      className="w-4 h-4 text-zinc-400 group-hover:text-amber-400"
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
          })}
        </div>

        {/* Coupon redeem */}
        <div className="mt-5 pt-5 border-t border-zinc-900">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">
            Punya kode kupon?
          </p>
          <div className="flex gap-2">
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              placeholder="Masukkan kode kupon"
              autoCapitalize="characters"
              className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none uppercase"
            />
            <button
              onClick={redeemCoupon}
              disabled={redeeming || !coupon.trim()}
              className="rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-extrabold text-zinc-950 disabled:opacity-40 active:scale-95 duration-100"
            >
              {redeeming ? "..." : "Tukar"}
            </button>
          </div>
          {couponMsg ? (
            <p
              className={`mt-2 text-[11px] font-semibold ${couponMsg.ok ? "text-emerald-400" : "text-rose-400"}`}
            >
              {couponMsg.text}
            </p>
          ) : null}
        </div>

        <button
          onClick={onClose}
          disabled={loadingCode !== null}
          className="mt-6 w-full text-center text-xs font-semibold text-zinc-500 hover:text-zinc-300 py-1"
        >
          Kembali ke Drama
        </button>
      </div>
    </div>
  );
}

function BenefitItem({ text, icon }: { text: string; icon: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-sm shrink-0 mt-0.5">{icon}</span>
      <span className="text-xs text-zinc-300 font-medium leading-normal">{text}</span>
    </div>
  );
}
