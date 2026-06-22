import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Drama {
  id: string;
  slug: string;
  title: string;
  country: string | null;
  year: number | null;
  isPublished: boolean;
}

export default function Dramas() {
  const [rows, setRows] = useState<Drama[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api<{ items: Drama[] }>("/admin/dramas")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-tight">Katalog Drama (Dramas)</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Manajemen rilis judul video short-drama, edit visibilitas, dan status publikasi.
        </p>
      </div>

      {busy ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
          <p className="text-xs">Memuat katalog drama...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/10">
          <p className="text-xs text-zinc-500">Katalog drama kosong.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-zinc-900 rounded-2xl bg-zinc-950/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-4">Judul Drama</th>
                  <th className="px-5 py-4">Slug</th>
                  <th className="px-5 py-4">Negara</th>
                  <th className="px-5 py-4">Tahun</th>
                  <th className="px-5 py-4">Status Rilis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {rows.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-5 py-4 font-bold text-zinc-200">{d.title}</td>
                    <td className="px-5 py-4 font-mono text-[10px] text-zinc-500">{d.slug}</td>
                    <td className="px-5 py-4 text-zinc-300">
                      {d.country ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 uppercase">
                          {d.country}
                        </span>
                      ) : (
                        <span className="text-zinc-650">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold text-zinc-300">{d.year ?? "-"}</td>
                    <td className="px-5 py-4">
                      {d.isPublished ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Hidden
                        </span>
                      )}
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
