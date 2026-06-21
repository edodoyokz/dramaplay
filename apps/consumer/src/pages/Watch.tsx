import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import VerticalShortPlayer from "../components/VerticalShortPlayer";
import PricingModal from "../components/PricingModal";

interface StreamResponse {
  streamUrl: string;
  streamType: "mp4" | "m3u8" | "other";
  subtitleUrl?: string;
  posterUrl?: string;
  episodeNumber: number;
  accessType: "free" | "vip";
}

export default function Watch() {
  const { slug, n } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<StreamResponse | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  useEffect(() => {
    setData(null);
    setBlocked(false);
    if (!slug || !n) return;

    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      try {
        const res = await api<StreamResponse>(`/watch/${slug}/${n}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setData(res);
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("403")) {
          setBlocked(true);
        }
      }
    })();
  }, [slug, n]);

  if (blocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 p-6 text-white">
        <h1 className="text-xl font-bold">Episode VIP</h1>
        <p className="text-center text-sm text-slate-300">
          Berlangganan VIP untuk menonton episode ini sampai tamat.
        </p>
        <button
          onClick={() => setShowPricing(true)}
          className="rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black"
        >
          Langganan VIP
        </button>
        {showPricing ? <PricingModal onClose={() => setShowPricing(false)} /> : null}
      </div>
    );
  }

  if (!data) return <div className="p-4 text-slate-300">Memuat...</div>;

  return (
    <div className="min-h-screen bg-black">
      <VerticalShortPlayer
        source={{ streamUrl: data.streamUrl, streamType: data.streamType }}
        poster={data.posterUrl}
        subtitleUrl={data.subtitleUrl}
        onEnded={() =>
          navigate(`/drama/${slug}/episode/${Number(n ?? 1) + 1}`)
        }
      />
    </div>
  );
}
