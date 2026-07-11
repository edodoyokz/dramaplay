import { Link } from "react-router-dom";
import { SeoHead } from "../lib/seo";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 flex flex-col items-center justify-center px-6 text-center">
      <SeoHead title="Halaman tidak ditemukan" noindex />
      <p className="text-4xl font-black text-rose-500">404</p>
      <h1 className="mt-2 text-lg font-extrabold text-white">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-xs text-zinc-400 max-w-xs leading-relaxed">
        Alamat yang kamu buka tidak ada. Kembali ke beranda atau cari drama lain.
      </p>
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2.5">
        <Link
          to="/"
          className="w-full rounded-full bg-gradient-sunset py-3 text-sm font-bold text-white"
        >
          Ke Beranda
        </Link>
        <Link
          to="/search"
          className="w-full rounded-full border border-zinc-800 bg-zinc-900 py-3 text-sm font-bold text-zinc-300"
        >
          Cari Drama
        </Link>
      </div>
    </div>
  );
}
