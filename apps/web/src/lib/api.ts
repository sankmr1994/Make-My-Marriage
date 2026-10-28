export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";

export type HealthStatus = "loading" | "online" | "offline";

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, {
      cache: "no-store"
    });

    return response.ok ? "online" : "offline";
  } catch {
    return "offline";
  }
}
