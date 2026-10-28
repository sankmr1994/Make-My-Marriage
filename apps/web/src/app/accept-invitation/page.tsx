import { InvitationAcceptance } from "@/components/team/invitation-acceptance";

export const metadata = { title: "Accept invitation | Make My Marriage" };

export default async function AcceptInvitationPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <InvitationAcceptance token={token ?? ""} />;
}
