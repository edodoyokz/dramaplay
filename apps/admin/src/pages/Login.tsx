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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-900">
          Dramaplay Admin
        </h1>
        {error ? (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-4 w-full rounded-xl border border-slate-200 p-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-slate-900 py-3 font-semibold text-white"
        >
          {busy ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}
