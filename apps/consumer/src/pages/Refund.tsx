// TODO legal review before paid public launch.
import { Link } from "react-router-dom";

export default function Refund() {
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-5 pb-20">
      <Link to="/profile" className="text-sm text-zinc-400">
        ← Kembali
      </Link>
      <h1 className="mt-5 text-xl font-extrabold text-white">Refund & Bantuan Pembayaran</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
        <p>
          Jika pembayaran berhasil tetapi VIP belum aktif, kirim bukti pembayaran dan email akun ke
          support Dramaplay.
        </p>
        <p>
          Permintaan refund ditinjau berdasarkan status transaksi, durasi sejak pembelian, dan
          penggunaan akses VIP.
        </p>
        <p>
          Konten provider dapat berubah sewaktu-waktu. Kami akan membantu jika episode tidak dapat
          diputar setelah pembelian.
        </p>
      </div>
    </div>
  );
}
