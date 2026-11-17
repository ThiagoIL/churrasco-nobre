import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Testes unitários das regras puras (sem banco). Os testes de banco rodam com `npm run test:db`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
