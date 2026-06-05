import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportByCompanyDataset, ReportDynamicColumn } from "@/lib/reportByCompanyData";

const FOOTER_TEXT = "Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030";
const DARK_HIGHLIGHT: [number, number, number] = [71, 85, 105];
const LIGHT_ROW_HIGHLIGHT: [number, number, number] = [241, 245, 249];
const RESULT_HEAD_HIGHLIGHT: [number, number, number] = [82, 97, 121];
const BORDER_LIGHT: [number, number, number] = [180, 188, 200];
const TEXT_LIGHT: [number, number, number] = [255, 255, 255];

export const formatPdfCurrencyBlankWhenZero = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return "";

  const numericValue = typeof value === "number"
    ? value
    : Number(String(value).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(numericValue)) return "";

  // Comentário: no PDF, valores monetários zerados ficam em branco para reduzir ruído visual; o número original não é alterado.
  if (Math.round(numericValue * 100) === 0) return "";

  // Comentário: formatação BRL somente na exibição do PDF, sem alterar cálculo, totais ou payload da folha.
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numericValue).replace(/\u00a0/g, " ");
};

const formatAdmissionRegistrationForPrint = (value: string): string => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const [datePart, ...rest] = text.split("/").map((part) => part.trim()).filter(Boolean);
  const isoDateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!isoDateMatch) return text;
  const [, year, month, day] = isoDateMatch;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  const isValidDate = parsedDate.getFullYear() === Number(year) && parsedDate.getMonth() === Number(month) - 1 && parsedDate.getDate() === Number(day);
  if (!isValidDate) return text;
  const formattedDate = `${day}/${month}/${year}`;
  return rest.length > 0 ? `${formattedDate} / ${rest.join(" / ")}` : formattedDate;
};

const PDF_LABEL_ALIASES: Record<string, string> = {
  "nome": "Nome", "setor": "Setor", "função/cargo": "Função/\nCargo", "funcao/cargo": "Função/\nCargo",
  "admissão/registro": "Admissão/\nRegistro", "admissao/registro": "Admissão/\nRegistro", "salário ctps": "Salário\nCTPS", "salario ctps": "Salário\nCTPS",
  "salário g": "Salário\nG", "salario g": "Salário\nG", "salário fiscal": "Salário\nFiscal", "salario fiscal": "Salário\nFiscal",
  "(+) outros rendim.": "(+)\nOutros\nRendim.", "(+) horas extras": "(+)\nHoras\nExtras", "(+) 1/3 de férias": "(+)\n1/3\nFérias",
  "(+) 1/3 de ferias": "(+)\n1/3\nFérias", "(+) premio/desemp.": "(+)\nPrêmio/\nDesemp.", "(+) prêmio/desemp.": "(+)\nPrêmio/\nDesemp.",
  "(-)inss": "(-)\nINSS", "(-) emprést. consig.": "(-)\nEmpr.\nConsig.", "(-) emprest. consig.": "(-)\nEmpr.\nConsig.",
  "(-) adiant geren.": "(-)\nAdiant.\nGeren.", "(-) vales/descontos": "(-)\nVales/\nDesc.", "(-) faltas/descontos": "(-)\nFaltas/\nDesc.",
  "salário real": "Salário\nReal", "salario real": "Salário\nReal", "salário g2 complem.": "Salário G2\nComplem.", "salario g2 complem.": "Salário G2\nComplem.",
  "salário líquido": "Salário\nLíquido", "salario liquido": "Salário\nLíquido",
};

const normalizePdfLabelKey = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s*\/\s*/g, "/").replace(/\(\+\)\s+/g, "(+) ").replace(/\(-\)\s+/g, "(-)").replace(/\s+/g, " ").trim();
const RESULT_COLUMN_KEYS = new Set(["salario fiscal", "salario_fiscal", "sal fiscal", "salario real", "salario_real", "salario g2 complem.", "salario g2 complemento", "g2 complemento", "g2_complemento", "salario_g2_complem", "salario_g2_complemento", "salario liquido", "salario_liquido"]);
const isResultColumn = (label: string, code: string): boolean => RESULT_COLUMN_KEYS.has(normalizePdfLabelKey(label)) || RESULT_COLUMN_KEYS.has(normalizePdfLabelKey(code));
const formatPdfColumnLabel = (label: string): string => {
  const sanitized = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!sanitized) return "";
  const alias = PDF_LABEL_ALIASES[normalizePdfLabelKey(sanitized)];
  if (alias) return alias;
  return sanitized;
};


