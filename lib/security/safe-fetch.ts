import { BlockList, isIP } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";

/**
 * SSRF-hardened fetch for server-side downloads (used to pull a user's own asset from storage).
 *
 * Guarantees, in order:
 *  1. https only, default port, no credentials in the URL
 *  2. hostname must be on an explicit allow-list (IP literals are never allowed)
 *  3. every DNS answer must be a public unicast address (private, loopback, link-local, CGNAT,
 *     multicast, reserved, IPv4-mapped/NAT64 forms of those are rejected)
 *  4. redirects are not followed
 *  5. response Content-Type must be allowed; Content-Length and streamed size capped
 *  6. hard timeout covering connect + headers + body (the OS resolver's own timeout bounds DNS)
 *
 * Residual risk: DNS can change between our lookup and fetch's own resolution (rebinding). This is
 * mitigated by the host allow-list containing only trusted storage providers.
 */

export class UnsafeUrlError extends Error {
  constructor(public readonly reason: string) {
    super(`Blocked outbound request: ${reason}`);
    this.name = "UnsafeUrlError";
  }
}

export class FetchLimitError extends Error {
  constructor(
    public readonly reason: string,
    public readonly retryable = false,
  ) {
    super(reason);
    this.name = "FetchLimitError";
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["100::", 64],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** Extract an embedded IPv4 from IPv4-mapped (::ffff:a.b.c.d / ::ffff:xxxx:xxxx) or NAT64 (64:ff9b::/96) forms. */
function embeddedIPv4(ip: string): string | null {
  const lower = ip.toLowerCase();
  const dotted = lower.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return dotted[1];
  const hex = lower.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !blocked.check(ip, "ipv4");
  if (version === 6) {
    const v4 = embeddedIPv4(ip);
    if (v4) return isPublicAddress(v4);
    return !blocked.check(ip, "ipv6");
  }
  return false;
}

export type LookupFn = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

export interface SafeFetchOptions {
  allowedHosts: string[];
  allowedContentTypes: string[];
  maxBytes: number;
  timeoutMs: number;
  lookup?: LookupFn;
  fetchImpl?: typeof fetch;
}

export async function assertSafeUrl(
  rawUrl: string,
  options: Pick<SafeFetchOptions, "allowedHosts" | "lookup">,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("malformed URL");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("only https is allowed");
  if (url.username || url.password) throw new UnsafeUrlError("credentials in URL are not allowed");
  if (url.port && url.port !== "443") throw new UnsafeUrlError("non-default port");

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(host.replace(/^\[|\]$/g, ""))) throw new UnsafeUrlError("IP literal hosts are not allowed");
  const allowed = new Set(options.allowedHosts.map((h) => h.toLowerCase()));
  if (!allowed.has(host)) throw new UnsafeUrlError(`host ${host} is not allow-listed`);

  let answers: Array<{ address: string; family: number }>;
  try {
    answers = await (options.lookup ?? defaultLookup)(host);
  } catch {
    throw new FetchLimitError("DNS resolution failed", true);
  }
  if (answers.length === 0) throw new FetchLimitError("DNS returned no addresses", true);
  for (const a of answers) {
    if (!isPublicAddress(a.address)) throw new UnsafeUrlError("host resolves to a non-public address");
  }
  return url;
}

export async function safeFetchBytes(
  rawUrl: string,
  options: SafeFetchOptions,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const url = await assertSafeUrl(rawUrl, options);
    let response: Response;
    try {
      response = await (options.fetchImpl ?? fetch)(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { accept: options.allowedContentTypes.join(", ") },
      });
    } catch (error) {
      if (controller.signal.aborted) throw new FetchLimitError("download timed out", true);
      throw new FetchLimitError(`download failed: ${(error as Error).message}`, true);
    }

    if (response.status >= 300 && response.status < 400) throw new UnsafeUrlError("redirects are not followed");
    if (!response.ok)
      throw new FetchLimitError(
        `storage responded ${response.status}`,
        response.status >= 500 || response.status === 429,
      );

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!options.allowedContentTypes.includes(contentType)) {
      throw new FetchLimitError(`unexpected content type ${contentType || "(none)"}`);
    }
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > options.maxBytes) throw new FetchLimitError("response exceeds size limit");
    if (!response.body) throw new FetchLimitError("empty response body");

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        if (controller.signal.aborted) throw new FetchLimitError("download timed out", true);
        throw new FetchLimitError("download interrupted", true);
      }
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > options.maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new FetchLimitError("response exceeds size limit");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    return { bytes, contentType };
  } finally {
    clearTimeout(timer);
  }
}
