import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithEmail() {
    setBusy(true);
    try {
      await supabase.auth.signInWithPassword({ email, password });
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  }

  async function signUpWithEmail() {
    setBusy(true);
    try {
      await supabase.auth.signUp({ email, password });
      alert("Cek email untuk verifikasi (atau langsung masuk jika dikonfigurasi).");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-center text-2xl font-bold text-yellow-400">Dramaplay</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-3 rounded-xl bg-slate-800 p-3"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-3 rounded-xl bg-slate-800 p-3"
      />
      <button
        onClick={signInWithEmail}
        disabled={busy}
        className="mb-2 rounded-xl bg-yellow-500 p-3 font-semibold text-black"
      >
        Masuk
      </button>
      <button
        onClick={signUpWithEmail}
        disabled={busy}
        className="mb-4 rounded-xl bg-slate-800 p-3 text-sm"
      >
        Daftar
      </button>
      <button
        onClick={signInWithGoogle}
        className="rounded-xl border border-slate-700 p-3"
      >
        Masuk dengan Google
      </button>
    </div>
  );
}
