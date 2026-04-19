import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Rubric } from "@/types/payroll";
import {
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
  classification: null,
  order: overrides.order ?? 1,
  isActive: overrides.isActive ?? true,
  formulaItems: [],
  allowManualOverride: false,
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
