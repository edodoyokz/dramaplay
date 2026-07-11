import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { authErrorMessage, safeReturnPath } from "../lib/ux";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnPath(searchParams.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Handle OAuth callback — Supabase auto-processes the hash, then we redirect
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(returnTo, { replace: true });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") navigate(returnTo, { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate, returnTo]);

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

        const { data: session } = await supabase.auth.getSession();
        if (session.session?.access_token) {
          localStorage.setItem("dramaplay:token", session.session.access_token);
        }

        window.location.assign(returnTo);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setInfoMsg("Cek email Anda untuk link verifikasi pendaftaran.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
      setErrorMsg(authErrorMessage(message));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setErrorMsg("");
    try {
      const callback = new URL("/auth", window.location.origin);
      if (returnTo !== "/") callback.searchParams.set("returnTo", returnTo);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
        },
      });
      if (error) throw error;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal masuk menggunakan Google.";
      setErrorMsg(authErrorMessage(message));
    }
  }

  return (
    <div className="min-h-screen bg-[#030303] text-zinc-100 p-6 flex flex-col justify-between relative overflow-hidden">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-zinc-900/60 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white"
          aria-label="Kembali"
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
          <img
            src="/logo-app.png"
            alt="Dramaplay Logo"
            className="w-12 h-12 rounded-2xl object-cover shadow-lg border border-rose-500/20"
          />
          <h1 className="text-2xl font-black text-gradient-sunset tracking-tight">Dramaplay</h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
            Vertical Short Drama
          </p>
        </div>

        {/* Auth Tab Switcher */}
        <div className="w-full bg-zinc-900/80 border border-zinc-800 p-1.5 rounded-2xl flex gap-1 mb-6">
          <button
            onClick={() => {
              setActiveTab("signin");
              setErrorMsg("");
              setInfoMsg("");
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === "signin" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Masuk Akun
          </button>

          <button
            onClick={() => {
              setActiveTab("signup");
              setErrorMsg("");
              setInfoMsg("");
            }}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ${
              activeTab === "signup" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Daftar Baru
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div
            role="alert"
            aria-live="polite"
            className="w-full px-4 py-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-medium leading-relaxed animate-fadeIn"
          >
            ⚠️ {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div
            role="status"
            aria-live="polite"
            className="w-full px-4 py-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-medium leading-relaxed animate-fadeIn"
          >
            ✓ {infoMsg}
          </div>
        )}

        {/* Input Forms */}
        <form onSubmit={handleAuthSubmit} className="w-full space-y-3.5">
          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
              Alamat Email
            </label>
            <input
              id="auth-email"
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              autoComplete="email"
              className="w-full glass-input rounded-xl px-4 py-3.5 text-xs font-medium"
              required
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1.5 block text-[11px] font-semibold text-zinc-400">
              Kata Sandi
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                placeholder="Kata sandi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                autoComplete={activeTab === "signin" ? "current-password" : "new-password"}
                className="w-full glass-input rounded-xl pl-4 pr-10 py-3.5 text-xs font-medium"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={busy}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
              >
                {showPassword ? (
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            {activeTab === "signup" ? (
              <p className="mt-1.5 text-[11px] text-zinc-500">Minimal 6 karakter.</p>
            ) : null}
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
