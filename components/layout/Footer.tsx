import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-line px-4 py-14 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo size={28} />
          <p className="mt-4 text-sm leading-6 text-ink-3">
            Saarthi offers wellness guidance, not medical advice. For symptoms that worry you, please see a qualified
            clinician. In a crisis, contact local emergency services.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
          <div className="space-y-3">
            <p className="font-semibold text-ink">Product</p>
            <Link href="/#pillars" className="block text-ink-3 transition hover:text-ink">What it does</Link>
            <Link href="/#honest" className="block text-ink-3 transition hover:text-ink">How it measures</Link>
            <Link href="/#how" className="block text-ink-3 transition hover:text-ink">How it works</Link>
          </div>
          <div className="space-y-3">
            <p className="font-semibold text-ink">Your data</p>
            <Link href="/#privacy" className="block text-ink-3 transition hover:text-ink">Privacy</Link>
            <Link href="/dashboard/settings" className="block text-ink-3 transition hover:text-ink">Export &amp; delete</Link>
          </div>
          <div className="space-y-3">
            <p className="font-semibold text-ink">App</p>
            <Link href="/dashboard" className="block text-ink-3 transition hover:text-ink">Dashboard</Link>
            <Link href="/dashboard/reports" className="block text-ink-3 transition hover:text-ink">Reports</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col justify-between gap-2 border-t border-line pt-6 text-xs text-ink-3 sm:flex-row">
        <p>© {new Date().getFullYear()} Saarthi. Made with care.</p>
        <p>Not a medical device. Not a substitute for professional care.</p>
      </div>
    </footer>
  );
}
