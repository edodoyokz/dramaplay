import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/Home";
import DramaDetail from "./pages/DramaDetail";
import Watch from "./pages/Watch";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drama/:slug" element={<DramaDetail />} />
          <Route path="/drama/:slug/episode/:n" element={<Watch />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
