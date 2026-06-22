import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Providers from "./pages/Providers";
import Dramas from "./pages/Dramas";
import Users from "./pages/Users";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import { getToken, clearSession, supabase } from "./lib/supabase";

function RequireAuth() {
  const [ok, setOk] = useState<boolean | null>(() => {
    const token = getToken();
    return token ? null : false;
  });

  useEffect(() => {
    if (ok !== null) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOk(true);
      else {
        clearSession();
        setOk(false);
      }
    });
  }, [ok]);

  if (ok === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-slate-500">Memeriksa sesi...</div>
      </div>
    );
  }
  if (!ok) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/providers" element={<Providers />} />
          <Route path="/dramas" element={<Dramas />} />
          <Route path="/users" element={<Users />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
