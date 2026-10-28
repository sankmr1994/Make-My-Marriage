export function safeInvitationReturn(next?: string): string | undefined {
  if (!next) return undefined;
  try {
    const url = new URL(next, "http://localhost");
    const token = url.searchParams.get("token");
    return url.origin === "http://localhost" && url.pathname === "/accept-invitation" && token
      ? `/accept-invitation?token=${encodeURIComponent(token)}`
      : undefined;
  } catch { return undefined; }
}
