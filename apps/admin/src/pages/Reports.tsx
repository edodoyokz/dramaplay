import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Report {
  id: string;
  targetType: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function Reports() {
  const [rows, setRows] = useState<Report[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api<{ items: Report[] }>("/admin/reports")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  }, []);

  const getStatusBadge = (status: string) => {
    const norm = status.toLowerCase();
    if (norm === "pending" || norm === "open") {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wider">
          Open / Pending
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-500 border border-zinc-800 uppercase tracking-wider">
        Resolved
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
        <h1 className="text-xl font-extrabold text-white tracking-tight">Laporan Kendala (Reports)</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Laporan keluhan dari pengguna terkait pemutaran video, pembayaran gagal, atau isu konten lainnya.
        </p>
      </div>

      {busy ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
          <p className="text-xs">Memuat daftar laporan...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/10">
          <p className="text-xs text-zinc-500">Tidak ada laporan kendala aktif.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-zinc-900 rounded-2xl bg-zinc-950/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-4">Tipe Target</th>
                  <th className="px-5 py-4">Alasan / Detail Laporan</th>
                  <th className="px-5 py-4">Status Laporan</th>
                  <th className="px-5 py-4">Waktu Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-5 py-4 font-bold text-zinc-300 capitalize">{r.targetType}</td>
                    <td className="px-5 py-4 text-zinc-300 font-medium leading-relaxed max-w-xs">{r.reason}</td>
                    <td className="px-5 py-4">{getStatusBadge(r.status)}</td>
                    <td className="px-5 py-4 text-zinc-400 font-medium">{formatDate(r.createdAt)}</td>
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
