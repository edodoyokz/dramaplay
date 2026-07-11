import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import {
  getFavorites,
  getLikes,
  getWatchProgress,
} from "../lib/local-engagement";
import PricingModal from "../components/PricingModal";

interface Payment {
  id: string;
  status: string;
  amountIdr: number;
  createdAt: string;
}

export default function Profile() {
  const [email, setEmail] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [userVip, setUserVip] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [favsCount, setFavsCount] = useState(0);
  const [watchedCount, setWatchedCount] = useState(0);
  const [showPricing, setShowPricing] = useState(false);

  const [activeTab, setActiveTab] = useState<"history" | "likes" | "favorites" | null>(null);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [likedItems, setLikedItems] = useState<string[]>([]);
  const [favoriteItems, setFavoriteItems] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? null;
      setEmail(userEmail);
      if (userEmail) {
        const likes = getLikes();
        setLikesCount(likes.length);
        setLikedItems(likes);

        const favs = getFavorites();
        setFavsCount(favs.length);
        setFavoriteItems(favs);

        const watched = getWatchProgress();
        setWatchedCount(watched.length);
        setHistoryItems(watched);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (!token) return;

      // Fetch VIP state
      api<{ user: { isVip: boolean } }>("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res?.user) {
            setUserVip(res.user.isVip);
          }
        })
        .catch(() => {});

      // Fetch payments
      api<{ items: Payment[] }>("/billing/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => setPayments(r.items))
        .catch(() => setPayments([]));
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    localStorage.removeItem("dramaplay:token"); // clear any stored token references
    window.location.href = "/";
  }

  const getStatusBadge = (status: string) => {
    const norm = status.toLowerCase();
    if (norm === "success" || norm === "settlement" || norm === "paid") {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
          Sukses
        </span>
      );
    }
    if (norm === "pending" || norm === "capture") {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
          Tertunda
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase tracking-wide">
        Gagal
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  if (!email) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center p-6 text-zinc-100">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 glow-sunset mb-4">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-white">Akun Dramaplay</h2>
        <p className="text-xs text-zinc-400 text-center mt-1.5 max-w-xs leading-relaxed">
          Silakan masuk atau daftarkan akun baru Anda untuk menikmati fitur simpan favorit, riwayat
          menonton, dan akses VIP.
        </p>
        <Link
          to="/auth"
          className="w-full max-w-xs mt-6 py-3 rounded-full bg-gradient-sunset text-white text-center font-bold text-sm tracking-wide shadow-lg shadow-rose-500/15 active:scale-95 duration-100"
        >
          Masuk / Daftar Akun
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-4 pb-12">
      {/* Page Title */}
      <h1 className="text-xl font-extrabold text-white tracking-tight mb-4 mt-2">Profil Saya</h1>

      {/* User Header Profile Card */}
      <div className="glass-card rounded-2xl p-5 mb-5 flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full bg-gradient-sunset flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-rose-500/10 mb-3 border-2 border-zinc-800">
          {email.slice(0, 2).toUpperCase()}
        </div>
        <h2 className="text-sm font-bold text-zinc-100">{email}</h2>

        {/* VIP Status */}
        {userVip ? (
          <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-gold text-zinc-950 font-extrabold text-[10px] uppercase tracking-wider glow-gold shadow-md">
            👑 Anggota VIP PRO
          </div>
        ) : (
          <div className="mt-3 w-full flex flex-col items-center">
            <span className="text-[10px] text-zinc-400 mb-2">Akses Terbatas (Anggota Gratis)</span>
            <button
              onClick={() => setShowPricing(true)}
              className="px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-sunset text-white shadow-md active:scale-95 duration-100"
            >
              Aktifkan VIP
            </button>
          </div>
        )}
      </div>

      {/* Local Statistics Grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        <button
          onClick={() => setActiveTab(activeTab === "history" ? null : "history")}
          className={`border rounded-xl p-3 flex flex-col items-center text-center transition-all ${
            activeTab === "history"
              ? "bg-rose-500/10 border-rose-500/30 scale-95"
              : "bg-zinc-900/60 border-zinc-900 hover:border-zinc-800"
          }`}
        >
          <span className="text-lg font-extrabold text-rose-500">{watchedCount}</span>
          <span className="text-[9px] font-semibold text-zinc-400 mt-0.5">Menonton</span>
        </button>
        <button
          onClick={() => setActiveTab(activeTab === "likes" ? null : "likes")}
          className={`border rounded-xl p-3 flex flex-col items-center text-center transition-all ${
            activeTab === "likes"
              ? "bg-rose-500/10 border-rose-500/30 scale-95"
              : "bg-zinc-900/60 border-zinc-900 hover:border-zinc-800"
          }`}
        >
          <span className="text-lg font-extrabold text-rose-500">{likesCount}</span>
          <span className="text-[9px] font-semibold text-zinc-400 mt-0.5">Disukai</span>
        </button>
        <button
          onClick={() => setActiveTab(activeTab === "favorites" ? null : "favorites")}
          className={`border rounded-xl p-3 flex flex-col items-center text-center transition-all ${
            activeTab === "favorites"
              ? "bg-rose-500/10 border-rose-500/30 scale-95"
              : "bg-zinc-900/60 border-zinc-900 hover:border-zinc-800"
          }`}
        >
          <span className="text-lg font-extrabold text-rose-500">{favsCount}</span>
          <span className="text-[9px] font-semibold text-zinc-400 mt-0.5">Favorit</span>
        </button>
      </div>

      {/* Active Tab Panel */}
      {activeTab && (
        <div className="mb-6 p-4 rounded-xl border border-zinc-900 bg-zinc-900/20 space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
              {activeTab === "history" && "Riwayat Menonton"}
              {activeTab === "likes" && "Episode Disukai"}
              {activeTab === "favorites" && "Drama Favorit"}
            </h4>
            <button
              onClick={() => setActiveTab(null)}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 font-medium"
            >
              Tutup
            </button>
          </div>

          {activeTab === "history" && (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {historyItems.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">Belum ada riwayat menonton.</p>
              ) : (
                historyItems.map((item, idx) => (
                  <Link
                    key={idx}
                    to={`/drama/${item.slug}/episode/${item.episodeNumber || 1}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors border border-zinc-900/40"
                  >
                    <img
                      src={item.posterUrl || "/placeholder.jpg"}
                      alt={item.title}
                      className="w-10 h-14 object-cover rounded-md bg-zinc-950 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold text-zinc-100 truncate">{item.title}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">Episode {item.episodeNumber}</p>
                      {item.percent !== undefined && (
                        <div className="mt-1.5 w-full bg-zinc-800 rounded-full h-1">
                          <div className="bg-rose-500 h-1 rounded-full" style={{ width: `${item.percent}%` }}></div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}

          {activeTab === "likes" && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {likedItems.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">Belum ada episode yang disukai.</p>
              ) : (
                likedItems.map((key, idx) => {
                  const parts = key.split("-");
                  const slug = parts.slice(0, -1).join("-");
                  const episode = parts[parts.length - 1];
                  const prettyName = slug
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <Link
                      key={idx}
                      to={`/drama/${slug}/episode/${episode}`}
                      className="block p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors border border-zinc-900/40 text-xs font-medium text-zinc-200 text-left"
                    >
                      <span className="text-rose-500 font-bold mr-1">♥</span> {prettyName} — Episode {episode}
                    </Link>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "favorites" && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {favoriteItems.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">Belum ada drama favorit.</p>
              ) : (
                favoriteItems.map((slug, idx) => {
                  const prettyName = slug
                    .replace(/-/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <Link
                      key={idx}
                      to={`/drama/${slug}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors border border-zinc-900/40 text-xs font-medium text-zinc-200 text-left"
                    >
                      <span className="truncate">{prettyName}</span>
                      <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex-shrink-0 ml-2">Lihat Detail</span>
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Transaction History Section */}
      <div className="mt-6">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
          Riwayat Pembayaran
        </h3>

        {payments.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-zinc-900 rounded-2xl bg-zinc-900/10">
            <p className="text-xs text-zinc-500">Belum ada riwayat transaksi.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="bg-zinc-900/60 border border-zinc-900 rounded-xl p-3.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-zinc-200">
                    Rp {p.amountIdr.toLocaleString("id-ID")}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{formatDate(p.createdAt)}</p>
                </div>

                {getStatusBadge(p.status)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-center gap-4 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        <Link to="/terms" className="hover:text-zinc-300">
          Ketentuan
        </Link>
        <Link to="/privacy" className="hover:text-zinc-300">
          Privasi
        </Link>
        <Link to="/refund" className="hover:text-zinc-300">
          Refund
        </Link>
      </div>

      {/* Log Out button */}
      <div className="mt-8">
        <button
          onClick={signOut}
          className="w-full py-3 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/30 text-xs font-bold transition-all duration-200"
        >
          Keluar dari Akun
        </button>
      </div>

      {/* Render pricing modal inside page */}
      {showPricing && <PricingModal onClose={() => setShowPricing(false)} />}
    </div>
  );
}
