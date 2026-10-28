import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiBaseUrl } from "@/lib/api";

export async function redirectAuthenticatedUser(redirectTo?: string): Promise<void> {
  const sessionCookie = (await cookies()).get("mmm_session");
  if (!sessionCookie?.value) return;

  let authenticated = false;
  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      headers: { Cookie: `mmm_session=${encodeURIComponent(sessionCookie.value)}` },
      cache: "no-store",
      signal: AbortSignal.timeout(3000)
    });
    authenticated = response.ok;
  } catch {
    // Keep sign-in available if the API cannot be reached.
  }

  if (authenticated) redirect(redirectTo ?? "/welcome");
}
