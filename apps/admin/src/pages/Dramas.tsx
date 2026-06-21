import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Drama {
  id: string;
  slug: string;
  title: string;
  country: string | null;
  year: number | null;
  isPublished: boolean;
}

export default function Dramas() {
  const [rows, setRows] = useState<Drama[]>([]);
  useEffect(() => {
    api<{ items: Drama[] }>("/admin/dramas")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dramas</h1>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Title</th>
            <th>Slug</th>
            <th>Country</th>
            <th>Year</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b">
              <td className="py-2">{d.title}</td>
              <td className="text-slate-500">{d.slug}</td>
              <td>{d.country ?? "-"}</td>
              <td>{d.year ?? "-"}</td>
              <td>{d.isPublished ? "Published" : "Hidden"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
