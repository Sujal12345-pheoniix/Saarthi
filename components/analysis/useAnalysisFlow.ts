"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportView } from "@/features/reports/view-model";
import { useToast } from "@/components/ui/toast";
import {
  ApiClientError,
  apiRequest,
  isAbortError,
  newIdempotencyKey,
  pollAnalysis,
  uploadImage,
} from "@/lib/api/client";
import type { Stage } from "./AnalysisProgress";

type Domain = "skin" | "physical";

const ANALYZE_ENDPOINT: Record<Domain, string> = { skin: "/api/analyze-skin", physical: "/api/analyze-fitness" };

/** User-facing explanation for failures that have a clear next step. */
function friendlyError(e: unknown): { title: string; description?: string } {
  if (e instanceof ApiClientError) {
    switch (e.code) {
      case "NOT_CONFIGURED":
        return { title: "This feature isn't set up yet", description: e.message };
      case "SERVICE_UNAVAILABLE":
        return { title: "Saarthi is being updated", description: "Please try again in a few minutes." };
      case "RATE_LIMITED":
        return { title: "Slow down a little", description: e.message };
      case "UNAUTHENTICATED":
        return { title: "Please sign in again", description: "Your session has expired." };
      case "ANALYSIS_FAILED":
        return { title: "We couldn't analyse that photo", description: e.message };
      case "POLL_TIMEOUT":
        return { title: "Still working on it", description: e.message };
      default:
        return { title: "Something went wrong", description: e.message };
    }
  }
  return { title: "Something went wrong", description: e instanceof Error ? e.message : undefined };
}

export function useAnalysisFlow<Q>(domain: Domain) {
  const toast = useToast();
  const [report, setReport] = useState<ReportView | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<Stage>("upload");
  const [stages, setStages] = useState<Stage[]>(["upload", "queue", "analyze", "report"]);
  const [uploadPct, setUploadPct] = useState(0);
  const [lastError, setLastError] = useState<{ title: string; description?: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    apiRequest<{ report: ReportView | null }>(`/api/reports/${domain}`, { signal: ctrl.signal })
      .then((d) => setReport(d.report))
      .catch((e) => {
        if (!isAbortError(e)) setLastError(friendlyError(e));
      })
      .finally(() => setLoadingLatest(false));
    return () => {
      ctrl.abort();
      abortRef.current?.abort();
    };
  }, [domain]);

  const run = useCallback(
    async (file: File | null, questionnaire: Q) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setRunning(true);
      setLastError(null);
      setUploadPct(0);
      try {
        if (!file) {
          setStages(["report"]);
          setStage("report");
          const data = await apiRequest<{ report: ReportView }>(`/api/reports/${domain}`, {
            method: "POST",
            json: questionnaire,
            signal: ctrl.signal,
          });
          setReport(data.report);
          toast.success("Report ready", "Built from your answers.");
          return data.report;
        }

        setStages(["upload", "queue", "analyze", "report"]);
        setStage("upload");
        const { assetId } = await uploadImage(file, domain, { onProgress: setUploadPct, signal: ctrl.signal });

        setStage("queue");
        const queued = await apiRequest<{ analysisId: string; status: string }>(ANALYZE_ENDPOINT[domain], {
          method: "POST",
          json: { assetId, questionnaire, idempotencyKey: newIdempotencyKey() },
          signal: ctrl.signal,
        });
        if (queued.status === "PROCESSING") setStage("analyze");

        const result = await pollAnalysis<ReportView>(
          queued.analysisId,
          (s) => setStage(s === "PROCESSING" ? "analyze" : "queue"),
          { signal: ctrl.signal, intervalMs: 1200 },
        );
        setStage("report");
        setReport(result);
        toast.success("Your report is ready", "Measured from your photo.");
        return result;
      } catch (e) {
        if (isAbortError(e)) return null;
        const err = friendlyError(e);
        setLastError(err);
        toast.error(err.title, err.description);
        return null;
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setRunning(false);
      }
    },
    [domain, toast],
  );

  return { report, setReport, loadingLatest, running, stage, stages, uploadPct, lastError, run };
}
