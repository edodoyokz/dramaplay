import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setInfoMsg("");
    if (!email.trim() || !password.trim()) {
      setErrorMsg("Email dan password wajib diisi.");
      return;
    }

    setBusy(true);
    try {
      if (activeTab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Retrieve session to save token reference
        const { data: session } = await supabase.auth.getSession();
        if (session.session?.access_token) {
          localStorage.setItem("dramaplay:token", session.session.access_token);
        }
        
        window.location.assign("/");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfoMsg("Cek email Anda untuk link verifikasi pendaftaran.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
      setErrorMsg(message);
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal masuk menggunakan Google.";
      setErrorMsg(message);
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-6 flex flex-col justify-between relative overflow-hidden">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-20">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-zinc-900/60 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Decorative Glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-center items-center max-w-sm mx-auto w-full z-10">
        {/* Brand Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <img src="/logo-app.png" alt="Dramaplay Logo" className="w-12 h-12 rounded-2xl object-cover shadow-lg border border-rose-500/20" />
          <h1 className="text-2xl font-black text-gradient-sunset tracking-tight">Dramaplay</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Vertical Short Drama</p>
        </div>

        {/* Auth Tab Switcher */}
        <div className="w-full bg-zinc-900/80 border border-zinc-800 p-1.5 rounded-2xl flex gap-1 mb-6">
          <button
            onClick={() => { setActiveTab("signin"); setErrorMsg(""); setInfoMsg(""); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === "signin" 
                ? "bg-zinc-800 text-white shadow-sm" 
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Masuk Akun
          </button>
          
          <button
            onClick={() => { setActiveTab("signup"); setErrorMsg(""); setInfoMsg(""); }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === "signup" 
                ? "bg-zinc-800 text-white shadow-sm" 
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Daftar Baru
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="w-full px-4 py-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-medium leading-relaxed animate-fadeIn">
            ⚠️ {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="w-full px-4 py-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium leading-relaxed animate-fadeIn">
            ✓ {infoMsg}
          </div>
        )}

        {/* Input Forms */}
        <form onSubmit={handleAuthSubmit} className="w-full space-y-3.5">
          <div>
            <input
              type="email"
              placeholder="Alamat Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              className="w-full glass-input rounded-xl px-4 py-3.5 text-xs font-medium"
              required
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Kata Sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full glass-input rounded-xl px-4 py-3.5 text-xs font-medium"
              required
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 mt-2 rounded-xl bg-gradient-sunset text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-rose-500/15 flex items-center justify-center gap-2 hover:opacity-95 transition-opacity active:scale-98 duration-100 disabled:opacity-50"
          >
            {busy ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : activeTab === "signin" ? (
              "Masuk"
            ) : (
              "Daftar"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="w-full flex items-center gap-4 my-6">
          <div className="flex-1 h-[1px] bg-zinc-900" />
          <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">atau</span>
          <div className="flex-1 h-[1px] bg-zinc-900" />
        </div>

        {/* Google OAuth button */}
        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="w-full py-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-xs flex items-center justify-center gap-2.5 hover:border-zinc-700 active:scale-98 transition-all"
        >
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114-3.535 0-6.402-2.867-6.402-6.402s2.867-6.402 6.402-6.402c1.611 0 3.08.595 4.217 1.572l3.076-3.076C19.22 2.378 15.937 1 12.24 1 5.926 1 1 5.926 1 12.24s4.926 11.24 11.24 11.24c6.305 0 11.258-4.908 11.258-11.24 0-.74-.085-1.428-.243-1.955H12.24z"
            />
          </svg>
          Masuk dengan Google
        </button>
      </div>

      {/* Footer Branding */}
      <div className="text-center text-[10px] text-zinc-600 font-medium z-10">
        &copy; 2026 Dramaplay. Hak Cipta Dilindungi.
      </div>
    </div>
  );
}
