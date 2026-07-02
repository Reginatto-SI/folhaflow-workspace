import ExcelJS from "exceljs";
import { toast } from "sonner";
import type { ReportByCompanyDataset } from "@/lib/reportByCompanyData";
import { formatPayrollReportFilename } from "@/lib/payrollReportFilename";

// Comentário: formato numérico do Excel — com locale pt-BR exibe como 1.234,56 (sem R$).
const BRL_NUMBER_FORMAT = "#,##0.00;-#,##0.00";
const INSTITUTIONAL_RED = "C4151C";
const HEADER_ROW_INDEX = 2;

const brlNumberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

export const formatBrlNumber = (value: unknown): string => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0,00";
  return brlNumberFormatter.format(n);
};

export const formatAdmissionRegistrationForExcel = (value: string): string => {
  if (!value) return value;

  // Comentário: a exportação mantém a célula como texto, convertendo só o prefixo ISO quando presente.
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})(\s*\/.*)?$/, (_match, year: string, month: string, day: string, suffix = "") => `${day}/${month}/${year}${suffix}`);
};

const buildReportFileName = (dataset: ReportByCompanyDataset, extension: "xlsx" | "pdf") => {
  if (dataset.isConsolidated) return `relatorio-todas-empresas-${String(dataset.month).padStart(2, "0")}-${dataset.year}.${extension}`;

  return formatPayrollReportFilename({
    competencia: { month: dataset.month, year: dataset.year, competenceLabel: dataset.competenceLabel },
    empresaNome: dataset.companyName || "Empresa",
    extension,
  });
};

const BANK_HEADERS = ["Banco", "Agência", "Conta", "Chave Pix"] as const;

type CellObject =
  | { v: string; t: "s" }
  | { v: number; t: "n"; z: string };

const textCell = (value: unknown): CellObject => ({
  v: value === null || value === undefined ? "" : String(value),
  t: "s",
});

// Comentário: célula monetária preserva o número (não string) para somas e formatação nativa no Excel.
const moneyCell = (value: unknown): CellObject => {
  const n = typeof value === "number" ? value : Number(value);
  return { v: Number.isFinite(n) ? Number(n.toFixed(2)) : 0, t: "n", z: BRL_NUMBER_FORMAT };
};

export const buildReportByCompanySheetData = (dataset: ReportByCompanyDataset): CellObject[][] => {
  const headerLabels = [
    ...(dataset.isConsolidated ? ["Empresa"] : []),
    ...dataset.fixedColumns.map((column) => column.label),
    ...BANK_HEADERS,
    ...dataset.dynamicColumns.map((column) => column.rubricName),
  ];

  const dataRows: CellObject[][] = dataset.isConsolidated && dataset.companySections
    ? dataset.companySections.flatMap((companyDataset) =>
        companyDataset.rows.map((row) => [
          textCell(companyDataset.companyName),
          textCell(row.name),
          textCell(row.department),
          textCell(row.jobRole),
          textCell(formatAdmissionRegistrationForExcel(row.admissionRegistration)),
          textCell(row.bankName),
          textCell(row.bankBranch),
          textCell(row.bankAccount),
          textCell(row.bankPixKey),
          ...dataset.dynamicColumns.map((column) => moneyCell(row.rubricValues[column.rubricId] ?? 0)),
        ])
      )
    : dataset.rows.map((row) => [
        textCell(row.name),
        textCell(row.department),
        textCell(row.jobRole),
        textCell(formatAdmissionRegistrationForExcel(row.admissionRegistration)),
        textCell(row.bankName),
        textCell(row.bankBranch),
        textCell(row.bankAccount),
        textCell(row.bankPixKey),
        ...dataset.dynamicColumns.map((column) => moneyCell(row.rubricValues[column.rubricId] ?? 0)),
      ]);

  // Comentário: linha de totais — colunas fixas + bancárias ficam vazias; rubricas em formato monetário pt-BR.
  const fixedAndBankBlanks = dataset.fixedColumns.length - 1 + BANK_HEADERS.length;
  const totalsRow: CellObject[] = [
    textCell(dataset.isConsolidated ? "TOTAL GERAL" : "TOTAL"),
    ...Array.from({ length: fixedAndBankBlanks }, () => textCell("")),
    ...dataset.dynamicColumns.map((column) => moneyCell(dataset.totalsByRubricId[column.rubricId] ?? 0)),
  ];

  return [
    [textCell(dataset.title)],
    [textCell("")],
    headerLabels.map(textCell),
    ...dataRows,
    totalsRow,
  ];
};

