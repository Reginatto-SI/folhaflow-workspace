import { describe, expect, it } from "vitest";
import {
  buildPayrollPdfDynamicColumns,
  formatPdfCurrencyBlankWhenZero,
  isHighlightedPayrollPdfColumn,
} from "@/lib/reportByCompanyPdf";
import type { ReportByCompanyDataset, ReportDynamicColumn } from "@/lib/reportByCompanyData";

const column = (overrides: Partial<ReportDynamicColumn> & Pick<ReportDynamicColumn, "rubricId" | "rubricName" | "order">): ReportDynamicColumn => ({
  rubricId: overrides.rubricId,
  rubricCode: overrides.rubricCode ?? overrides.rubricId,
  rubricName: overrides.rubricName,
  rubricType: overrides.rubricType ?? "provento",
  rubricClassification: overrides.rubricClassification ?? null,
  order: overrides.order,
  isCanonicalSalarioReal: overrides.isCanonicalSalarioReal ?? false,
});

const datasetWithColumns = (dynamicColumns: ReportDynamicColumn[]): ReportByCompanyDataset => ({
  title: "Folha - Empresa (ABRIL DE 26)",
  companyName: "Empresa",
  competenceLabel: "ABRIL DE 26",
  month: 4,
  year: 2026,
  fixedColumns: [],
  dynamicColumns,
  rows: [],
  totalsByRubricId: {},
});

describe("reportByCompanyPdf", () => {
  it("substitui Salário Real por Salário CTPS quando ambos existem", () => {
    const columns = [
      column({ rubricId: "ctps", rubricName: "Salário CTPS", rubricClassification: "salario_ctps", order: 1 }),
      column({ rubricId: "outros", rubricName: "(+) Outros Rendim.", order: 2 }),
      column({ rubricId: "real", rubricName: "Salário Real", order: 3, isCanonicalSalarioReal: true }),
      column({ rubricId: "liquido", rubricName: "Salário Líquido", order: 4 }),
    ];

    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(columns));

    expect(pdfColumns.map((item) => item.rubricId)).toEqual(["outros", "ctps", "liquido"]);
    expect(pdfColumns.some((item) => item.isCanonicalSalarioReal)).toBe(false);
    expect(pdfColumns.find((item) => item.rubricId === "ctps")?.isSubstitutingSalarioReal).toBe(true);
  });

  it("mantém Salário CTPS na posição original quando Salário Real não existe", () => {
    const columns = [
      column({ rubricId: "ctps", rubricName: "Salário CTPS", rubricClassification: "salario_ctps", order: 1 }),
      column({ rubricId: "outros", rubricName: "(+) Outros Rendim.", order: 2 }),
      column({ rubricId: "liquido", rubricName: "Salário Líquido", order: 3 }),
    ];

    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(columns));

    expect(pdfColumns.map((item) => item.rubricId)).toEqual(["ctps", "outros", "liquido"]);
    expect(pdfColumns.find((item) => item.rubricId === "ctps")?.isSubstitutingSalarioReal).toBeUndefined();
  });

  it("remove Salário Real sem inventar substituta quando CTPS não existe", () => {
    const columns = [
      column({ rubricId: "outros", rubricName: "(+) Outros Rendim.", order: 1 }),
      column({ rubricId: "real", rubricName: "Salário Real", order: 2, isCanonicalSalarioReal: true }),
      column({ rubricId: "liquido", rubricName: "Salário Líquido", order: 3 }),
    ];

    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(columns));

    expect(pdfColumns.map((item) => item.rubricId)).toEqual(["outros", "liquido"]);
    expect(pdfColumns.some((item) => item.isCanonicalSalarioReal)).toBe(false);
  });

  it("mantém as demais colunas quando não existem Salário Real nem Salário CTPS", () => {
    const columns = [
      column({ rubricId: "outros", rubricName: "(+) Outros Rendim.", order: 1 }),
      column({ rubricId: "liquido", rubricName: "Salário Líquido", order: 2 }),
    ];

    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(columns));

    expect(pdfColumns.map((item) => item.rubricId)).toEqual(["outros", "liquido"]);
  });

  it("trata CTPS substituta como coluna destacada no PDF", () => {
    const [ctpsReplacement] = buildPayrollPdfDynamicColumns(datasetWithColumns([
      column({ rubricId: "ctps", rubricName: "Salário CTPS", rubricClassification: "salario_ctps", order: 1 }),
      column({ rubricId: "real", rubricName: "Salário Real", order: 2, isCanonicalSalarioReal: true }),
    ]));

    expect(ctpsReplacement.rubricId).toBe("ctps");
    expect(isHighlightedPayrollPdfColumn(ctpsReplacement)).toBe(true);
  });

  it("deixa valores monetários zerados em branco", () => {
    expect(formatPdfCurrencyBlankWhenZero(0)).toBe("");
    expect(formatPdfCurrencyBlankWhenZero("R$ 0,00")).toBe("");
    expect(formatPdfCurrencyBlankWhenZero(null)).toBe("");
    expect(formatPdfCurrencyBlankWhenZero(undefined)).toBe("");
  });

  it("preserva moeda brasileira para valores diferentes de zero", () => {
    expect(formatPdfCurrencyBlankWhenZero(3000)).toBe("R$ 3.000,00");
    expect(formatPdfCurrencyBlankWhenZero(-25.5)).toBe("-R$ 25,50");
  });
});
