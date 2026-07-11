import { describe, expect, it } from "vitest";
import { authErrorMessage, progressPercent, safeReturnPath } from "../src/lib/ux";

describe("safeReturnPath", () => {
  it("accepts an internal episode path", () => {
    expect(safeReturnPath("/drama/demo/episode/2")).toBe("/drama/demo/episode/2");
  });
  it("rejects external and protocol-relative paths", () => {
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("//evil.example")).toBe("/");
  });
});

describe("progressPercent", () => {
  it("calculates and clamps video progress", () => {
    expect(progressPercent(30, 120)).toBe(25);
    expect(progressPercent(200, 120)).toBe(100);
    expect(progressPercent(5, 0)).toBe(0);
  });
});

describe("authErrorMessage", () => {
  it("maps provider errors without exposing technical text", () => {
    expect(authErrorMessage("Invalid login credentials")).toBe("Email atau kata sandi salah.");
    expect(authErrorMessage("unknown internal detail")).toBe("Autentikasi gagal. Silakan coba lagi.");
  });
});