export type PayrollPdfDynamicColumn = ReportDynamicColumn;

type OfficialPayrollPdfColumnRule = {
  key: string;
  isResultColumn?: boolean;
  matches: (column: ReportDynamicColumn) => boolean;
};

const normalizePdfColumnToken = (value: string): string =>
  normalizePdfLabelKey(value).replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

const columnTokens = (column: ReportDynamicColumn) => [
  column.rubricCode,
  column.rubricName,
].map(normalizePdfColumnToken);

const hasClassification = (column: ReportDynamicColumn, classification: string) =>
  column.rubricClassification === classification;

const hasAnyToken = (column: ReportDynamicColumn, expectedTokens: string[]) => {
  const tokens = columnTokens(column);
  const normalizedExpected = expectedTokens.map(normalizePdfColumnToken);
  return normalizedExpected.some((expected) => tokens.some((token) => token === expected || token.includes(expected)));
};

const OFFICIAL_PAYROLL_PDF_COLUMN_RULES: OfficialPayrollPdfColumnRule[] = [
  { key: "salario_ctps", matches: (column) => hasClassification(column, "salario_ctps") },
  { key: "salario_g", matches: (column) => hasClassification(column, "salario_g") },
  {
    key: "outros_rendimentos",
    matches: (column) => hasClassification(column, "outros_rendimentos") && hasAnyToken(column, ["outros rendim", "outros rendimento", "outros rendimentos"]),
  },
  { key: "horas_extras", matches: (column) => hasClassification(column, "horas_extras") },
  { key: "ferias_terco", matches: (column) => hasClassification(column, "ferias_terco") },
  {
    key: "premio_desemp",
    matches: (column) => hasClassification(column, "outros_rendimentos") && hasAnyToken(column, ["premio desemp", "premio desempenho", "premio", "desemp"]),
  },
  { key: "emprestimos", matches: (column) => hasClassification(column, "emprestimos") },
  {
    key: "compra_ferias",
    matches: (column) => hasClassification(column, "outros_rendimentos") && hasAnyToken(column, ["compra ferias"]),
  },
  { key: "inss", matches: (column) => hasClassification(column, "inss") },
  { key: "vales", matches: (column) => hasClassification(column, "vales") },
  { key: "faltas", matches: (column) => hasClassification(column, "faltas") },
  {
    key: "salario_fiscal",
    isResultColumn: true,
    matches: (column) => hasAnyToken(column, ["salario fiscal", "sal fiscal", "salario_fiscal"]),
  },
  {
    key: "g2_complemento",
    isResultColumn: true,
    matches: (column) => hasAnyToken(column, ["salario g2 complem", "salario g2 complemento", "g2 complemento", "g2_complemento"]),
  },
  {
    key: "salario_liquido",
    isResultColumn: true,
    matches: (column) => hasAnyToken(column, ["salario liquido", "salario_liquido"]),
  },
];

const officialPayrollPdfColumnKeys = new WeakMap<ReportDynamicColumn, string>();

export const isHighlightedPayrollPdfColumn = (column: PayrollPdfDynamicColumn): boolean => {
  const officialKey = officialPayrollPdfColumnKeys.get(column);
  const officialRule = officialKey
    ? OFFICIAL_PAYROLL_PDF_COLUMN_RULES.find((rule) => rule.key === officialKey)
    : undefined;
  return Boolean(officialRule?.isResultColumn) || isResultColumn(column.rubricName, column.rubricCode);
};

export const buildPayrollPdfDynamicColumns = (dataset: ReportByCompanyDataset): PayrollPdfDynamicColumn[] => {
  const usedRubricIds = new Set<string>();

  // Comentário: a ordem do PDF segue a sequência oficial informada pelo produto.
  // Salário Real canônico é sempre removido e rubricas inexistentes não são inventadas.
  return OFFICIAL_PAYROLL_PDF_COLUMN_RULES.reduce<PayrollPdfDynamicColumn[]>((columns, rule) => {
    const column = dataset.dynamicColumns.find((candidate) =>
      !candidate.isCanonicalSalarioReal && !usedRubricIds.has(candidate.rubricId) && rule.matches(candidate)
    );
    if (!column) return columns;

    usedRubricIds.add(column.rubricId);
    officialPayrollPdfColumnKeys.set(column, rule.key);
    return [...columns, column];
  }, []);
};


