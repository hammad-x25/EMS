import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true,
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**"],
  },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
