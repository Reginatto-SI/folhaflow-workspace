import { describe, expect, it } from "vitest";
import { buildReportByCompanySheetData, formatBrlNumber } from "@/lib/reportByCompanyExcel";
import type { ReportByCompanyDataset } from "@/lib/reportByCompanyData";

const baseDataset = (overrides: Partial<ReportByCompanyDataset> = {}): ReportByCompanyDataset => ({
  title: "Folha - Empresa 1 (ABRIL/26)",
  companyName: "Empresa 1",
  competenceLabel: "ABRIL/26",
  month: 4,
  year: 2026,
  fixedColumns: [
    { key: "name", label: "Nome" },
    { key: "department", label: "Setor" },
    { key: "jobRole", label: "Função/Cargo" },
    { key: "admissionRegistration", label: "Admissão/Registro" },
  ],
  dynamicColumns: [
    { rubricId: "r1", rubricCode: "SAL", rubricName: "Salário", rubricType: "provento", rubricClassification: "salario_ctps", order: 1, isCanonicalSalarioReal: false },
  ],
  rows: [
    {
      employeeId: "e1",
      name: "Ana",
      department: "RH",
      jobRole: "Analista",
      admissionRegistration: "2025-01-01 / 10",
      bankName: "Banco do Brasil",
      bankBranch: "0012",
      bankAccount: "70378-8",
      bankPixKey: "606.547.463-03",
      rubricValues: { r1: 2324.2 },
    },
  ],
  totalsByRubricId: { r1: 2324.2 },
  ...overrides,
});

describe("formatBrlNumber", () => {
  it("formata em pt-BR com 2 casas e separadores corretos", () => {
    expect(formatBrlNumber(2324.2)).toBe("2.324,20");
    expect(formatBrlNumber(10000)).toBe("10.000,00");
    expect(formatBrlNumber(0)).toBe("0,00");
  });
});

describe("buildReportByCompanySheetData", () => {
  it("inclui colunas bancárias no cabeçalho", () => {
    const sheet = buildReportByCompanySheetData(baseDataset());
    const header = sheet[2].map((cell) => cell.v);
    expect(header).toEqual([
      "Nome",
      "Setor",
      "Função/Cargo",
      "Admissão/Registro",
      "Banco",
      "Agência",
      "Conta",
      "Chave Pix",
      "Salário",
    ]);
  });

  it("preserva campos bancários como texto, mantendo zeros à esquerda, traços e pontos", () => {
    const sheet = buildReportByCompanySheetData(baseDataset());
    const dataRow = sheet[3];
    expect(dataRow[4]).toMatchObject({ v: "Banco do Brasil", t: "s" });
    expect(dataRow[5]).toMatchObject({ v: "0012", t: "s" });
    expect(dataRow[6]).toMatchObject({ v: "70378-8", t: "s" });
    expect(dataRow[7]).toMatchObject({ v: "606.547.463-03", t: "s" });
  });

  it("rubricas saem como número com formato monetário pt-BR (sem R$)", () => {
    const sheet = buildReportByCompanySheetData(baseDataset());
    const valueCell = sheet[3][8];
    expect(valueCell.t).toBe("n");
    expect(valueCell.v).toBe(2324.2);
    expect((valueCell as { z: string }).z).toBe("#,##0.00;-#,##0.00");
  });

  it("consolidado adiciona coluna Empresa e linha TOTAL GERAL", () => {
    const dataset = baseDataset();
    const sheet = buildReportByCompanySheetData({
      ...dataset,
      isConsolidated: true,
      companyName: "Todas as Empresas",
      companySections: [dataset],
    });
    const header = sheet[2].map((cell) => cell.v);
    expect(header[0]).toBe("Empresa");
    const lastRow = sheet[sheet.length - 1];
    expect(lastRow[0].v).toBe("TOTAL GERAL");
  });
});
