import { describe, expect, it } from "vitest";
import { buildManagerialSummary } from "./reportSummaryManagerial";
import type { ReportSummaryDataset, SummaryRow } from "./reportSummaryData";

const row = (overrides: Partial<SummaryRow> & Pick<SummaryRow, "key" | "label" | "kind" | "total">): SummaryRow => ({
  valuesByCompanyId: { c1: overrides.total },
  semImob: overrides.total,
  ...overrides,
});

const dataset = (rows: SummaryRow[]): ReportSummaryDataset => ({
  title: "Resumo",
  competenceLabel: "ABRIL-26",
  month: 4,
  year: 2026,
  companies: [{ id: "c1", name: "Empresa A", headcount: 2 }],
  rows,
});

describe("buildManagerialSummary", () => {
  it("separa Rendimentos da base percentual da composição quando os conceitos divergem", () => {
    const summary = buildManagerialSummary(dataset([
      row({ key: "__headcount__", label: "Total de Funcionários", kind: "headcount", total: 2, isInteger: true }),
      row({ key: "sal_ctps", label: "Salário CTPS", kind: "rubric", total: 1000, rubricType: "provento" }),
      row({ key: "sal_g", label: "Salário G", kind: "rubric", total: 500, rubricType: "provento" }),
      row({ key: "outros", label: "Outros Rend.", kind: "rubric", total: 500, rubricType: "provento" }),
      row({ key: "sal_real", label: "Salário Real", kind: "rubric", total: 1500, rubricType: "provento", isCanonical: true }),
      row({ key: "salario_liquido", label: "Salário Líquido", kind: "rubric", total: 1800, rubricType: "provento", isCanonical: true }),
      row({ key: "__rendimentos__", label: "Rendimentos", kind: "rendimentos", total: 500 }),
      row({ key: "__descontos__", label: "Descontos", kind: "descontos", total: 200 }),
      row({ key: "__custo_medio__", label: "Custo médio por Func.", kind: "custo_medio", total: 250 }),
    ]));

    const baseComposicao = summary.composition.find((item) => item.key === "base_composicao");

    expect(summary.rendimentos).toBe(500);
    expect(baseComposicao?.label).toBe("Base da Composição");
    expect(baseComposicao?.value).toBe(2000);
    expect(baseComposicao?.percent).toBe(100);
    expect(summary.composition.some((item) => item.label === "Total da Folha / Rendimentos")).toBe(false);
    expect(summary.composition.find((item) => item.key === "salario_g")?.value).toBe(500);
    expect(summary.composition.find((item) => item.key === "salario_fiscal")?.value).toBe(1500);
    expect(summary.composition.find((item) => item.key === "salario_ctps")?.percent).toBe(50);
  });

  it("retorna 0,0% lógico quando a base da composição é zero", () => {
    const summary = buildManagerialSummary(dataset([
      row({ key: "__headcount__", label: "Total de Funcionários", kind: "headcount", total: 0, isInteger: true }),
      row({ key: "salario_ctps", label: "Salário CTPS", kind: "rubric", total: 0, rubricType: "provento" }),
      row({ key: "salario_liquido", label: "Salário Líquido", kind: "rubric", total: 0, rubricType: "provento", isCanonical: true }),
      row({ key: "__rendimentos__", label: "Rendimentos", kind: "rendimentos", total: 0 }),
      row({ key: "__descontos__", label: "Descontos", kind: "descontos", total: 0 }),
      row({ key: "__custo_medio__", label: "Custo médio por Func.", kind: "custo_medio", total: 0 }),
    ]));

    expect(summary.composition.every((item) => Number.isFinite(item.percent))).toBe(true);
    expect(summary.composition.find((item) => item.key === "base_composicao")?.label).toBe("Base da Composição");
    expect(summary.composition.find((item) => item.key === "base_composicao")?.percent).toBe(0);
  });
});
