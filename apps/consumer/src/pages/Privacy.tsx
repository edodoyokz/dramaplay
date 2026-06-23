// TODO legal review before paid public launch.
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-5 pb-20">
      <Link to="/profile" className="text-sm text-zinc-400">
        ← Kembali
      </Link>
      <h1 className="mt-5 text-xl font-extrabold text-white">Kebijakan Privasi</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
        <p>
          Kami memproses email akun, status langganan, metadata pembayaran, dan aktivitas dasar
          aplikasi untuk menjalankan layanan.
        </p>
        <p>
          Pembayaran diproses oleh Pakasir. Dramaplay tidak menyimpan data kartu atau kredensial
          pembayaran pengguna.
        </p>
        <p>
          Data analytics digunakan untuk menjaga kualitas layanan dan dapat dihapus sesuai kebijakan
          retensi operasional.
        </p>
        <p>Untuk permintaan bantuan atau penghapusan data, hubungi support Dramaplay.</p>
      </div>
    </div>
  );
}
