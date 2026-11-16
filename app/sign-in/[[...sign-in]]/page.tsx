import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";

export default function Page() {
  return (
    <AuthShell
      title={
        <>
          Welcome <span className="italic text-white/60">back.</span>
        </>
      }
      subtitle="Pick up where you left off — your reports and progress are waiting."
    >
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
    </AuthShell>
  );
}
