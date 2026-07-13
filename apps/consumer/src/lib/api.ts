const BASE = import.meta.env.VITE_API_URL ?? "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const code = await readErrorCode(res);
    throw new Error(code ? `${res.status} ${path} ${code}` : `${res.status} ${path}`);
  }
  return res.json() as Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorCodeFromBody(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const error = Object.hasOwn(body, "error") ? body.error : undefined;
  if (typeof error !== "string") return null;
  const code = error.trim();
  return code.length > 0 ? code : null;
}

async function readErrorCode(res: Response): Promise<string | null> {
  const raw = await res.text();
  if (!raw.trim()) return null;

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }

  return errorCodeFromBody(body);
}
