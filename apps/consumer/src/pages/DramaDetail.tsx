import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

interface Episode {
  id: string;
  episodeNumber: number;
  title: string | null;
  accessType: "free" | "vip";
}
interface Drama {
  id: string;
  slug: string;
  title: string;
  synopsis: string | null;
  posterUrl: string | null;
  year: number | null;
  genres: string[] | null;
}
interface DetailResponse {
  drama: Drama;
  episodes: Episode[];
}

export default function DramaDetail() {
  const { slug } = useParams();
  const [data, setData] = useState<DetailResponse | null>(null);

  useEffect(() => {
    if (!slug) return;
    api<DetailResponse>(`/catalog/dramas/${slug}`)
      .then(setData)
      .catch(() => setData(null));
  }, [slug]);

  if (!data) return <div className="p-4 text-slate-300">Memuat...</div>;
  const { drama, episodes } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative aspect-[16/9] bg-slate-800">
        {drama.posterUrl ? (
          <img src={drama.posterUrl} alt={drama.title} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="p-4">
        <h1 className="text-xl font-bold">{drama.title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          {[drama.year, drama.genres?.join(", ")].filter(Boolean).join(" • ")}
        </p>
        {drama.synopsis ? (
          <p className="mt-3 text-sm text-slate-300">{drama.synopsis}</p>
        ) : null}

        <Link
          to={`/drama/${drama.slug}/episode/${episodes[0]?.episodeNumber ?? 1}`}
          className="mt-4 block rounded-xl bg-yellow-500 py-3 text-center font-semibold text-black"
        >
          Mulai Menonton
        </Link>

        <h2 className="mb-3 mt-6 text-lg font-semibold">Episode</h2>
        <div className="grid grid-cols-4 gap-2">
          {episodes.map((ep) => (
            <Link
              key={ep.id}
              to={`/drama/${drama.slug}/episode/${ep.episodeNumber}`}
              className="relative rounded-lg bg-slate-800 p-3 text-center text-sm"
            >
              {ep.episodeNumber}
              {ep.accessType === "vip" ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-yellow-500 px-1 text-[10px] font-bold text-black">
                  VIP
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
