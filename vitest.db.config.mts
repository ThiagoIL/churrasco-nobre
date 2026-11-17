import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Testes das regras no banco (triggers e CHECKs). Exigem TEST_DATABASE_URL apontando para um banco
// DESCARTÁVEL com as migrations aplicadas; sem ela, os testes são ignorados.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/db/**/*.test.ts"], environment: "node", fileParallelism: false, testTimeout: 30000 },
});
