import { apiBaseUrl } from "@/lib/api";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.text();
    const response = await fetch(`${apiBaseUrl}/auth/password-reset/confirmation-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store"
    });
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store"
      }
    });
  } catch {
    return Response.json({ error: { code: "ACCOUNT_SERVICE_UNAVAILABLE", message: "The account service is unavailable. Please try again." } }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
