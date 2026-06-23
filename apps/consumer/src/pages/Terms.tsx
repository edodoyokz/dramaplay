// TODO legal review before paid public launch.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <LegalPage title="Ketentuan Layanan">
      <p>Dramaplay menyediakan akses streaming short drama untuk pengguna Indonesia.</p>
      <p>
        VIP memberi akses ke episode bertanda VIP selama durasi paket yang dibeli. Akses dapat
        berubah jika konten provider tidak tersedia.
      </p>
      <p>
        Dilarang membagikan akun, menyalin, mengunduh ulang, atau mendistribusikan konten tanpa
        izin.
      </p>
      <p>Butuh bantuan? Hubungi support Dramaplay melalui kanal resmi yang tersedia di aplikasi.</p>
    </LegalPage>
  );
}

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-5 pb-20">
      <Link to="/profile" className="text-sm text-zinc-400">
        ← Kembali
      </Link>
      <h1 className="mt-5 text-xl font-extrabold text-white">{title}</h1>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </div>
  );
}