const JOB_ROLE_MAX_PRINT_LENGTH = 22;
const JOB_ROLE_WORD_ALIASES: Record<string, string> = {
  auxiliar: "Aux.",
  ajudante: "Aj.",
  aj: "Aj.",
  assistente: "Assist.",
  administrativo: "Adm.",
  administrativos: "Adm.",
  producao: "Produção",
  maquina: "Máq.",
  maquinas: "Máq.",
  servico: "Serv.",
  servicos: "Serv.",
};
const JOB_ROLE_PRINT_STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "sala"]);

export const formatJobRoleForPrint = (value: string): string => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  const words = text.split(" ").reduce<string[]>((acc, word, index, allWords) => {
    const normalizedWord = normalizePdfColumnToken(word);
    if (!normalizedWord) return acc;
    if (JOB_ROLE_PRINT_STOPWORDS.has(normalizedWord)) return acc;
    // Comentário: sufixos isolados como "O" em cargos legados poluem o PDF e fazem a coluna quebrar linha; removemos só na impressão.
    if (normalizedWord.length === 1 && index === allWords.length - 1) return acc;
    acc.push(JOB_ROLE_WORD_ALIASES[normalizedWord] ?? word);
    return acc;
  }, []);

  const compactText = (words.length > 0 ? words.join(" ") : text).replace(/\s+/g, " ").trim();
  if (compactText.length <= JOB_ROLE_MAX_PRINT_LENGTH) return compactText;

  // Comentário: truncamento controlado apenas na saída do PDF para evitar que Função/Cargo aumente a altura da linha inteira.
  return `${compactText.slice(0, JOB_ROLE_MAX_PRINT_LENGTH - 1).trimEnd()}…`;
};

const normalizeFileToken = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const buildReportFileName = (companyName: string, month: number, year: number): string => {
  const competence = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return `${normalizeFileToken(companyName || "empresa")}-${normalizeFileToken(competence || `${month}-${year}`)}.pdf`;
};

