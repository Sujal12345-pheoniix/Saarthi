import "dotenv/config"; // loads .env for local CLI use; never overrides variables already set by the platform
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.resolve(process.cwd(), "prisma/schema.prisma"),
  migrations: {
    path: path.resolve(process.cwd(), "prisma/migrations"),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
