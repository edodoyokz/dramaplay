import { NavLink, Outlet } from "react-router-dom";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/providers", label: "Providers" },
  { to: "/dramas", label: "Dramas" },
  { to: "/users", label: "Users" },
  { to: "/payments", label: "Payments" },
  { to: "/reports", label: "Reports" },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-slate-200 bg-white p-4">
        <div className="mb-6 text-xl font-bold text-slate-900">Dramaplay</div>
        <nav className="space-y-1">
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
      </aside>
      <main className="flex-1 bg-slate-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}
