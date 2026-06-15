import { toast } from "sonner";
import type { ReportByCompanyDataset } from "@/lib/reportByCompanyData";

// Comentário: formatador pt-BR para valores monetários (sem "R$"), com 2 casas decimais e separador de milhar.
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

const escapeCsvString = (raw: string): string => {
  const formulaRisk = /^[=+\-@]/.test(raw);
  const safeText = `${formulaRisk ? "'" : ""}${raw}`;
  return `"${safeText.replace(/"/g, '""')}"`;
};

// Comentário: célula de texto preserva zeros à esquerda, traços e pontos (banco, agência, conta, Pix).
const safeCsvText = (value: unknown): string => {
  if (value === null || value === undefined) return '""';
  return escapeCsvString(String(value));
};

// Comentário: célula monetária formata em pt-BR antes do escape; nunca usar safeCsvText para valores numéricos da folha.
const safeCsvMoney = (value: unknown): string => escapeCsvString(formatBrlNumber(value));

const buildReportFileName = (dataset: ReportByCompanyDataset, extension: "csv" | "pdf") => {
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

type Cell = { kind: "text"; value: unknown } | { kind: "money"; value: unknown };
const t = (value: unknown): Cell => ({ kind: "text", value });
const m = (value: unknown): Cell => ({ kind: "money", value });

const serializeCell = (cell: Cell): string => (cell.kind === "money" ? safeCsvMoney(cell.value) : safeCsvText(cell.value));

export const buildReportByCompanyCsv = (dataset: ReportByCompanyDataset): string => {
  const headerLabels = [
    ...(dataset.isConsolidated ? ["Empresa"] : []),
    ...dataset.fixedColumns.map((column) => column.label),
    ...BANK_HEADERS,
    ...dataset.dynamicColumns.map((column) => column.rubricName),
  ];

  const dataRows: Cell[][] = dataset.isConsolidated && dataset.companySections
    ? dataset.companySections.flatMap((companyDataset) =>
        companyDataset.rows.map((row) => [
          t(companyDataset.companyName),
          t(row.name),
          t(row.department),
          t(row.jobRole),
          t(row.admissionRegistration),
          t(row.bankName),
          t(row.bankBranch),
          t(row.bankAccount),
          t(row.bankPixKey),
          ...dataset.dynamicColumns.map((column) => m(row.rubricValues[column.rubricId] ?? 0)),
        ])
      )
    : dataset.rows.map((row) => [
        t(row.name),
        t(row.department),
        t(row.jobRole),
        t(row.admissionRegistration),
        t(row.bankName),
        t(row.bankBranch),
        t(row.bankAccount),
        t(row.bankPixKey),
        ...dataset.dynamicColumns.map((column) => m(row.rubricValues[column.rubricId] ?? 0)),
      ]);

  // Comentário: linha de totais — colunas fixas + bancárias ficam vazias; rubricas saem em pt-BR.
  const fixedAndBankBlanks = dataset.fixedColumns.length - 1 + BANK_HEADERS.length;
  const totalsRow: Cell[] = dataset.isConsolidated
    ? [
        t("TOTAL GERAL"),
        ...Array.from({ length: fixedAndBankBlanks }, () => t("")),
        ...dataset.dynamicColumns.map((column) => m(dataset.totalsByRubricId[column.rubricId] ?? 0)),
      ]
    : [
        t("TOTAL"),
        ...Array.from({ length: fixedAndBankBlanks }, () => t("")),
        ...dataset.dynamicColumns.map((column) => m(dataset.totalsByRubricId[column.rubricId] ?? 0)),
      ];

  const lines: string[] = [];
  // Comentário: "sep=;" instrui o Excel pt-BR a usar ponto-e-vírgula como separador automaticamente.
  lines.push("sep=;");
  lines.push(serializeCell(t(dataset.title)));
  lines.push("");
  lines.push(headerLabels.map((label) => safeCsvText(label)).join(";"));
  for (const row of dataRows) lines.push(row.map(serializeCell).join(";"));
  lines.push(totalsRow.map(serializeCell).join(";"));

  return lines.join("\n");
};

export const exportReportByCompanyExcel = (dataset: ReportByCompanyDataset) => {
  const csv = buildReportByCompanyCsv(dataset);

  // Comentário: BOM UTF-8 preservado; MIME e extensão .csv mantidos.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildReportFileName(dataset, "csv");
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exportação CSV concluída.");
};
