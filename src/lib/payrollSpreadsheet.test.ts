import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PayrollEntry, Rubric } from "@/types/payroll";
import {
  calculatePayrollFromEntry,
  calculatePayrollTotals,
  diagnoseCanonicalDerivedRubrics,
  hasCanonicalRubricInconsistency,
  resolveCanonicalDerivedRubricIds,
} from "@/lib/payrollSpreadsheet";

const makeDerivedRubric = (overrides: Partial<Rubric>): Rubric => ({
  id: overrides.id || "id",
  name: overrides.name || "Rubrica",
  code: overrides.code || "rubrica",
  type: overrides.type || "provento",
  nature: "calculada",
  calculationMethod: overrides.calculationMethod || "formula",
  classification: overrides.classification ?? null,
  fixedValue: overrides.fixedValue ?? null,
  percentageValue: overrides.percentageValue ?? null,
  percentageBaseRubricId: overrides.percentageBaseRubricId ?? null,
  order: overrides.order ?? 1,
  isActive: overrides.isActive ?? true,
  formulaItems: overrides.formulaItems ?? [],
  allowManualOverride: overrides.allowManualOverride ?? false,
});

const makeBaseRubric = (overrides: Partial<Rubric>): Rubric => ({
  id: overrides.id || "base-id",
  name: overrides.name || "Rubrica Base",
  code: overrides.code || "base_code",
  type: overrides.type || "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: overrides.classification ?? null,
  order: overrides.order ?? 1,
  isActive: overrides.isActive ?? true,
  formulaItems: [],
  allowManualOverride: true,
});

describe("resolveCanonicalDerivedRubricIds", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prioriza resolução por code canônico", () => {
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "r1", code: "salario_real", name: "Outro" }),
      makeDerivedRubric({ id: "r2", code: "g2_complemento", name: "Outro" }),
      makeDerivedRubric({ id: "r3", code: "salario_liquido", name: "Outro" }),
    ];

    const resolved = resolveCanonicalDerivedRubricIds(rubrics);

    expect(resolved).toEqual({
      salarioRealId: "r1",
      g2ComplementoId: "r2",
      salarioLiquidoId: "r3",
    });
  });

  it("usa fallback legado por name quando code canônico não existe", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "legacy1", code: "legado_a", name: "Salário Real" }),
      makeDerivedRubric({ id: "legacy2", code: "legado_b", name: "G2 Complemento" }),
      makeDerivedRubric({ id: "legacy3", code: "legado_c", name: "Salário Líquido" }),
    ];

    const resolved = resolveCanonicalDerivedRubricIds(rubrics);

    expect(resolved).toEqual({
      salarioRealId: "legacy1",
      g2ComplementoId: "legacy2",
      salarioLiquidoId: "legacy3",
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("mantém null quando não encontra rubrica canônica", () => {
    const rubrics: Rubric[] = [makeDerivedRubric({ id: "other", code: "resultado_tecnico", name: "Resultado Técnico" })];

    const resolved = resolveCanonicalDerivedRubricIds(rubrics);

    expect(resolved).toEqual({
      salarioRealId: null,
      g2ComplementoId: null,
      salarioLiquidoId: null,
    });
  });

  it("em ambiguidade por name legado não escolhe candidato arbitrário", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "a", code: "legado_a", name: "Salário Real" }),
      makeDerivedRubric({ id: "b", code: "legado_b", name: "Salário Real" }),
    ];

    const resolved = resolveCanonicalDerivedRubricIds(rubrics);

    expect(resolved.salarioRealId).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("em ambiguidade por code canônico não escolhe candidato arbitrário", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "a", code: "salario_real", name: "Salário Real A" }),
      makeDerivedRubric({ id: "b", code: "salario_real", name: "Salário Real B" }),
    ];

    const resolved = resolveCanonicalDerivedRubricIds(rubrics);

    expect(resolved.salarioRealId).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("retorna diagnóstico coerente para code, legado, ausência e ambiguidade", () => {
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "code-ok", code: "salario_real", name: "Salário Real" }),
      makeDerivedRubric({ id: "legacy-ok", code: "legacy_g2", name: "G2 Complemento" }),
      makeDerivedRubric({ id: "amb-a", code: "legacy_liq_a", name: "Salário Líquido" }),
      makeDerivedRubric({ id: "amb-b", code: "legacy_liq_b", name: "Salário Líquido" }),
    ];

    const diagnosis = diagnoseCanonicalDerivedRubrics(rubrics);

    expect(diagnosis.salario_real.status).toBe("resolved_by_code");
    expect(diagnosis.g2_complemento.status).toBe("resolved_by_legacy_name");
    expect(diagnosis.salario_liquido.status).toBe("ambiguous_name");
    expect(hasCanonicalRubricInconsistency(diagnosis)).toBe(true);
  });
});

