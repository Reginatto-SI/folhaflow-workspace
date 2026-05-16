import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Central de Folha sem recálculo operacional backend", () => {
  it("não chama recalculate_payroll_batch no fluxo frontend da Central", () => {
    const contextSource = readFileSync("src/contexts/PayrollContext.tsx", "utf8");

    expect(contextSource).not.toContain('rpc("recalculate_payroll_batch"');
    expect(contextSource).not.toContain("rpc('recalculate_payroll_batch'");
  });
});
