"use client";

import { Download, ImageIcon, KeyRound, Lock, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/analysis/primitives";
import { useViewer } from "@/components/dashboard/viewer";
import { Button, buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api/client";

const CONFIRM = "DELETE MY ACCOUNT";

const facts = [
  { icon: Lock, title: "Your data", body: "Reports are stored in Saarthi's database and every query is scoped to your account alone." },
  { icon: ImageIcon, title: "Photos", body: "Verified on upload, stored privately, and only viewable through short-lived signed links." },
  { icon: ShieldCheck, title: "Access", body: "Every page and API request is authenticated. Other users can never see your data." },
  { icon: KeyRound, title: "How results are made", body: "Each report names its method: computer vision on your photo, a rule-based estimate from your answers, or an AI synthesis." },
];

export default function SettingsPage() {
  const viewer = useViewer();
  const toast = useToast();
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    setDeleting(true);
    try {
      const res = await apiRequest<{ identityDeleted: boolean }>("/api/account", { method: "DELETE", json: { confirm: CONFIRM } });
      toast.success("Your data has been deleted", res.identityDeleted ? "Your sign-in account was removed too." : undefined);
      setTimeout(() => router.replace("/"), 1200);
    } catch (e) {
      toast.error("Couldn't delete your account", e instanceof Error ? e.message : undefined);
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-10 sm:px-8 lg:py-14">
      <PageHeader
        eyebrow="Settings"
        title={
          <>
            Settings &amp; <span className="italic text-ink-2">privacy.</span>
          </>
        }
        description="Your account, and exactly how Saarthi handles your information."
      />

      <Panel className="flex items-center gap-5 p-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-aurora text-lg font-semibold text-white">
          {viewer?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewer.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserRound className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-ink">{viewer?.name ?? "Your account"}</p>
          <p className="truncate text-sm text-ink-3">
            {viewer?.localMode ? "Local development mode — no sign-in provider" : (viewer?.email ?? "")}
          </p>
          {viewer && (
            <p className="mt-1 text-xs text-ink-3">Member since {new Date(viewer.memberSince).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
          )}
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        {facts.map((f, i) => (
          <Panel key={f.title} className="p-6" delay={0.04 * i}>
            <f.icon className="h-5 w-5 text-brand" />
            <h2 className="mt-4 font-semibold text-ink">{f.title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-2">{f.body}</p>
          </Panel>
        ))}
      </div>

      <Panel className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between" delay={0.1}>
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-ink">
            <Download className="h-4 w-4 text-ink-3" /> Download your data
          </h2>
          <p className="mt-1 text-sm text-ink-2">Everything Saarthi stores about you, as one JSON file.</p>
        </div>
        <a href="/api/account/export" download="saarthi-export.json" className={buttonClass("secondary")}>
          Export my data
        </a>
      </Panel>

      <Panel className="border-[color-mix(in_oklab,var(--danger)_30%,transparent)] p-6" delay={0.14}>
        <h2 className="flex items-center gap-2 font-semibold text-danger">
          <Trash2 className="h-4 w-4" /> Delete account
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-2">
          Permanently deletes your photos, reports, check-ins and history{viewer?.localMode ? "" : ", then your sign-in account"}. This
          can&apos;t be undone.
        </p>
        <label className="mt-5 block text-sm text-ink-2">
          Type <span className="font-mono font-medium text-ink">{CONFIRM}</span> to confirm
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="field mt-2 font-mono" autoComplete="off" />
        </label>
        <Button variant="danger" className="mt-4" disabled={confirmText !== CONFIRM || deleting} onClick={deleteAccount}>
          {deleting ? "Deleting…" : "Delete everything"}
        </Button>
      </Panel>
    </div>
  );
}
