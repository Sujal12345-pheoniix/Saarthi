import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

/**
 * Applies the real migration files to a scratch database seeded with pre-Phase-1 data and verifies
 * (1) data is transformed, not dropped, and (2) the result matches prisma/schema.prisma exactly (no drift).
 */
const MIGRATIONS = path.resolve(import.meta.dirname, "../../prisma/migrations");
const baselineSql = readFileSync(path.join(MIGRATIONS, "20261113000000_baseline/migration.sql"), "utf8");
const phase1Sql = readFileSync(path.join(MIGRATIONS, "20261113000100_phase1_foundation/migration.sql"), "utf8");

const adminUrl = new URL(process.env.TEST_DATABASE_URL!);
const scratchName = `${adminUrl.pathname.slice(1)}_migration`;
const scratchUrl = new URL(adminUrl.toString());
scratchUrl.pathname = `/${scratchName}`;

let client: pg.Client;

const LEGACY_SEED = `
INSERT INTO "User"(id,"clerkId",email,age,gender,"updatedAt") VALUES ('u1','clerk_1','a@x',30,'f',now()),('u2','clerk_2',null,null,null,now());
INSERT INTO "SkinReport"(id,"userId","imageUrl","skinScore","hydrationScore","acneSeverity",confidence,"detectedIssues",recommendations,"aiSummary","updatedAt")
  VALUES ('sr1','u1','https://res.cloudinary.com/x.jpg',80,70,10,95,'["a"]','["b"]','cv summary',now());
INSERT INTO "SkinAnalysis"(id,"userId","acneScore","drynessScore","oilinessScore","pigmentationScore",confidence,"aiSummary",recommendations,"updatedAt")
  VALUES ('sa1','u1',77,32,20,15,88,'q summary','["r"]',now());
INSERT INTO "FitnessReport"(id,"userId","fitnessScore","postureScore","mobilityScore",confidence,"detectedIssues",recommendations,"aiSummary","updatedAt")
  VALUES ('fr1','u2',72,70,75,90,'[]','[]','fit',now());
INSERT INTO "PhysicalHealthAnalysis"(id,"userId",bmi,hydration,"fitnessScore","activityLevel","sleepHours","aiSummary",recommendations,"updatedAt")
  VALUES ('pa1','u2',23.5,88,81,'Muscle gain',7.5,'phys','[]',now());
INSERT INTO "MentalHealthAnalysis"(id,"userId","stressLevel","anxietyLevel","moodScore","sleepScore","burnoutRisk","aiSummary",recommendations,"updatedAt")
  VALUES ('ma1','u1',40,50,85,90,40,'mental','[]',now());
INSERT INTO "Analysis"(id,"userId",type,status,"resultId",error,"updatedAt") VALUES
  ('a1','u1','skin','COMPLETED','sr1',null,now()),('a2','u2','fitness','COMPLETED','fr1',null,now()),
  ('a3','u1','skin','QUEUED',null,null,now()),('a4','u1','skin','FAILED',null,'Gemini API failed: {"key":"AIza-secret"}',now()),
  ('a5','u1','fitness','COMPLETED','missing',null,now());
INSERT INTO "ProgressHistory"(id,"userId","metricType",score) VALUES ('p1','u1','skin',80),('p2','u2','fitness',72);
INSERT INTO "Achievement"(id,"userId",title,description) VALUES ('ac1','u1','Skin Pioneer','d'),('ac2','u1','Skin Pioneer','dup');
INSERT INTO "CombinedWellnessReport"(id,"userId","overallHealthScore","aiInsights",risks,"actionPlan") VALUES ('c1','u1',70,'ins','[]','[]');
INSERT INTO "DailyHabits"(id,"userId",date,"waterIntake",steps,sleep,exercise,mood) VALUES
  ('d1','u1','2026-11-01 08:00',2000,5000,7,30,4),('d2','u1','2026-11-01 20:00',2500,8000,7,40,5);
INSERT INTO "AIConversation"(id,"userId",role,message) VALUES ('m1','u1','user','hi'),('m2','u1','ai','hello');
`;

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${scratchName}"`);
  await admin.query(`CREATE DATABASE "${scratchName}"`);
  await admin.end();

  client = new pg.Client({ connectionString: scratchUrl.toString() });
  await client.connect();
  await client.query(baselineSql);
  await client.query(LEGACY_SEED);
});

afterAll(async () => {
  await client?.end();
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${scratchName}"`);
  await admin.end();
});

const rows = async (sql: string) => (await client.query(sql)).rows;

