import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", clearMocks: true },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
