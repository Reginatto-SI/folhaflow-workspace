import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PayrollEntry, Rubric } from "@/types/payroll";
import {
  calculatePayroll,
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

  it("resolve G2 por code técnico legado sem depender de label", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "r1", code: "salario_real", name: "Outro" }),
      makeDerivedRubric({ id: "g2-legacy", code: "salario_g2_complemento", name: "Salário G2 Complemento" }),
      makeDerivedRubric({ id: "r3", code: "salario_liquido", name: "Outro" }),
    ];

    const diagnosis = diagnoseCanonicalDerivedRubrics(rubrics);
    const resolved = resolveCanonicalDerivedRubricIds(rubrics);

    expect(diagnosis.g2_complemento.status).toBe("resolved_by_legacy_code");
    expect(resolved.g2ComplementoId).toBe("g2-legacy");
    expect(warnSpy).toHaveBeenCalled();
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

  it("não trata fallback legado unívoco como inconsistência visual", () => {
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "legacy1", code: "legado_a", name: "Salário Real" }),
      makeDerivedRubric({ id: "legacy2", code: "legado_b", name: "G2 Complemento" }),
      makeDerivedRubric({ id: "legacy3", code: "legado_c", name: "Salário Líquido" }),
    ];

    const diagnosis = diagnoseCanonicalDerivedRubrics(rubrics);

    expect(Object.values(diagnosis).map((item) => item.status)).toEqual([
      "resolved_by_legacy_name",
      "resolved_by_legacy_name",
      "resolved_by_legacy_name",
    ]);
    expect(hasCanonicalRubricInconsistency(diagnosis)).toBe(false);
  });

  it("mantém inconsistência quando faltar configuração canônica essencial", () => {
    const rubrics: Rubric[] = [
      makeDerivedRubric({ id: "r1", code: "salario_real", name: "Salário Real" }),
      makeDerivedRubric({ id: "r2", code: "g2_complemento", name: "G2 Complemento" }),
    ];

    const diagnosis = diagnoseCanonicalDerivedRubrics(rubrics);

    expect(diagnosis.salario_liquido.status).toBe("missing");
    expect(hasCanonicalRubricInconsistency(diagnosis)).toBe(true);
  });

  it("não trata G2 Complemento negativo como inconsistência", () => {
    const rubrics: Rubric[] = [
      makeBaseRubric({ id: "base", code: "salario_ctps", type: "provento", order: 1 }),
      makeBaseRubric({ id: "desconto", code: "vales", type: "desconto", order: 2 }),
      makeDerivedRubric({
        id: "sal-real",
        code: "salario_real",
        name: "Salário Real",
        calculationMethod: "formula",
        order: 3,
        formulaItems: [{ id: "sr-1", operation: "add", sourceRubricId: "base", order: 1 }],
      }),
      makeDerivedRubric({
        id: "g2",
        code: "g2_complemento",
        name: "G2 Complemento",
        calculationMethod: "formula",
        order: 4,
        formulaItems: [
          { id: "g2-1", operation: "add", sourceRubricId: "base", order: 1 },
          { id: "g2-2", operation: "subtract", sourceRubricId: "desconto", order: 2 },
        ],
      }),
      makeDerivedRubric({
        id: "liq",
        code: "salario_liquido",
        name: "Salário Líquido",
        calculationMethod: "formula",
        order: 5,
        formulaItems: [
          { id: "liq-1", operation: "add", sourceRubricId: "sal-real", order: 1 },
          { id: "liq-2", operation: "subtract", sourceRubricId: "desconto", order: 2 },
        ],
      }),
    ];

    const result = calculatePayroll({ rubrics, manualValues: { base: 1000, desconto: 1500 } });
    const diagnosis = diagnoseCanonicalDerivedRubrics(rubrics);

    expect(result.g2Complemento).toBe(-500);
    expect(hasCanonicalRubricInconsistency(diagnosis)).toBe(false);
  });

  it("calcula salario_liquido pela fórmula corrigida: fiscal + proventos operacionais - descontos", () => {
    const rubrics: Rubric[] = [
      makeBaseRubric({ id: "ctps", code: "SALARIO_CTPS", name: "Salário CTPS", classification: "salario_ctps", order: 1 }),
      makeBaseRubric({ id: "g", code: "SALARIO_G", name: "Salário G", classification: "salario_g", order: 2 }),
      makeBaseRubric({ id: "fiscal", code: "SALARIO_FISCAL", name: "Salário Fiscal", classification: null, order: 3 }),
      makeBaseRubric({ id: "horas", code: "HORAS_EXTRAS", name: "Horas Extras", classification: "horas_extras", order: 5 }),
      makeBaseRubric({ id: "inss", code: "INSS", name: "INSS", type: "desconto", classification: "inss", order: 10 }),
      makeBaseRubric({ id: "vales", code: "VALES", name: "Vales/Descontos", type: "desconto", classification: "vales", order: 13 }),
      makeBaseRubric({ id: "faltas", code: "FALTAS", name: "Faltas/Descontos", type: "desconto", classification: "faltas", order: 14 }),
      makeDerivedRubric({
        id: "liq",
        code: "salario_liquido",
        name: "Salário Líquido",
        calculationMethod: "formula",
        order: 15,
        formulaItems: [
          { id: "liq-1", operation: "add", sourceRubricId: "fiscal", order: 1 },
          { id: "liq-2", operation: "add", sourceRubricId: "horas", order: 2 },
          { id: "liq-3", operation: "subtract", sourceRubricId: "inss", order: 3 },
          { id: "liq-4", operation: "subtract", sourceRubricId: "vales", order: 4 },
          { id: "liq-5", operation: "subtract", sourceRubricId: "faltas", order: 5 },
        ],
      }),
    ];

    const result = calculatePayroll({
      rubrics,
      manualValues: {
        ctps: 1900,
        g: 2500,
        fiscal: 1762.2,
        horas: 66.84,
        inss: 199.69,
        vales: 527.22,
        faltas: 77.73,
      },
    });

    // Comentário: CTPS/G permanecem bases técnicas fora da canônica de líquido;
    // o líquido oficial vem da fórmula declarativa corrigida da rubrica salario_liquido.
    expect(result.salarioLiquido).toBeCloseTo(1024.4, 2);
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

    // Rubricas derivadas/canônicas não entram nos totais operacionais para evitar dupla contagem.
    expect(result.earningsTotal).toBe(1000);
    expect(result.deductionsTotal).toBe(100);
    expect(result.salarioReal).toBe(1000);
    expect(result.g2Complemento).toBe(200);
    expect(result.salarioLiquido).toBe(1100);
  });


  it("não duplica rubrica derivada nos totais operacionais", () => {
    const rubrics: Rubric[] = [
      makeBaseRubric({ id: "base", code: "salario_base", type: "provento", order: 1 }),
      makeDerivedRubric({
        id: "sal-real",
        code: "salario_real",
        name: "Salário Real",
        type: "provento",
        calculationMethod: "formula",
        order: 2,
        formulaItems: [{ id: "f1", operation: "add", sourceRubricId: "base", order: 1 }],
      }),
    ];

    const entry: PayrollEntry = {
      id: "e-dup",
      employeeId: "emp",
      companyId: "c",
      month: 4,
      year: 2026,
      baseSalary: 0,
      earnings: { base: 1000 },
      deductions: {},
      notes: "",
    };

    const result = calculatePayrollFromEntry({ entry, rubrics });

    expect(result.salarioReal).toBe(1000);
    expect(result.earningsTotal).toBe(1000);
    expect(result.netSalary).toBe(1000);
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