describe("phase 1 migration on legacy data", () => {
  it("applies in one transaction", async () => {
    await client.query(phase1Sql);
    const legacy = await rows(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('SkinAnalysis','FitnessReport','PhysicalHealthAnalysis','MentalHealthAnalysis','DailyHabits')`,
    );
    expect(legacy).toHaveLength(0);
  });

  it("consolidates skin reports and marks unverifiable CV results", async () => {
    const r = await rows(
      `SELECT id, method, "skinScore", "hydrationScore", confidence, metrics, "analysisId" FROM "SkinReport" ORDER BY id`,
    );
    expect(r).toEqual([
      expect.objectContaining({
        id: "sa1",
        method: "QUESTIONNAIRE_RULES",
        skinScore: 77,
        hydrationScore: 68,
        confidence: null,
      }),
      expect.objectContaining({
        id: "sr1",
        method: "LEGACY_UNVERIFIED",
        confidence: null,
        analysisId: "a1",
        metrics: { legacy: { confidence: 95 } },
      }),
    ]);
  });

  it("consolidates physical reports; unmeasured mobility is not carried forward as a measurement", async () => {
    const r = await rows(
      `SELECT id, method, "mobilityScore", "waterLiters", goal, metrics, "analysisId" FROM "PhysicalReport" ORDER BY id`,
    );
    expect(r[0]).toMatchObject({
      id: "fr1",
      method: "LEGACY_UNVERIFIED",
      mobilityScore: null,
      analysisId: "a2",
      metrics: { legacy: { mobilityScore: 75 } },
    });
    expect(r[1]).toMatchObject({ id: "pa1", method: "QUESTIONNAIRE_RULES", waterLiters: 2.2, goal: "Muscle gain" });
  });

  it("migrates mental reports and moves ad-hoc derived values to legacy metrics", async () => {
    const [r] = await rows(`SELECT "wellnessScore", "stressLevel", "sleepHours", metrics FROM "MentalWellnessReport"`);
    expect(r).toMatchObject({
      wellnessScore: 85,
      stressLevel: 40,
      sleepHours: 7.5,
      metrics: { legacy: { anxietyLevel: 50, burnoutRisk: 40 } },
    });
  });

  it("maps job states honestly and scrubs legacy error text", async () => {
    const r = await rows(`SELECT id, domain, status, "errorCode", "errorMessage" FROM "Analysis" ORDER BY id`);
    expect(r.map((x) => [x.id, x.domain, x.status, x.errorCode])).toEqual([
      ["a1", "SKIN", "COMPLETED", null],
      ["a2", "PHYSICAL", "COMPLETED", null],
      ["a3", "SKIN", "FAILED", "INTERRUPTED_BY_UPGRADE"],
      ["a4", "SKIN", "FAILED", "LEGACY_FAILURE"],
      ["a5", "PHYSICAL", "FAILED", "LEGACY_REPORT_MISSING"],
    ]);
    expect(JSON.stringify(r)).not.toContain("AIza-secret");
  });

  it("moves profile fields, progress, achievements, habits and conversations without loss", async () => {
    expect(await rows(`SELECT "userId", age, gender FROM "UserProfile"`)).toEqual([
      { userId: "u1", age: 30, gender: "f" },
    ]);
    expect(await rows(`SELECT id, domain, value FROM "ProgressHistory" ORDER BY id`)).toEqual([
      { id: "p1", domain: "SKIN", value: 80 },
      { id: "p2", domain: "PHYSICAL", value: 72 },
    ]);
    expect(await rows(`SELECT id, code FROM "Achievement" ORDER BY id`)).toEqual([
      { id: "ac1", code: "FIRST_SKIN_SCAN" },
      { id: "ac2", code: null },
    ]);
    expect(await rows(`SELECT id, "waterMl" FROM "DailyHabit"`)).toEqual([{ id: "d2", waterMl: 2500 }]);
    expect(await rows(`SELECT m.id, m.role, m.content FROM "AIMessage" m ORDER BY m.id`)).toEqual([
      { id: "m1", role: "USER", content: "hi" },
      { id: "m2", role: "ASSISTANT", content: "hello" },
    ]);
    expect(await rows(`SELECT method, "overallHealthScore" FROM "CombinedWellnessReport"`)).toEqual([
      { method: "LEGACY_UNVERIFIED", overallHealthScore: 70 },
    ]);
  });

  it("produces exactly the structure in schema.prisma (no drift)", () => {
    // --exit-code: 0 = empty diff, 2 = differences, 1 = error. execSync throws on non-zero.
    execSync("npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: scratchUrl.toString() },
    });
  });
});
