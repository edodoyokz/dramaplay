import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearSession } from "../lib/supabase";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/providers", label: "Providers" },
  { to: "/dramas", label: "Dramas" },
  { to: "/users", label: "Users" },
  { to: "/payments", label: "Payments" },
  { to: "/reports", label: "Reports" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6 text-xl font-bold text-slate-900">Dramaplay</div>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="mt-4 rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100"
        >
          Keluar
        </button>
      </aside>
      <main className="flex-1 bg-slate-50 p-6">{children}</main>
    </div>
  );
}
