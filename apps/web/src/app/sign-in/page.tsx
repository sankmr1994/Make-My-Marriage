import { AuthPage } from "@/components/auth/auth-page";
import { redirectAuthenticatedUser } from "@/lib/auth-server";
import { safeInvitationReturn } from "@/lib/invitation-return";

export const metadata = { title: "Sign in | Make My Marriage" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const { next, email } = await searchParams;
  const redirectTo = safeInvitationReturn(next);
  await redirectAuthenticatedUser(redirectTo);
  return <AuthPage mode="sign-in" redirectTo={redirectTo} initialEmail={email} />;
}
