import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname, ".") };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup/unit.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/integration-global.ts"],
          setupFiles: ["tests/setup/integration.ts"],
          // Tests share one database; run files sequentially for deterministic state.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
