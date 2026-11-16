"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/api/client";

export interface Viewer {
  name: string | null;
  email: string | null;
  imageUrl: string | null;
  memberSince: string;
  localMode: boolean;
  features: { aiSynthesis: boolean };
}

const ViewerContext = createContext<Viewer | null>(null);

/** Loads the signed-in user's display profile once for the whole dashboard. */
export function ViewerProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    apiRequest<Viewer>("/api/me", { signal: ctrl.signal })
      .then(setViewer)
      .catch(() => undefined);
    return () => ctrl.abort();
  }, []);
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  return useContext(ViewerContext);
}

export function firstName(viewer: Viewer | null): string | null {
  const n = viewer?.name?.trim();
  return n ? n.split(/\s+/)[0] : null;
}
