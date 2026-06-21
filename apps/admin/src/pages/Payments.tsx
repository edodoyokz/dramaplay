import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface Payment {
  id: string;
  userId: string;
  amountIdr: number;
  status: string;
  createdAt: string;
}

export default function Payments() {
  const [rows, setRows] = useState<Payment[]>([]);
  useEffect(() => {
    api<{ items: Payment[] }>("/admin/payments")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">User</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2 font-mono text-xs">{p.userId}</td>
              <td>Rp {p.amountIdr.toLocaleString("id-ID")}</td>
              <td>{p.status}</td>
              <td>{new Date(p.createdAt).toLocaleString("id-ID")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
