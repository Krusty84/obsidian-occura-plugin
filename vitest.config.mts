import { resolve } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      main: resolve(rootDir, "main.ts"),
      obsidian: resolve(rootDir, "tests/mocks/obsidian.ts"),
      src: resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
