import * as XLSX from "xlsx";
import type { ReportSummaryDataset } from "@/lib/reportSummaryData";

const normalizeFileToken = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const buildFileName = (dataset: ReportSummaryDataset) =>
  `resumo-completo-folha-${normalizeFileToken(dataset.competenceLabel || `${dataset.month}-${dataset.year}`)}.xlsx`;

const BRL_FORMAT = '[$R$-416] #,##0.00';

const TABLE_HEADER_ROW_INDEX = 2;

export const generateReportSummaryExcel = (dataset: ReportSummaryDataset) => {
  // Comentário: o Excel usa exatamente o mesmo dataset consolidado do PDF
  // (`buildReportSummaryData`) para evitar divergência entre saídas.
  const mainRows = dataset.rows.filter((row) => !["rendimentos", "descontos", "custo_medio"].includes(row.kind));
  const summaryRows = dataset.rows.filter((row) => ["rendimentos", "descontos", "custo_medio"].includes(row.kind));

  const header = ["Renda", ...dataset.companies.map((company) => company.name), "TOTAL", "SEM IMOB."];

  const formatNumberCell = (value: number, isInteger?: boolean) => ({
    v: Number.isFinite(value) ? value : 0,
    t: "n" as const,
    z: isInteger ? "0" : BRL_FORMAT,
  });

  const makeRow = (row: ReportSummaryDataset["rows"][number]) => [
    { v: row.label, t: "s" as const },
    ...dataset.companies.map((company) => formatNumberCell(row.valuesByCompanyId[company.id] ?? 0, row.isInteger)),
    formatNumberCell(row.total, row.isInteger),
    formatNumberCell(row.semImob, row.isInteger),
  ];

  const generatedAt = new Date().toLocaleString("pt-BR");
  const sheetData = [
    [{ v: dataset.title, t: "s" as const }],
    [{ v: `Gerado em ${generatedAt}`, t: "s" as const }],
    header.map((value) => ({ v: value, t: "s" as const })),
    ...mainRows.map(makeRow),
    [{ v: "", t: "s" as const }],
    ...summaryRows.map(makeRow),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData as XLSX.AOA2SheetOpts<any>);

  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: header.length - 1, r: sheetData.length - 1 },
  });

  worksheet["!cols"] = [
    { wch: 28 },
    ...dataset.companies.map(() => ({ wch: 14 })),
    { wch: 14 },
    { wch: 14 },
  ];


  // Observação técnica: a edição comunitária de `xlsx` não aplica estilos visuais
  // completos (fill/font/border) de forma confiável em todas as suítes.
  // Por isso mantemos refinos seguros: largura, congelamento, filtro e formato numérico.
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { c: 0, r: TABLE_HEADER_ROW_INDEX },
      e: { c: header.length - 1, r: TABLE_HEADER_ROW_INDEX },
    }),
  };

  // Congela o cabeçalho da tabela (linha "Renda...") para manter leitura em rolagem.
  (worksheet as XLSX.WorkSheet & { "!freeze"?: { xSplit: number; ySplit: number } })["!freeze"] = {
    xSplit: 1,
    ySplit: TABLE_HEADER_ROW_INDEX + 1,
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Resumo Completo");
  XLSX.writeFile(workbook, buildFileName(dataset));
};
