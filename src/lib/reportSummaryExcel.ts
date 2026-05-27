import * as XLSX from "xlsx";
import type { ReportSummaryDataset } from "@/lib/reportSummaryData";
import { buildManagerialSummary } from "@/lib/reportSummaryManagerial";

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

  const managerial = buildManagerialSummary(dataset);
  const generatedAt = new Date().toLocaleString("pt-BR");
  const PCT_FORMAT = '0.0"%"';
  const rankingRows = managerial.ranking.slice(0, 5);

  const sheetData = [
    [{ v: dataset.title, t: "s" as const }],
    [{ v: `Gerado em ${generatedAt}`, t: "s" as const }],
    header.map((value) => ({ v: value, t: "s" as const })),
    ...mainRows.map(makeRow),
    [{ v: "", t: "s" as const }],
    ...summaryRows.map(makeRow),
    [{ v: "", t: "s" as const }],
    [{ v: "Resumo Gerencial para Aprovação", t: "s" as const }],
    [{ v: "Indicador", t: "s" as const }, { v: "Valor", t: "s" as const }],
    [{ v: "Total de Funcionários", t: "s" as const }, { v: managerial.totalEmployees, t: "n" as const, z: "0" }],
    [{ v: "Rendimentos", t: "s" as const }, { v: managerial.rendimentos, t: "n" as const, z: BRL_FORMAT }],
    [{ v: "Descontos", t: "s" as const }, { v: managerial.descontos, t: "n" as const, z: BRL_FORMAT }],
    [{ v: "Salário Líquido", t: "s" as const }, { v: managerial.salarioLiquido, t: "n" as const, z: BRL_FORMAT }],
    [{ v: "Custo Médio por Func.", t: "s" as const }, { v: managerial.custoMedioPorFuncionario, t: "n" as const, z: BRL_FORMAT }],
    [{ v: "", t: "s" as const }],
    [{ v: "Ranking por Setor / Empresa", t: "s" as const }],
    [
      { v: "#", t: "s" as const },
      { v: "Setor / Empresa", t: "s" as const },
      { v: "Funcionários", t: "s" as const },
      { v: "Salário Líquido", t: "s" as const },
      { v: "% do Total", t: "s" as const },
    ],
    ...rankingRows.map((item, index) => [
      { v: index + 1, t: "n" as const, z: "0" },
      { v: item.name, t: "s" as const },
      { v: item.employees, t: "n" as const, z: "0" },
      { v: item.salarioLiquido, t: "n" as const, z: BRL_FORMAT },
      { v: item.percentOfTotal / 100, t: "n" as const, z: PCT_FORMAT },
    ]),
    [
      { v: "TOTAL", t: "s" as const },
      { v: "", t: "s" as const },
      { v: managerial.totalEmployees, t: "n" as const, z: "0" },
      { v: managerial.salarioLiquido, t: "n" as const, z: BRL_FORMAT },
      { v: managerial.salarioLiquido > 0 ? 1 : 0, t: "n" as const, z: PCT_FORMAT },
    ],
    [{ v: "", t: "s" as const }],
    [{ v: "Composição da Folha", t: "s" as const }],
    [
      { v: "Grupo", t: "s" as const },
      { v: "Valor", t: "s" as const },
      { v: "%", t: "s" as const },
    ],
    ...managerial.composition.map((item) => [
      { v: item.label, t: "s" as const },
      { v: item.value, t: "n" as const, z: BRL_FORMAT },
      { v: item.percent / 100, t: "n" as const, z: PCT_FORMAT },
    ]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData as never);

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
