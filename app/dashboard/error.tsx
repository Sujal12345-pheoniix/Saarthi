"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

export default function DashboardError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-5">
      <div className="card max-w-md p-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] text-danger">
          <TriangleAlert className="h-6 w-6" />
        </span>
        <h1 className="font-display mt-6 text-3xl text-ink">Something went off course</h1>
        <p className="mt-3 text-ink-2">
          This page hit an unexpected error. Your data is safe — try again, or head back to your dashboard.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={() => retry()}>
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Dashboard
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
