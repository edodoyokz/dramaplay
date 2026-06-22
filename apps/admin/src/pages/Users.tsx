import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
}

export default function Users() {
  const [rows, setRows] = useState<User[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    api<{ items: User[] }>("/admin/users")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]))
      .finally(() => setBusy(false));
  }, []);

  const getRoleBadge = (role: string) => {
    const norm = role.toLowerCase();
    if (norm === "admin" || norm === "super") {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-orange-400 border border-orange-500/20 uppercase tracking-wide">
          Admin
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase tracking-wide">
        User
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-tight">Daftar Pengguna (Users)</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Kelola database akun terdaftar, otorisasi peran, dan status pemblokiran pengguna.
        </p>
      </div>

      {busy ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
          <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
          <p className="text-xs">Memuat daftar pengguna...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/10">
          <p className="text-xs text-zinc-500">Tidak ada pengguna terdaftar.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-zinc-900 rounded-2xl bg-zinc-950/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/20 text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-5 py-4">Alamat Email</th>
                  <th className="px-5 py-4">Peran (Role)</th>
                  <th className="px-5 py-4">Status Akun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {rows.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-900/20 transition-colors">
                    <td className="px-5 py-4 font-bold text-zinc-200">{u.email}</td>
                    <td className="px-5 py-4">{getRoleBadge(u.role)}</td>
                    <td className="px-5 py-4">
                      {u.isBanned ? (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Banned
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
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
