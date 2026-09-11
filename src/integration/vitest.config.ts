import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["json", "json-summary", "text-summary", "html"],
      reportsDirectory: "../../.coverage/integration",
      include: ["src/integration/**/*.ts"],
      exclude: ["src/integration/**/*.test.ts", "src/integration/**/*.d.ts"],
    },
  },
});
