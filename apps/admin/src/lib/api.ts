const BASE = import.meta.env.VITE_API_URL ?? "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("dp_admin_token") ?? "";
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}
