import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildFinancialSheetData, buildReportByCompanySheetData, buildReportByCompanyWorkbook, buildReportByCompanyWorksheet, formatAdmissionRegistrationForExcel, formatBrlNumber } from "@/lib/reportByCompanyExcel";
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
    { rubricId: "r1", rubricCode: "SALARIO_FISCAL", rubricName: "Salário Fiscal", rubricType: "provento", rubricClassification: null, order: 1, isCanonicalSalarioReal: false },
    { rubricId: "g2", rubricCode: "G2_COMPLEMENTO", rubricName: "G2 Complemento", rubricType: "provento", rubricClassification: null, order: 2, isCanonicalSalarioReal: false },
    { rubricId: "liq", rubricCode: "SALARIO_LIQUIDO", rubricName: "Salário Líquido", rubricType: "provento", rubricClassification: null, order: 3, isCanonicalSalarioReal: false },
  ],
  rows: [
    {
      employeeId: "e1",
      name: "Ana",
      department: "RH",
      jobRole: "Analista",
      admissionRegistration: "2025-01-01 / 10",
      cpf: "606.547.463-03",
      bankName: "Banco do Brasil",
      bankBranch: "0012",
      bankAccount: "70378-8",
      bankPixKey: "606.547.463-03",
      rubricValues: { r1: 2324.2, g2: 120.5, liq: 2100.25 },
    },
  ],
  totalsByRubricId: { r1: 2324.2, g2: 120.5, liq: 2100.25 },
  financialRubricIds: { salarioFiscalId: "r1", salarioG2Id: "g2", liquidoId: "liq" },
  ...overrides,
});

describe("formatBrlNumber", () => {
  it("formata em pt-BR com 2 casas e separadores corretos", () => {
    expect(formatBrlNumber(2324.2)).toBe("2.324,20");
    expect(formatBrlNumber(10000)).toBe("10.000,00");
    expect(formatBrlNumber(0)).toBe("0,00");
  });
});

