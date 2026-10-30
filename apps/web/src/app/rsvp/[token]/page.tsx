import { PublicRsvpPage } from "@/components/guests/public-rsvp-page";

export const metadata = { title: "RSVP | Make My Marriage" };

export default async function RsvpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicRsvpPage token={token} />;
}
