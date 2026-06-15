import { toast } from "sonner";
import type { ReportByCompanyDataset } from "@/lib/reportByCompanyData";

const safeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "\"\"";

  // Comentário: mantemos números como números para preservar uso em soma no Excel.
  if (typeof value === "number") return `"${String(value).replace(/"/g, '""')}"`;

  const text = String(value);
  const formulaRisk = /^[=+\-@]/.test(text);
  const safeText = `${formulaRisk ? "'" : ""}${text}`;
  return `"${safeText.replace(/"/g, '""')}"`;
};

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

export const exportReportByCompanyExcel = (dataset: ReportByCompanyDataset) => {
  const header = [
    ...(dataset.isConsolidated ? ["Empresa"] : []),
    ...dataset.fixedColumns.map((column) => column.label),
    ...dataset.dynamicColumns.map((column) => column.rubricName),
  ];
  const consolidatedRows = dataset.companySections?.flatMap((companyDataset) =>
    companyDataset.rows.map((row) => [
      companyDataset.companyName,
      row.name,
      row.department,
      row.jobRole,
      row.admissionRegistration,
      ...dataset.dynamicColumns.map((column) => row.rubricValues[column.rubricId] ?? 0),
    ])
  );
  const lines = [
    [dataset.title],
    [],
    header,
    ...(dataset.isConsolidated && consolidatedRows
      ? consolidatedRows
      : dataset.rows.map((row) => [
          row.name,
          row.department,
          row.jobRole,
          row.admissionRegistration,
          ...dataset.dynamicColumns.map((column) => row.rubricValues[column.rubricId] ?? 0),
        ])),
    dataset.isConsolidated
      ? [
          "TOTAL GERAL",
          "",
          "",
          "",
          "",
          ...dataset.dynamicColumns.map((column) => dataset.totalsByRubricId[column.rubricId] ?? 0),
        ]
      : [
          "TOTAL",
          "",
          "",
          "",
          ...dataset.dynamicColumns.map((column) => dataset.totalsByRubricId[column.rubricId] ?? 0),
        ],
  ];

  const csv = lines.map((line) => line.map((cell) => safeCsvCell(cell)).join(";")).join("\n");

  // Comentário: exportação Excel atual do produto usa CSV UTF-8 compatível com Excel.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = buildReportFileName(dataset, "csv");
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exportação CSV concluída.");
};