describe("formatAdmissionRegistrationForExcel", () => {
  it("converte data ISO pura para o padrão brasileiro", () => {
    expect(formatAdmissionRegistrationForExcel("2023-09-01")).toBe("01/09/2023");
  });

  it("converte somente a data ISO e preserva o registro", () => {
    expect(formatAdmissionRegistrationForExcel("2025-01-01 / 10")).toBe("01/01/2025 / 10");
    expect(formatAdmissionRegistrationForExcel("2025-01-01 / 123")).toBe("01/01/2025 / 123");
  });

  it("mantém vazio, placeholder ISO convertido e valores fora do padrão sem alteração indevida", () => {
    expect(formatAdmissionRegistrationForExcel("")).toBe("");
    expect(formatAdmissionRegistrationForExcel("0001-01-01")).toBe("01/01/0001");
    expect(formatAdmissionRegistrationForExcel("01/09/2023")).toBe("01/09/2023");
    expect(formatAdmissionRegistrationForExcel("2025-01-01 ABC")).toBe("2025-01-01 ABC");
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
      "Chave PIX",
      "Salário Fiscal",
      "G2 Complemento",
      "Salário Líquido",
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

  it("formata Admissão/Registro como texto em padrão brasileiro no relatório individual", () => {
    const sheet = buildReportByCompanySheetData(baseDataset());
    const dataRow = sheet[3];

    expect(dataRow[3]).toMatchObject({ v: "01/01/2025 / 10", t: "s" });
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

  it("formata Admissão/Registro como texto em padrão brasileiro no relatório consolidado", () => {
    const dataset = baseDataset();
    const sheet = buildReportByCompanySheetData({
      ...dataset,
      isConsolidated: true,
      companyName: "Todas as Empresas",
      companySections: [dataset],
    });
    const dataRow = sheet[3];

    expect(dataRow[4]).toMatchObject({ v: "01/01/2025 / 10", t: "s" });
  });
});

describe("buildReportByCompanyWorksheet", () => {
  it("aplica cabeçalho estilizado, filtro dinâmico e congelamento em A4", () => {
    const worksheet = buildReportByCompanyWorksheet(baseDataset());

    expect(worksheet.autoFilter).toBe("A3:K3");
    expect(worksheet.views[0]).toMatchObject({ topLeftCell: "A4", ySplit: 3, state: "frozen" });
    expect(worksheet.getCell("A3").style).toMatchObject({
      fill: { fgColor: { argb: "FFC4151C" } },
      font: { color: { argb: "FFFFFFFF" }, bold: true },
      alignment: { vertical: "middle" },
    });
    expect(worksheet.getCell("K3").style).toMatchObject({
      fill: { fgColor: { argb: "FFC4151C" } },
      font: { color: { argb: "FFFFFFFF" }, bold: true },
    });
  });

  it("ajusta o filtro até a última coluna usada em relatório consolidado", () => {
    const dataset = baseDataset();
    const worksheet = buildReportByCompanyWorksheet({
      ...dataset,
      isConsolidated: true,
      companyName: "Todas as Empresas",
      companySections: [dataset],
    });

    expect(worksheet.autoFilter).toBe("A3:L3");
    expect(worksheet.getCell("L3").style).toMatchObject({ font: { bold: true } });
  });

  it("define larguras mínimas para colunas de leitura e monetárias", () => {
    const worksheet = buildReportByCompanyWorksheet(baseDataset());
    const columns = worksheet.columns;

    expect(columns[0].width).toBeGreaterThanOrEqual(28);
    expect(columns[2].width).toBeGreaterThanOrEqual(22);
    expect(columns[4].width).toBeGreaterThanOrEqual(20);
    expect(columns[7].width).toBeGreaterThanOrEqual(24);
    expect(columns[8].width).toBeGreaterThanOrEqual(14);
  });
});


describe("buildFinancialSheetData", () => {
  it("gera aba Financeiro somente com as colunas solicitadas e valores já presentes no dataset", () => {
    const sheet = buildFinancialSheetData(baseDataset());
    expect(sheet[2].map((cell) => cell.v)).toEqual([
      "Empresa",
      "Nome",
      "Setor",
      "CPF",
      "Banco",
      "Agência",
      "Conta",
      "Chave PIX",
      "Salário Fiscal",
      "Salário G2",
      "Líquido",
      "Valor PIX",
      "Cheque",
    ]);
    expect(sheet[3].map((cell) => cell.v)).toEqual([
      "Empresa 1",
      "Ana",
      "RH",
      "606.547.463-03",
      "Banco do Brasil",
      "0012",
      "70378-8",
      "606.547.463-03",
      2324.2,
      120.5,
      2100.25,
      "",
      "",
    ]);
  });


  it("mantém Valor PIX e Cheque vazios quando não existe forma de pagamento explícita", () => {
    const sheet = buildFinancialSheetData(baseDataset({
      rows: [{
        ...baseDataset().rows[0],
        bankPixKey: "pix-chave-preenchida",
        rubricValues: { r1: 1000, g2: 200, liq: 900 },
      }],
    }));

    expect(sheet[3][7]).toMatchObject({ v: "pix-chave-preenchida", t: "s" });
    expect(sheet[3][11]).toMatchObject({ v: "", t: "s" });
    expect(sheet[3][12]).toMatchObject({ v: "", t: "s" });
  });

  it("deixa salários financeiros vazios quando os IDs estruturados não estão disponíveis", () => {
    const sheet = buildFinancialSheetData(baseDataset({
      financialRubricIds: { salarioFiscalId: null, salarioG2Id: null, liquidoId: null },
    }));

    expect(sheet[3][8]).toMatchObject({ v: "", t: "s" });
    expect(sheet[3][9]).toMatchObject({ v: "", t: "s" });
    expect(sheet[3][10]).toMatchObject({ v: "", t: "s" });
  });

  it("preserva CPF, agência, conta e chave PIX como texto na aba Financeiro", () => {
    const sheet = buildFinancialSheetData(baseDataset());

    expect(sheet[3][3]).toMatchObject({ v: "606.547.463-03", t: "s" });
    expect(sheet[3][5]).toMatchObject({ v: "0012", t: "s" });
    expect(sheet[3][6]).toMatchObject({ v: "70378-8", t: "s" });
    expect(sheet[3][7]).toMatchObject({ v: "606.547.463-03", t: "s" });
  });

  it("mantém a empresa correta por funcionário na aba Financeiro consolidada", () => {
    const datasetA = baseDataset({ companyName: "Empresa A" });
    const datasetB = baseDataset({
      companyName: "Empresa B",
      rows: [{ ...baseDataset().rows[0], employeeId: "e2", name: "Bia", rubricValues: { r1: 10, g2: 20, liq: 30 } }],
    });

    const sheet = buildFinancialSheetData(baseDataset({
      isConsolidated: true,
      companyName: "Todas as Empresas",
      companySections: [datasetA, datasetB],
    }));

    expect(sheet[3][0].v).toBe("Empresa A");
    expect(sheet[3][1].v).toBe("Ana");
    expect(sheet[4][0].v).toBe("Empresa B");
    expect(sheet[4][1].v).toBe("Bia");
  });

  it("cria workbook oficial com abas Relatório Geral e Financeiro", () => {
    const workbook = buildReportByCompanyWorkbook(baseDataset());
    expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(["Relatório Geral", "Financeiro"]);
  });

  it("serializa e reabre o XLSX preservando salários distintos e campos de pagamento vazios", async () => {
    const firstRow = baseDataset().rows[0];
    const dataset = baseDataset({
      rows: [
        {
          ...firstRow,
          employeeId: "e1",
          name: "Ana Alves Pereira",
          rubricValues: { r1: 2734.23, g2: 0, liq: 2734.23 },
        },
        {
          ...firstRow,
          employeeId: "e2",
          name: "Ana Beatriz Silva Barros",
          rubricValues: { r1: 2781.25, g2: 969.02, liq: 3750.27 },
        },
      ],
      totalsByRubricId: { r1: 5515.48, g2: 969.02, liq: 6484.5 },
    });

    const serialized = await buildReportByCompanyWorkbook(dataset).xlsx.writeBuffer();
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(serialized);

    const general = reopened.getWorksheet("Relatório Geral");
    const financial = reopened.getWorksheet("Financeiro");
    expect(general).toBeDefined();
    expect(financial).toBeDefined();

    const headerIndex = (worksheet: ExcelJS.Worksheet, label: string) => {
      const header = worksheet.getRow(3);
      const index = header.values.findIndex((value) => value === label);
      expect(index).toBeGreaterThan(0);
      return index;
    };
    const rowIndexByEmployee = (worksheet: ExcelJS.Worksheet, nameColumn: number, employeeName: string) => {
      let matchedRow = 0;
      worksheet.eachRow((row) => {
        if (row.getCell(nameColumn).value === employeeName) matchedRow = row.number;
      });
      expect(matchedRow).toBeGreaterThan(0);
      return matchedRow;
    };

    const financialNameColumn = headerIndex(financial!, "Nome");
    const financialFiscalColumn = headerIndex(financial!, "Salário Fiscal");
    const pixColumn = headerIndex(financial!, "Valor PIX");
    const chequeColumn = headerIndex(financial!, "Cheque");
    const generalNameColumn = headerIndex(general!, "Nome");
    const generalFiscalColumn = headerIndex(general!, "Salário Fiscal");

    for (const [employeeName, expectedFiscal] of [
      ["Ana Alves Pereira", 2734.23],
      ["Ana Beatriz Silva Barros", 2781.25],
    ] as const) {
      const financialRow = rowIndexByEmployee(financial!, financialNameColumn, employeeName);
      const generalRow = rowIndexByEmployee(general!, generalNameColumn, employeeName);
      const financialFiscalCell = financial!.getRow(financialRow).getCell(financialFiscalColumn);

      expect(financialFiscalCell.value).toBe(expectedFiscal);
      expect(financialFiscalCell.type).toBe(ExcelJS.ValueType.Number);
      expect(financialFiscalCell.numFmt).toBe("#,##0.00;-#,##0.00");
      expect(financialFiscalCell.value).toBe(general!.getRow(generalRow).getCell(generalFiscalColumn).value);
      expect(financialFiscalCell.value).not.toBe("1");
      expect(financial!.getRow(financialRow).getCell(pixColumn).value).toBeNull();
      expect(financial!.getRow(financialRow).getCell(chequeColumn).value).toBeNull();
    }
  });
});