describe("calculatePayrollFromEntry / calculatePayrollTotals", () => {
  it("retorna derivados canônicos e totais de proventos/descontos pela função única", () => {
    const rubrics: Rubric[] = [
      makeBaseRubric({ id: "base", code: "salario_base", type: "provento", order: 1 }),
      makeBaseRubric({ id: "desconto", code: "falta", type: "desconto", order: 2 }),
      makeDerivedRubric({
        id: "sal-real",
        code: "salario_real",
        name: "Salário Real",
        calculationMethod: "formula",
        order: 3,
        formulaItems: [{ id: "f1", operation: "add", sourceRubricId: "base", order: 1 }],
      }),
      makeDerivedRubric({
        id: "g2",
        code: "g2_complemento",
        name: "G2 Complemento",
        calculationMethod: "valor_fixo",
        fixedValue: 200,
        order: 4,
      }),
      makeDerivedRubric({
        id: "liq",
        code: "salario_liquido",
        name: "Salário Líquido",
        calculationMethod: "formula",
        order: 5,
        formulaItems: [
          { id: "f2", operation: "add", sourceRubricId: "sal-real", order: 1 },
          { id: "f3", operation: "add", sourceRubricId: "g2", order: 2 },
          { id: "f4", operation: "subtract", sourceRubricId: "desconto", order: 3 },
        ],
      }),
    ];

    const entry: PayrollEntry = {
      id: "e1",
      employeeId: "emp1",
      companyId: "c1",
      month: 4,
      year: 2026,
      baseSalary: 0,
      earnings: { base: 1000 },
      deductions: { desconto: 100 },
      notes: "",
    };

    const result = calculatePayrollFromEntry({ entry, rubrics });

    expect(result.earningsTotal).toBe(3300);
    expect(result.deductionsTotal).toBe(100);
    expect(result.salarioReal).toBe(1000);
    expect(result.g2Complemento).toBe(200);
    expect(result.salarioLiquido).toBe(1100);
  });

  it("agrega cards de totais com a mesma função única da linha", () => {
    const rubrics: Rubric[] = [
      makeBaseRubric({ id: "base", code: "salario_base", type: "provento", order: 1 }),
      makeDerivedRubric({
        id: "sal-real",
        code: "salario_real",
        calculationMethod: "formula",
        formulaItems: [{ id: "f1", operation: "add", sourceRubricId: "base", order: 1 }],
        order: 2,
      }),
      makeDerivedRubric({
        id: "g2",
        code: "g2_complemento",
        calculationMethod: "valor_fixo",
        fixedValue: 100,
        order: 3,
      }),
      makeDerivedRubric({
        id: "liq",
        code: "salario_liquido",
        calculationMethod: "formula",
        formulaItems: [
          { id: "f2", operation: "add", sourceRubricId: "sal-real", order: 1 },
          { id: "f3", operation: "add", sourceRubricId: "g2", order: 2 },
        ],
        order: 4,
      }),
    ];

    const entries: PayrollEntry[] = [
      { id: "a", employeeId: "1", companyId: "c", month: 4, year: 2026, baseSalary: 0, earnings: { base: 1000 }, deductions: {}, notes: "" },
      { id: "b", employeeId: "2", companyId: "c", month: 4, year: 2026, baseSalary: 0, earnings: { base: 500 }, deductions: {}, notes: "" },
    ];

    const totals = calculatePayrollTotals({ entries, rubrics });

    expect(totals.count).toBe(2);
    expect(totals.salarioReal).toBe(1500);
    expect(totals.g2Complemento).toBe(200);
    expect(totals.salarioLiquido).toBe(1700);
  });
});
