import { AuthPage } from "@/components/auth/auth-page";
import { redirectAuthenticatedUser } from "@/lib/auth-server";

export const metadata = { title: "Create account | Make My Marriage" };

export default async function SignUpPage() {
  await redirectAuthenticatedUser();
  return <AuthPage mode="sign-up" />;
}
