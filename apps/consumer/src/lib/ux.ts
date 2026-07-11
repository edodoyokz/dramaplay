export function safeReturnPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function progressPercent(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((currentTime / duration) * 100)));
}

export function authErrorMessage(message: string): string {
  const value = message.toLowerCase();
  if (value.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (value.includes("email not confirmed")) return "Verifikasi email Anda sebelum masuk.";
  if (value.includes("already registered")) return "Email ini sudah terdaftar.";
  if (value.includes("password") && value.includes("characters")) return "Kata sandi terlalu pendek.";
  if (value.includes("rate") || value.includes("too many")) return "Terlalu banyak percobaan. Coba lagi nanti.";
  return "Autentikasi gagal. Silakan coba lagi.";
}
