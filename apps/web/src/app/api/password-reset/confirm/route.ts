import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api";

function redirectToReset(request: Request, token: string, result: string): NextResponse {
  const destination = new URL("/reset-password", request.url);
  destination.searchParams.set("token", token);
  destination.searchParams.set("result", result);
  return NextResponse.redirect(destination, 303);
}

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const token = typeof form.get("token") === "string" ? String(form.get("token")) : "";
  const newPassword = typeof form.get("newPassword") === "string" ? String(form.get("newPassword")) : "";
  const confirmPassword = typeof form.get("confirmPassword") === "string" ? String(form.get("confirmPassword")) : "";

  if (!token) return redirectToReset(request, "", "invalid-link");
  if (newPassword !== confirmPassword) return redirectToReset(request, token, "passwords-do-not-match");
  if (newPassword.length < 12) return redirectToReset(request, token, "password-too-short");

  try {
    const response = await fetch(`${apiBaseUrl}/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
      cache: "no-store"
    });
    if (response.ok) return redirectToReset(request, token, "success");

    const body = await response.json().catch(() => null) as { error?: { code?: string } } | null;
    return redirectToReset(request, token, body?.error?.code === "TOKEN_EXPIRED_OR_REVOKED" ? "expired" : "account-service-error");
  } catch {
    return redirectToReset(request, token, "account-service-unavailable");
  }
}
