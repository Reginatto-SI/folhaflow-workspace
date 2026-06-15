import { describe, expect, it } from "vitest";
import { buildReportByCompanyCsv, formatBrlNumber } from "@/lib/reportByCompanyExcel";
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

describe("buildReportByCompanyCsv", () => {
  const csv = buildReportByCompanyCsv(baseDataset());

  it("inclui sep=; na primeira linha para o Excel pt-BR", () => {
    expect(csv.split("\n")[0]).toBe("sep=;");
  });

  it("inclui colunas bancárias no cabeçalho", () => {
    expect(csv).toContain("Banco");
    expect(csv).toContain("Agência");
    expect(csv).toContain("Conta");
    expect(csv).toContain("Chave Pix");
  });

  it("preserva agência com zero à esquerda e conta com traço", () => {
    expect(csv).toContain('"0012"');
    expect(csv).toContain('"70378-8"');
    expect(csv).toContain('"606.547.463-03"');
  });

  it("formata valores monetários em pt-BR", () => {
    expect(csv).toContain('"2.324,20"');
    expect(csv).not.toContain("2324.2");
  });

  it("consolidado adiciona coluna Empresa e linha TOTAL GERAL", () => {
    const dataset = baseDataset();
    const consolidated = buildReportByCompanyCsv({
      ...dataset,
      isConsolidated: true,
      companyName: "Todas as Empresas",
      companySections: [dataset],
    });
    expect(consolidated).toContain('"Empresa"');
    expect(consolidated).toContain('"Empresa 1"');
    expect(consolidated).toContain('"TOTAL GERAL"');
  });
});
