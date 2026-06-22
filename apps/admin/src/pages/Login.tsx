import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, setSession } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (err) {
        setError(err.message);
        return;
      }
      if (data.session?.access_token) {
        setSession(data.session.access_token);
        navigate("/", { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal masuk ke konsol admin.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030303] text-zinc-100 relative overflow-hidden p-4">
      {/* Glow Backdrops */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-rose-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-500/5 rounded-full blur-[120px] pointer-events-none" />

      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-2xl bg-zinc-950/80 border border-zinc-900 p-8 shadow-xl relative z-10"
      >
        {/* Brand/Logo Title */}
        <div className="flex flex-col items-center gap-2.5 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">
            Dramaplay Admin
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Konsol Manajemen</p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 p-3 text-xs font-semibold text-rose-400 leading-relaxed animate-fadeIn">
            ⚠️ {error}
          </div>
        ) : null}

        <div className="space-y-3.5 mb-6">
          <input
            type="email"
            placeholder="Alamat Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 p-3 text-xs font-medium text-white transition-all outline-none"
          />
          
          <input
            type="password"
            placeholder="Kata Sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/20 p-3 text-xs font-medium text-white transition-all outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 hover:opacity-95 text-white font-bold py-3.5 text-xs tracking-wider uppercase shadow-md shadow-rose-500/10 transition-all duration-200 active:scale-[0.98]"
        >
          {busy ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <span>Memproses...</span>
            </div>
          ) : (
            "Masuk Ke Dashboard"
          )}
        </button>
      </form>
    </div>
  );
}