const TEXT_COLUMN_MIN_WIDTHS: Record<string, number> = {
  Empresa: 28,
  Nome: 28,
  Setor: 18,
  "Função/Cargo": 22,
  Banco: 20,
  Agência: 14,
  Conta: 16,
  "Chave Pix": 24,
};

const MONEY_COLUMN_MIN_WIDTH = 14;

const computeColumnWidths = (rows: CellObject[][]): { wch: number }[] => {
  const widths: number[] = [];
  const headerRow = rows[HEADER_ROW_INDEX] ?? [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      const text = cell.t === "n" ? formatBrlNumber(cell.v) : String(cell.v ?? "");
      const len = Math.min(text.length + 2, 40);
      if (len > (widths[index] ?? 0)) widths[index] = len;
    });
  }
  return widths.map((wch, index) => {
    const header = String(headerRow[index]?.v ?? "");
    const minimum = TEXT_COLUMN_MIN_WIDTHS[header] ?? (header ? MONEY_COLUMN_MIN_WIDTH : 10);
    return { wch: Math.max(wch, minimum) };
  });
};

const headerCellStyle: Partial<ExcelJS.Style> = {
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: `FF${INSTITUTIONAL_RED}` } },
  font: { color: { argb: "FFFFFFFF" }, bold: true, size: 11 },
  alignment: { vertical: "middle" },
  border: {
    top: { style: "thin", color: { argb: "FFB7B7B7" } },
    right: { style: "thin", color: { argb: "FFB7B7B7" } },
    bottom: { style: "thin", color: { argb: "FFB7B7B7" } },
    left: { style: "thin", color: { argb: "FFB7B7B7" } },
  },
};

const titleCellStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, size: 14 },
};

export const buildReportByCompanyWorksheet = (dataset: ReportByCompanyDataset): ExcelJS.Worksheet => {
  const sheetData = buildReportByCompanySheetData(dataset);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Folha", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 3, topLeftCell: "A4", activeCell: "A4" }],
  });
  const headerColumnCount = sheetData[HEADER_ROW_INDEX]?.length ?? 0;
  const lastColumn = worksheet.getColumn(headerColumnCount || 1).letter;

  sheetData.forEach((row) => {
    worksheet.addRow(row.map((cell) => cell.v));
  });

  worksheet.columns = computeColumnWidths(sheetData).map(({ wch }) => ({ width: wch }));
  worksheet.getRow(1).height = 22;
  worksheet.getRow(3).height = 24;
  worksheet.getCell("A1").style = titleCellStyle;

  // Comentário: AutoFilter e estilos usam a última coluna real do cabeçalho, sem fixar 25 colunas.
  if (headerColumnCount > 0) {
    worksheet.autoFilter = `A3:${lastColumn}3`;

    for (let columnIndex = 0; columnIndex < headerColumnCount; columnIndex += 1) {
      worksheet.getRow(3).getCell(columnIndex + 1).style = headerCellStyle;
    }
  }

  sheetData.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      if (cell.t !== "n") return;
      worksheet.getRow(rowIndex + 1).getCell(columnIndex + 1).numFmt = BRL_NUMBER_FORMAT;
    });
  });

  return worksheet;
};

const downloadWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportReportByCompanyExcel = async (dataset: ReportByCompanyDataset) => {
  const worksheet = buildReportByCompanyWorksheet(dataset);
  await downloadWorkbook(worksheet.workbook, buildReportFileName(dataset, "xlsx"));

  toast.success("Exportação Excel concluída.");
};
