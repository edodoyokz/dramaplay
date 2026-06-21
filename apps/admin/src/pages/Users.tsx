import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
}

export default function Users() {
  const [rows, setRows] = useState<User[]>([]);
  useEffect(() => {
    api<{ items: User[] }>("/admin/users")
      .then((r) => setRows(r.items))
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Users</h1>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Email</th>
            <th>Role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-b">
              <td className="py-2">{u.email}</td>
              <td>{u.role}</td>
              <td>{u.isBanned ? "Banned" : "Active"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
