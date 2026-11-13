import { describe, expect, it } from "vitest";
import IORedis from "ioredis";
import { getPrisma } from "@/lib/database/prisma";
import { resetEnvForTesting } from "@/lib/config/env";
import { setStorageForTesting } from "@/lib/storage/storage";
import { checkRateLimit, RedisRateLimitStore, type RateLimitStore } from "@/lib/security/rate-limit";
import { setRateLimitStoreForTesting } from "@/lib/api/handler";
import * as upload from "@/app/api/upload/route";
import * as account from "@/app/api/account/route";
import * as history from "@/app/api/history/route";
import { MemoryStorage } from "../helpers/fakes";
import { call, multipart, setClerkUser } from "../helpers/http";
import { makePng } from "../helpers/images";

describe("account deletion", () => {
  it("requires explicit confirmation", async () => {
    setClerkUser("clerk_delete_confirm");
    const res = await call(account.DELETE, { method: "DELETE", json: { confirm: "yes" } });
    expect(res.status).toBe(400);
  });

  it("removes stored files and all rows, keeps an anonymised audit trail", async () => {
    const storage = new MemoryStorage();
    setStorageForTesting(storage);
    setClerkUser("clerk_delete_me");
    const m = multipart({ purpose: "skin", file: { bytes: makePng(480, 480, 77), type: "image/png", name: "a.png" } });
    expect((await call(upload.POST, { method: "POST", body: m.body, headers: m.headers })).status).toBe(200);
    const user = await getPrisma().user.findUniqueOrThrow({ where: { clerkId: "clerk_delete_me" } });

    const res = await call<{ deleted: boolean; assetsDeleted: number; identityDeleted: boolean }>(account.DELETE, {
      method: "DELETE",
      json: { confirm: "DELETE MY ACCOUNT" },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { deleted: true, assetsDeleted: 1, identityDeleted: true } });
    expect(storage.objects.size).toBe(0);
    expect(await getPrisma().user.count({ where: { id: user.id } })).toBe(0);
    expect(await getPrisma().uploadedAsset.count({ where: { userId: user.id } })).toBe(0);
    const audit = await getPrisma().auditLog.findMany({ where: { resourceId: user.id, action: "account.delete" } });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorUserId).toBeNull();
  });
});

describe("rate limiting (real Redis)", () => {
  it("enforces a fixed window per subject", async () => {
    const redis = new IORedis(process.env.TEST_REDIS_URL!);
    const store = new RedisRateLimitStore(redis);
    const rule = { name: `t-${Date.now()}`, limit: 2, windowSeconds: 60 };
    const r1 = await checkRateLimit(store, rule, "user:a");
    const r2 = await checkRateLimit(store, rule, "user:a");
    const r3 = await checkRateLimit(store, rule, "user:a");
    const other = await checkRateLimit(store, rule, "user:b");
    expect([r1.allowed, r2.allowed, r3.allowed, other.allowed]).toEqual([true, true, false, true]);
    expect(r3.resetSeconds).toBeGreaterThan(0);
    expect(r3.resetSeconds).toBeLessThanOrEqual(60);
    await redis.quit();
  });

  it("fails open (allows) when the store errors", async () => {
    const broken: RateLimitStore = {
      hit: async () => {
        throw new Error("redis down");
      },
    };
    expect((await checkRateLimit(broken, { name: "x", limit: 1, windowSeconds: 60 }, "s")).allowed).toBe(true);
  });

  it("returns 429 with Retry-After from a route once the budget is spent", async () => {
    process.env.RATE_LIMIT_ENABLED = "true";
    resetEnvForTesting();
    const redis = new IORedis(process.env.TEST_REDIS_URL!);
    setRateLimitStoreForTesting(new RedisRateLimitStore(redis));
    try {
      setClerkUser(`clerk_rl_${Date.now()}`);
      let last = 200;
      let retryAfter: string | null = null;
      for (let i = 0; i < 125 && last !== 429; i++) {
        const r = await call(history.GET);
        last = r.status;
        retryAfter = r.headers.get("retry-after");
      }
      expect(last).toBe(429);
      expect(Number(retryAfter)).toBeGreaterThan(0);
    } finally {
      setRateLimitStoreForTesting(undefined);
      process.env.RATE_LIMIT_ENABLED = "false";
      resetEnvForTesting();
      await redis.quit();
    }
  });
});
