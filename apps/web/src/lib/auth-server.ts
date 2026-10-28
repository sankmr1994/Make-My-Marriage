import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const serverApiBaseUrl = `${(process.env.API_ORIGIN ?? "http://localhost:4000").replace(/\/+$/, "")}/api/v1`;

export async function redirectAuthenticatedUser(redirectTo?: string): Promise<void> {
  const sessionCookie = (await cookies()).get("mmm_session");
  if (!sessionCookie?.value) return;

  let authenticated = false;
  try {
    const response = await fetch(`${serverApiBaseUrl}/auth/me`, {
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
