import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";

export default function Page() {
  return (
    <AuthShell
      title={
        <>
          Begin with <span className="italic text-white/60">one photo.</span>
        </>
      }
      subtitle="Measured skin and posture analysis, gentle check-ins, and a plan that explains itself."
    >
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </AuthShell>
  );
}
