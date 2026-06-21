import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Report {
  id: string;
  targetType: string;
  reason: string;
  status: string;
  createdAt: string;
}

export default function Reports() {
  const [rows, setRows] = useState<Report[]>([]);
  useEffect(() => {
    api<{ items: Report[] }>("/admin/reports")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Target</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="py-2">{r.targetType}</td>
              <td>{r.reason}</td>
              <td>{r.status}</td>
              <td>{new Date(r.createdAt).toLocaleString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
