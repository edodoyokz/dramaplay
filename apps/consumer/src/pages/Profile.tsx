import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";

interface Payment {
  id: string;
  status: string;
  amountIdr: number;
  createdAt: string;
}

export default function Profile() {
  const [email, setEmail] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;
      api<{ items: Payment[] }>("/billing/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => setPayments(r.items))
        .catch(() => setPayments([]));
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (!email) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <p>Belum masuk.</p>
        <Link to="/auth" className="rounded-xl bg-yellow-500 px-4 py-2 font-semibold text-black">
          Masuk / Daftar
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-4 text-2xl font-bold">Akun</h1>
      <p className="text-slate-300">{email}</p>

      <h2 className="mb-3 mt-6 text-lg font-semibold">Riwayat Pembayaran</h2>
      {payments.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada transaksi.</p>
      ) : (
        <ul className="space-y-2">
          {payments.map((p) => (
            <li key={p.id} className="rounded-xl bg-slate-800 p-3 text-sm">
              Rp {p.amountIdr.toLocaleString("id-ID")} — {p.status}
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={signOut}
        className="mt-8 w-full rounded-xl border border-slate-700 p-3 text-sm"
      >
        Keluar
      </button>
    </div>
  );
}
