import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Payment {
  id: string;
  userId: string;
  amountIdr: number;
  status: string;
  createdAt: string;
}

export default function Payments() {
  const [rows, setRows] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api<{ items: Payment[] }>("/admin/payments")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  }, []);

  const getStatusBadge = (status: string) => {
    const norm = status.toLowerCase();
    if (norm === "success" || norm === "settlement" || norm === "paid") {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
          Success
        </span>
      );
    }
    if (norm === "pending" || norm === "capture") {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
          Pending
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">
        Failed
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-tight">Riwayat Pembayaran (Payments)</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Daftar semua pembayaran langganan VIP pengguna dari payment gateway.
        </p>
      </div>

      {busy ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
          <p className="text-xs">Memuat riwayat pembayaran...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/10">
          <p className="text-xs text-zinc-500">Belum ada riwayat pembayaran.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-zinc-900 rounded-2xl bg-zinc-950/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-4">ID Pengguna (User ID)</th>
                  <th className="px-5 py-4">Jumlah Transaksi</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Tanggal Pembayaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-5 py-4 font-mono text-[10px] text-zinc-400">{p.userId}</td>
                    <td className="px-5 py-4 font-bold text-zinc-200">
                      Rp {p.amountIdr.toLocaleString("id-ID")}
                    </td>
                    <td className="px-5 py-4">{getStatusBadge(p.status)}</td>
                    <td className="px-5 py-4 text-zinc-400 font-medium">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
