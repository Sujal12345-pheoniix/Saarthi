import { describe, expect, it, vi } from "vitest";
import {
  assertSafeUrl,
  FetchLimitError,
  isPublicAddress,
  safeFetchBytes,
  UnsafeUrlError,
  type LookupFn,
} from "@/lib/security/safe-fetch";

const ALLOWED = ["res.cloudinary.com", "api.cloudinary.com"];
const publicLookup: LookupFn = async () => [{ address: "104.18.20.1", family: 4 }];
const base = {
  allowedHosts: ALLOWED,
  allowedContentTypes: ["image/png"],
  maxBytes: 1024,
  timeoutMs: 2000,
  lookup: publicLookup,
};

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.5",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "::",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a9fe:a9fe",
    "64:ff9b::169.254.169.254",
  ])("blocks %s", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it.each(["104.18.20.1", "8.8.8.8", "2606:4700::6810:1401"])("allows public %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  );

  it("rejects non-IP strings", () => expect(isPublicAddress("localhost")).toBe(false));
});

describe("assertSafeUrl", () => {
  const reject = async (url: string, lookup: LookupFn = publicLookup) => {
    await expect(assertSafeUrl(url, { allowedHosts: ALLOWED, lookup })).rejects.toBeInstanceOf(UnsafeUrlError);
  };

  it("rejects non-https schemes", async () => {
    await reject("http://res.cloudinary.com/a.png");
    await reject("file:///etc/passwd");
    await reject("gopher://res.cloudinary.com/");
  });
  it("rejects hosts not on the allow-list", () => reject("https://evil.example/a.png"));
  it("rejects look-alike hosts", () => reject("https://res.cloudinary.com.evil.example/a.png"));
  it("rejects IP literals, including the metadata endpoint", async () => {
    await reject("https://169.254.169.254/latest/meta-data/");
    await reject("https://[::1]/");
  });
  it("rejects credentials and non-default ports", async () => {
    await reject("https://user:pass@res.cloudinary.com/a.png");
    await reject("https://res.cloudinary.com:8443/a.png");
  });
  it("rejects allow-listed hosts that resolve to private addresses (DNS rebinding)", () =>
    reject("https://res.cloudinary.com/a.png", async () => [{ address: "10.0.0.5", family: 4 }]));
  it("rejects when any DNS answer is private", () =>
    reject("https://res.cloudinary.com/a.png", async () => [
      { address: "104.18.20.1", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]));
  it("accepts an allow-listed host with public DNS", async () => {
    await expect(
      assertSafeUrl("https://res.cloudinary.com/a.png", { allowedHosts: ALLOWED, lookup: publicLookup }),
    ).resolves.toBeInstanceOf(URL);
  });
});

describe("safeFetchBytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

  it("does not follow redirects", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: "http://169.254.169.254/" } }),
    );
    await expect(safeFetchBytes("https://res.cloudinary.com/a.png", { ...base, fetchImpl })).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "manual" }));
  });

  it("rejects unexpected content types", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>", { headers: { "content-type": "text/html" } }));
    await expect(safeFetchBytes("https://res.cloudinary.com/a.png", { ...base, fetchImpl })).rejects.toBeInstanceOf(
      FetchLimitError,
    );
  });

  it("rejects declared and streamed bodies over the size limit", async () => {
    const declared = vi.fn(
      async () => new Response(png, { headers: { "content-type": "image/png", "content-length": "999999" } }),
    );
    await expect(safeFetchBytes("https://res.cloudinary.com/a.png", { ...base, fetchImpl: declared })).rejects.toThrow(
      /size limit/,
    );
    const streamed = vi.fn(
      async () => new Response(new Uint8Array(4096), { headers: { "content-type": "image/png" } }),
    );
    await expect(safeFetchBytes("https://res.cloudinary.com/a.png", { ...base, fetchImpl: streamed })).rejects.toThrow(
      /size limit/,
    );
  });

  it("times out slow responses", async () => {
    const fetchImpl = vi.fn(
      (_u: URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    ) as unknown as typeof fetch;
    await expect(
      safeFetchBytes("https://res.cloudinary.com/a.png", { ...base, timeoutMs: 50, fetchImpl }),
    ).rejects.toThrow(/timed out/);
  });

  it("returns bytes for a valid response", async () => {
    const fetchImpl = vi.fn(async () => new Response(png, { headers: { "content-type": "image/png" } }));
    const out = await safeFetchBytes("https://res.cloudinary.com/a.png", { ...base, fetchImpl });
    expect(Array.from(out.bytes)).toEqual(Array.from(png));
  });

  it("never contacts the network for a blocked URL", async () => {
    const fetchImpl = vi.fn();
    await expect(
      safeFetchBytes("https://169.254.169.254/latest/meta-data", {
        ...base,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
