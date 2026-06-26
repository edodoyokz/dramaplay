// Shared Sapimu auth GET helper. Keeps Authorization header + User-Agent
// consistent across the preset adapter and any override that needs a follow-up
// request via ctx.get().

export function makeGet(baseUrl: string, token?: string) {
  return async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!res.ok) throw new Error(`sapimu ${path} -> ${res.status}`);
    return (await res.json()) as T;
  };
}
