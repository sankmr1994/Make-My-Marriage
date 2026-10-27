import { AuthPage } from "@/components/auth/auth-page";
import { redirectAuthenticatedUser } from "@/lib/auth-server";

export const metadata = { title: "Sign in | Make My Marriage" };

export default async function SignInPage() {
  await redirectAuthenticatedUser();
  return <AuthPage mode="sign-in" />;
}
