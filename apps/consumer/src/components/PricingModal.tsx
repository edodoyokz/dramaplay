import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

interface Plan {
  id: string;
  code: string;
  name: string;
  durationDays: number;
  priceIdr: number;
}

export default function PricingModal({ onClose }: { onClose: () => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api<{ items: Plan[] }>("/billing/plans")
      .then((r) => setPlans(r.items))
      .catch(() => setPlans([]));
  }, []);

  async function subscribe(code: string) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await api<{ checkoutUrl: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planCode: code }),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    window.location.href = res.checkoutUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-5 text-white">
        <h2 className="mb-3 text-lg font-bold">Pilih Paket VIP</h2>
        {plans.map((p) => (
          <button
            key={p.code}
            onClick={() => subscribe(p.code)}
            className="mb-2 w-full rounded-xl bg-yellow-500 p-3 text-left text-black"
          >
            <div className="font-bold">{p.name}</div>
            <div className="text-sm">Rp {p.priceIdr.toLocaleString("id-ID")}</div>
          </button>
        ))}
        <button onClick={onClose} className="mt-2 w-full text-sm text-slate-300">
          Tutup
        </button>
      </div>
    </div>
  );
}
