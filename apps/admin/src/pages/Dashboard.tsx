import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Drama {
  id: string;
  isPublished: boolean;
}

interface Payment {
  id: string;
  amountIdr: number;
  status: string;
  createdAt: string;
}

interface User {
  id: string;
  isBanned: boolean;
}

interface Provider {
  id: string;
  isEnabled: boolean;
  lastSyncStatus: string | null;
}

interface Report {
  id: string;
  targetType: string;
  reason: string;
  status: string;
}

export default function Dashboard() {
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api<{ items: Drama[] }>("/admin/dramas").catch(() => ({ items: [] })),
      api<{ items: Payment[] }>("/admin/payments").catch(() => ({ items: [] })),
      api<{ items: User[] }>("/admin/users").catch(() => ({ items: [] })),
      api<{ items: Provider[] }>("/admin/providers").catch(() => ({ items: [] })),
      api<{ items: Report[] }>("/admin/reports").catch(() => ({ items: [] })),
    ])
      .then(([d, p, u, pr, r]) => {
        setDramas(d.items);
        setPayments(p.items);
        setUsers(u.items);
        setProviders(pr.items);
        setReports(r.items);
      })
      .finally(() => setLoading(false));
  }, []);

  // Calculations
  const totalRevenue = payments
    .filter((p) => p.status.toLowerCase() === "success" || p.status.toLowerCase() === "settlement" || p.status.toLowerCase() === "paid")
    .reduce((acc, curr) => acc + curr.amountIdr, 0);

  const activeProvidersCount = providers.filter((p) => p.isEnabled).length;
  const activeDramasCount = dramas.filter((d) => d.isPublished).length;
  const pendingReportsCount = reports.filter((r) => r.status.toLowerCase() === "pending" || r.status.toLowerCase() === "open").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-500">
        <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-3"></div>
        <p className="text-xs tracking-wider">Memuat metrik dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-xl font-extrabold text-white tracking-tight">Dashboard Ringkasan</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Selamat datang kembali di panel administrasi Dramaplay. Berikut adalah performa platform hari ini.
        </p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Pendapatan</p>
          <p className="text-lg font-extrabold text-emerald-400 mt-2">
            Rp {totalRevenue.toLocaleString("id-ID")}
          </p>
          <div className="mt-2.5 flex items-center gap-1 text-[9px] text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Dari transaksi sukses</span>
          </div>
        </div>

        {/* Users Card */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Pengguna</p>
          <p className="text-lg font-extrabold text-white mt-2">
            {users.length} <span className="text-xs text-zinc-500 font-normal">Registered</span>
          </p>
          <div className="mt-2.5 flex items-center gap-1 text-[9px] text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Platform scale</span>
          </div>
        </div>

        {/* Dramas Card */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Drama</p>
          <p className="text-lg font-extrabold text-white mt-2">
            {activeDramasCount} <span className="text-xs text-zinc-500 font-normal">/ {dramas.length} Rilis</span>
          </p>
          <div className="mt-2.5 flex items-center gap-1 text-[9px] text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            <span>Short vertical dramas</span>
          </div>
        </div>

        {/* Providers Card */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Kesehatan Sync</p>
          <p className="text-lg font-extrabold text-white mt-2">
            {activeProvidersCount} <span className="text-xs text-zinc-500 font-normal">/ {providers.length} Aktif</span>
          </p>
          <div className="mt-2.5 flex items-center gap-1 text-[9px] text-zinc-400">
            <span className={`w-1.5 h-1.5 rounded-full ${pendingReportsCount > 0 ? "bg-rose-500" : "bg-emerald-500"}`}></span>
            <span>{pendingReportsCount} Laporan aktif</span>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Recent Transactions */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
          <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-4">Transaksi Terakhir</h3>
          {payments.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Belum ada transaksi terekam.</p>
          ) : (
            <div className="space-y-3.5">
              {payments.slice(0, 4).map((p) => {
                const statusNorm = p.status.toLowerCase();
                const isPaid = statusNorm === "success" || statusNorm === "settlement" || statusNorm === "paid";
                return (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b border-zinc-900 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-zinc-300">Rp {p.amountIdr.toLocaleString("id-ID")}</p>
                      <p className="text-[9px] text-zinc-500 mt-0.5">{new Date(p.createdAt).toLocaleDateString("id-ID")}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                      isPaid 
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* System Reports */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5">
          <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider mb-4">Laporan Terbaru</h3>
          {reports.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Belum ada laporan dari pengguna.</p>
          ) : (
            <div className="space-y-3.5">
              {reports.slice(0, 4).map((r) => {
                const isPending = r.status.toLowerCase() === "pending" || r.status.toLowerCase() === "open";
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs border-b border-zinc-900 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-bold text-zinc-300 capitalize">{r.targetType}</p>
                      <p className="text-[10px] text-zinc-500 truncate max-w-xs mt-0.5">{r.reason}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${
                      isPending 
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                        : "bg-zinc-800 text-zinc-500 border-zinc-800"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
