import { withPublic } from "@/lib/api/handler";

export const runtime = "nodejs";

/** GET /api/health — liveness only. Reveals no configuration or dependency details. */
export const GET = withPublic(async () => ({ status: "ok" }));