export const generateReportByCompanyPdf = (dataset: ReportByCompanyDataset) => {
  const generatedAtLabel = new Date().toLocaleDateString("pt-BR") + " às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 6;
  const marginRight = 6;
  const pageUsableWidth = pageWidth - marginLeft - marginRight;
  const pdfDynamicColumns = buildPayrollPdfDynamicColumns(dataset);
  const dynamicColumnCount = pdfDynamicColumns.length;

  // Comentário: alinhado ao padrão visual do resumo completo (nome ganha maior largura para leitura gerencial).
  const fixedColumnsWidth = {
    name: 32,
    department: 15,
    jobRole: 16,
    admissionRegistration: 13,
  };
  const reservedFixedWidth = fixedColumnsWidth.name + fixedColumnsWidth.department + fixedColumnsWidth.jobRole + fixedColumnsWidth.admissionRegistration;
  // Comentário: colunas monetárias ficam proporcionais e uniformes, reaproveitando a lógica de grade do relatório resumo completo.
  const numericColumnWidth = dynamicColumnCount > 0
    ? Math.max(5.9, (pageUsableWidth - reservedFixedWidth) / dynamicColumnCount)
    : 0;
  const bodyRowsLength = dataset.rows.length;
  const resultColumnIndexes = new Set(pdfDynamicColumns
    .map((column, index) => (isHighlightedPayrollPdfColumn(column) ? index + 4 : null))
    .filter((index): index is number => index !== null));

  autoTable(doc, {
    // Comentário: aumenta respiro entre cabeçalho (título/data) e tabela para leitura mais confortável.
    startY: 18,
    head: [[...dataset.fixedColumns.map((column) => formatPdfColumnLabel(column.label)), ...pdfDynamicColumns.map((column) => formatPdfColumnLabel(column.rubricName))]],
    body: [
      ...dataset.rows.map((row) => [row.name, row.department, formatJobRoleForPrint(row.jobRole), formatAdmissionRegistrationForPrint(row.admissionRegistration), ...pdfDynamicColumns.map((column) => formatPdfCurrencyBlankWhenZero(row.rubricValues[column.rubricId]))]),
      ["TOTAL", "", "", "", ...pdfDynamicColumns.map((column) => formatPdfCurrencyBlankWhenZero(dataset.totalsByRubricId[column.rubricId]))],
    ],
    tableWidth: pageUsableWidth,
    styles: {
      fontSize: 5.2,
      cellPadding: { top: 0.62, right: 0.5, bottom: 0.62, left: 0.5 },
      lineColor: BORDER_LIGHT,
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      // Comentário: cabeçalho escuro + texto claro padronizado com o PDF de resumo completo.
      fillColor: DARK_HIGHLIGHT,
      textColor: TEXT_LIGHT,
      fontStyle: "bold",
      minCellHeight: 5.8,
      halign: "center",
      valign: "middle",
      overflow: "linebreak",
      fontSize: 4.9,
    },
    columnStyles: {
      0: { cellWidth: fixedColumnsWidth.name, halign: "left", cellPadding: { top: 0.62, right: 0.5, bottom: 0.62, left: 1.3 } },
      1: { cellWidth: fixedColumnsWidth.department, halign: "left" },
      2: { cellWidth: fixedColumnsWidth.jobRole, halign: "left", overflow: "ellipsize" },
      3: { cellWidth: fixedColumnsWidth.admissionRegistration, halign: "center" },
      ...Object.fromEntries(
        pdfDynamicColumns.map((_, index) => [index + 4, { cellWidth: numericColumnWidth, minCellWidth: 5.9, halign: "right" }]),
      ),
    },
    didParseCell: (hookData) => {
      const isTotalRow = hookData.section === "body" && hookData.row.index === bodyRowsLength;

      const isFixedIdentityColumn = hookData.column.index >= 0 && hookData.column.index <= 3;
      const isResultValueColumn = resultColumnIndexes.has(hookData.column.index);

      if (hookData.section === "head" && isResultValueColumn) {
        // Comentário: cabeçalho das colunas finais ganha variação discreta, mantendo o padrão azul escuro.
        hookData.cell.styles.fillColor = RESULT_HEAD_HIGHLIGHT;
      }

      if (hookData.section === "body" && !isTotalRow && (isFixedIdentityColumn || isResultValueColumn)) {
        // Comentário: colunas destacadas usam fundo mais suave e texto em negrito para equilibrar leitura sem pesar a grade.
        hookData.cell.styles.fillColor = LIGHT_ROW_HIGHLIGHT;
        hookData.cell.styles.fontStyle = "bold";
      }

      if (isTotalRow) {
        // Comentário: TOTAL usa o mesmo azul escuro do cabeçalho para fechar visualmente a tabela e evitar destaque cinza fraco.
        hookData.cell.styles.fillColor = DARK_HIGHLIGHT;
        hookData.cell.styles.textColor = TEXT_LIGHT;
        hookData.cell.styles.fontStyle = "bold";
        // Comentário: altura mínima diferencia o TOTAL das linhas comuns sem mudar a estrutura da tabela.
        hookData.cell.styles.minCellHeight = 4.8;
        hookData.cell.styles.lineWidth = { top: 0.25, right: 0.1, bottom: 0.1, left: 0.1 };
      }

      if (hookData.section === "body" && hookData.column.index >= 4) {
        hookData.cell.styles.halign = "right";
      }
      if (hookData.section === "body" && hookData.column.index <= 2) {
        hookData.cell.styles.halign = "left";
      }
      if (hookData.section === "body" && hookData.column.index === 3) {
        hookData.cell.styles.halign = "center";
      }
    },
    didDrawPage: () => {
      // Comentário: título centralizado e data à direita para paridade visual com o relatório resumo completo.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(dataset.title, pageWidth / 2, 9, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Gerado em ${generatedAtLabel}`, pageWidth - marginRight, 13, { align: "right" });
      doc.setFontSize(7);
      doc.text(FOOTER_TEXT, pageWidth / 2, pageHeight - 4, { align: "center" });
    },
    margin: { top: 18, bottom: 9, left: marginLeft, right: marginRight },
    theme: "grid",
    showHead: "everyPage",
  });

  doc.save(buildReportFileName(dataset.companyName, dataset.month, dataset.year));
};
