import { BrowserRouter, Routes, Route, Outlet, NavLink, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/Home";
import DramaDetail from "./pages/DramaDetail";
import LongformDetail from "./pages/LongformDetail";
import LongformWatch from "./pages/LongformWatch";
import Watch from "./pages/Watch";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Search from "./pages/Search";
import ProviderDramas from "./pages/ProviderDramas";
import LongformProvider from "./pages/LongformProvider";
import LongformCategory from "./pages/LongformCategory";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Refund from "./pages/Refund";
import NotFound from "./pages/NotFound";
import { isLongformProviderCode } from "./lib/longform-provider";

/** Static `/provider/wetv` routes have no `:code` param — use one dynamic route. */
function ProviderPage() {
  const { code = "" } = useParams();
  return isLongformProviderCode(code) ? <LongformProvider /> : <ProviderDramas />;
}

const qc = new QueryClient();

function Layout() {
  return (
    <div className="relative min-h-screen max-w-md mx-auto bg-black shadow-2xl border-x border-zinc-900/60 flex flex-col pb-16 app-frame">
      <main className="flex-1">
        <Outlet />
      </main>

      <nav
        aria-label="Navigasi utama"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-zinc-950/85 backdrop-blur-lg border-t border-zinc-900/65 flex items-center justify-around py-2 z-40"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 transition-all duration-200 ${
              isActive ? "text-rose-500 scale-105 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`
          }
        >
          <svg
            className="w-5.5 h-5.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span className="text-[11px] tracking-wide">Beranda</span>
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 transition-all duration-200 ${
              isActive ? "text-rose-500 scale-105 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`
          }
        >
          <svg
            className="w-5.5 h-5.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="text-[11px] tracking-wide">Cari</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 transition-all duration-200 ${
              isActive ? "text-rose-500 scale-105 font-bold" : "text-zinc-500 hover:text-zinc-300"
            }`
          }
        >
          <svg
            className="w-5.5 h-5.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span className="text-[11px] tracking-wide">Profil</span>
        </NavLink>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          {/* Main sections within the persistent layout */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/drama/:slug" element={<DramaDetail />} />
            <Route path="/title/:slug" element={<LongformDetail />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/search" element={<Search />} />
            <Route path="/provider/:code" element={<ProviderPage />} />
            <Route path="/provider/:code/category/:categoryCode" element={<LongformCategory />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Layouts without bottom nav (Player & Auth) */}
          <Route
            path="/drama/:slug/episode/:n"
            element={
              <div className="relative min-h-screen max-w-md mx-auto bg-black shadow-2xl border-x border-zinc-900/60 app-frame">
                <Watch />
              </div>
            }
          />
          <Route
            path="/title/:slug/watch/:season/:episode"
            element={
              <div className="relative min-h-screen max-w-3xl mx-auto bg-black shadow-2xl border-x border-zinc-900/60 app-frame">
                <LongformWatch />
              </div>
            }
          />
          <Route
            path="/title/:slug/watch/:n"
            element={
              <div className="relative min-h-screen max-w-3xl mx-auto bg-black shadow-2xl border-x border-zinc-900/60 app-frame">
                <LongformWatch />
              </div>
            }
          />
          <Route
            path="/auth"
            element={
              <div className="relative min-h-screen max-w-md mx-auto bg-black shadow-2xl border-x border-zinc-900/60 app-frame">
                <Auth />
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
