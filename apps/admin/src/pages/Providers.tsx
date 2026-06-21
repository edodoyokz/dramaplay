import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Provider {
  id: string;
  code: string;
  name: string;
  isEnabled: boolean;
  lastSyncStatus: string | null;
}

export default function Providers() {
  const [rows, setRows] = useState<Provider[]>([]);

  useEffect(() => {
    api<{ items: Provider[] }>("/admin/providers")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]));
  }, []);

  async function toggle(id: string) {
    await api(`/admin/providers/${id}/toggle`, { method: "POST" });
    setRows((r) =>
      r.map((p) => (p.id === id ? { ...p, isEnabled: !p.isEnabled } : p))
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Providers</h1>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Code</th>
            <th>Name</th>
            <th>Last Sync</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2">{p.code}</td>
              <td>{p.name}</td>
              <td>{p.lastSyncStatus ?? "-"}</td>
              <td>{p.isEnabled ? "Enabled" : "Disabled"}</td>
              <td>
                <button
                  onClick={() => toggle(p.id)}
                  className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-white"
                >
                  Toggle
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
