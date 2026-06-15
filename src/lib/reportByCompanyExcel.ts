import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { ReportByCompanyDataset } from "@/lib/reportByCompanyData";

// Comentário: formato numérico do Excel — com locale pt-BR exibe como 1.234,56 (sem R$).
const BRL_NUMBER_FORMAT = "#,##0.00;-#,##0.00";

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

const buildReportFileName = (dataset: ReportByCompanyDataset, extension: "xlsx" | "pdf") => {
  if (dataset.isConsolidated) return `relatorio-todas-empresas-${String(dataset.month).padStart(2, "0")}-${dataset.year}.${extension}`;

  const normalizedCompany = dataset.companyName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `relatorio-empresa-${normalizedCompany || "empresa"}-${String(dataset.month).padStart(2, "0")}-${dataset.year}.${extension}`;
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
          textCell(row.admissionRegistration),
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
        textCell(row.admissionRegistration),
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

const computeColumnWidths = (rows: CellObject[][]): { wch: number }[] => {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      const text = cell.t === "n" ? formatBrlNumber(cell.v) : String(cell.v ?? "");
      const len = Math.min(text.length + 2, 40);
      if (len > (widths[index] ?? 0)) widths[index] = len;
    });
  }
  return widths.map((wch) => ({ wch: Math.max(wch, 10) }));
};

export const exportReportByCompanyExcel = (dataset: ReportByCompanyDataset) => {
  const sheetData = buildReportByCompanySheetData(dataset);

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet["!cols"] = computeColumnWidths(sheetData);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Folha");
  XLSX.writeFile(workbook, buildReportFileName(dataset, "xlsx"));

  toast.success("Exportação Excel concluída.");
};
