import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Provider {
  id: string;
  code: string;
  name: string;
  isEnabled: boolean;
  lastSyncStatus: string | null;
}

export default function Providers() {
  const [rows, setRows] = useState<Provider[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api<{ items: Provider[] }>("/admin/providers")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  }, []);

  async function toggle(id: string) {
    await api(`/admin/providers/${id}/toggle`, { method: "POST" });
    setRows((r) =>
      r.map((p) => (p.id === id ? { ...p, isEnabled: !p.isEnabled } : p))
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-tight">Penyedia Konten (Providers)</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Daftar penyedia data drama eksternal yang diintegrasikan ke dalam katalog utama.
        </p>
      </div>

      {busy ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
          <p className="text-xs">Memuat daftar provider...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/10">
          <p className="text-xs text-zinc-500">Tidak ada provider terdaftar.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-zinc-900 rounded-2xl bg-zinc-950/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-4">Kode</th>
                  <th className="px-5 py-4">Nama Provider</th>
                  <th className="px-5 py-4">Status Sinkronisasi</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-zinc-300">{p.code}</td>
                    <td className="px-5 py-4 font-semibold text-zinc-200">{p.name}</td>
                    <td className="px-5 py-4 text-zinc-400">
                      {p.lastSyncStatus ? (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          p.lastSyncStatus.toLowerCase().includes("fail") || p.lastSyncStatus.toLowerCase().includes("err")
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {p.lastSyncStatus}
                        </span>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {p.isEnabled ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Aktif
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-800 text-zinc-500 border border-zinc-800">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => toggle(p.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                          p.isEnabled
                            ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                            : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                        }`}
                      >
                        {p.isEnabled ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </td>
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
