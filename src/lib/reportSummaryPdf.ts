import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportSummaryDataset } from "@/lib/reportSummaryData";
import { buildManagerialSummary } from "@/lib/reportSummaryManagerial";

// Comentário: PDF do Resumo Completo da Folha — fiel ao modelo legado "Resumo Completo DF.pdf".
// Reaproveita jsPDF + autoTable (mesma stack do relatório por empresa). Não recalcula nada;
// apenas consolida visualmente o dataset já agregado por `buildReportSummaryData`.

const FOOTER_TEXT = "Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030";
const DARK_HIGHLIGHT: [number, number, number] = [71, 85, 105];
const LIGHT_ROW_HIGHLIGHT: [number, number, number] = [226, 232, 240];
const CARD_BACKGROUND: [number, number, number] = [248, 250, 252];
const BORDER_LIGHT: [number, number, number] = [203, 213, 225];
const TEXT_LIGHT: [number, number, number] = [255, 255, 255];
const TEXT_DARK: [number, number, number] = [31, 41, 55];

const formatBRL = (value: number) =>
  `R$${(Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

const buildFileName = (month: number, year: number) => {
  const competence = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return `resumo-folha-${normalizeFileToken(competence || `${month}-${year}`)}.pdf`;
};

// Abrevia nomes longos de empresa para caber nas colunas (modelo legado também abrevia).
const abbreviate = (name: string, maxLen = 14) => {
  const cleaned = String(name ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1).trimEnd() + "…";
};

export const generateReportSummaryPdf = (dataset: ReportSummaryDataset) => {
  const generatedAtLabel =
    new Date().toLocaleDateString("pt-BR") +
    " às " +
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 6;
  const marginRight = 6;
  const usableWidth = pageWidth - marginLeft - marginRight;

  // Colunas: [Rubrica] + [empresa…] + [TOTAL] + [SEM IMOB.]
  const companyColumns = dataset.companies;
  const totalNumericCols = companyColumns.length + 2;
  const firstColWidth = 32; // primeira coluna mais larga (modelo legado).
  const numericColWidth = Math.max(8, (usableWidth - firstColWidth) / totalNumericCols);
  const totalColIndex = totalNumericCols - 1;
  const semImobColIndex = totalNumericCols;

  const head = [
    [
      "Renda",
      ...companyColumns.map((c) => abbreviate(c.name)),
      "TOTAL",
      "SEM IMOB.",
    ],
  ];

  // Comentário: linha headcount usa inteiros; demais usam BRL.
  const formatCell = (value: number, isInteger?: boolean) =>
    isInteger ? String(Math.round(value)) : formatBRL(value);

  const mainRows = dataset.rows.filter((row) => !["rendimentos", "descontos", "custo_medio"].includes(row.kind));
  const summaryRows = dataset.rows.filter((row) => ["rendimentos", "descontos", "custo_medio"].includes(row.kind));

  const body = mainRows.map((row) => [
    row.label,
    ...companyColumns.map((c) => formatCell(row.valuesByCompanyId[c.id] ?? 0, row.isInteger)),
    formatCell(row.total, row.isInteger),
    formatCell(row.semImob, row.isInteger),
  ]);

  // Mapa de destaque por índice de linha (para didParseCell).
  const boldRowIndexes = new Set<number>();
  mainRows.forEach((row, idx) => {
    if (row.isBold) boldRowIndexes.add(idx);
  });

  autoTable(doc, {
    startY: 16,
    head,
    body,
    tableWidth: usableWidth,
    styles: {
      fontSize: 5.4,
      cellPadding: { top: 0.7, right: 0.6, bottom: 0.7, left: 0.6 },
      lineColor: [180, 188, 200],
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: DARK_HIGHLIGHT,         // cinza escuro (slate-600)
      textColor: TEXT_LIGHT,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      minCellHeight: 6,
      fontSize: 5.2,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: firstColWidth, halign: "left", fontStyle: "bold", fillColor: DARK_HIGHLIGHT, textColor: TEXT_LIGHT },
      ...Object.fromEntries(
        Array.from({ length: totalNumericCols }).map((_, i) => [
          i + 1,
          { cellWidth: numericColWidth, halign: "right" },
        ]),
      ),
    },
    didParseCell: (hookData) => {
      if (hookData.section !== "body") return;
      const rowIndex = hookData.row.index;
      const row = mainRows[rowIndex];
      if (!row) return;

      // Headcount alinhado ao centro; demais valores à direita.
      if (row.kind === "headcount" && hookData.column.index > 0) {
        hookData.cell.styles.halign = "center";
      }

      // Linhas com destaque: fundo cinza claro + negrito.
      if (boldRowIndexes.has(rowIndex)) {
        hookData.cell.styles.fillColor = LIGHT_ROW_HIGHLIGHT;
        hookData.cell.styles.textColor = TEXT_DARK;
        hookData.cell.styles.fontStyle = "bold";
      }

      // TOTAL e SEM IMOB. recebem o mesmo destaque da coluna Renda por legibilidade e aderência ao legado.
      // Também garantimos contraste: texto claro apenas quando o fundo está escuro.
      if (hookData.column.index === totalColIndex || hookData.column.index === semImobColIndex) {
        hookData.cell.styles.fillColor = DARK_HIGHLIGHT;
        hookData.cell.styles.textColor = TEXT_LIGHT;
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      // Título + subtítulo (data/hora) no topo.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(dataset.title, pageWidth / 2, 9, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Gerado em ${generatedAtLabel}`, pageWidth - marginRight, 13, { align: "right" });
      doc.text(FOOTER_TEXT, pageWidth / 2, pageHeight - 4, { align: "center" });
    },
    margin: { top: 16, bottom: 8, left: marginLeft, right: marginRight },
    theme: "grid",
    showHead: "everyPage",
  });

  // Bloco inferior separado (Rendimentos, Descontos, Custo médio por Func.), igual ao legado.
  const summaryBody = summaryRows.map((row) => [
    row.label,
    ...companyColumns.map((c) => formatCell(row.valuesByCompanyId[c.id] ?? 0, row.isInteger)),
    formatCell(row.total, row.isInteger),
    formatCell(row.semImob, row.isInteger),
  ]);
  const summaryBoldRows = new Set<number>();
  summaryRows.forEach((row, idx) => {
    if (row.isBold) summaryBoldRows.add(idx);
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 3 : 20,
    body: summaryBody,
    tableWidth: usableWidth,
    styles: {
      fontSize: 5.4,
      cellPadding: { top: 0.7, right: 0.6, bottom: 0.7, left: 0.6 },
      lineColor: [180, 188, 200],
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: firstColWidth, halign: "left", fontStyle: "bold", fillColor: DARK_HIGHLIGHT, textColor: TEXT_LIGHT },
      ...Object.fromEntries(
        Array.from({ length: totalNumericCols }).map((_, i) => [
          i + 1,
          { cellWidth: numericColWidth, halign: "right" },
        ]),
      ),
    },
    didParseCell: (hookData) => {
      if (hookData.section !== "body") return;
      const rowIndex = hookData.row.index;
      if (summaryBoldRows.has(rowIndex)) {
        // Contraste: no bloco inferior, a 1ª coluna segue fundo escuro e precisa de fonte clara.
        // Nas demais colunas com fundo claro, mantemos fonte escura para legibilidade.
        hookData.cell.styles.textColor = hookData.column.index === 0 ? TEXT_LIGHT : TEXT_DARK;
        hookData.cell.styles.fontStyle = "bold";
      }

      // TOTAL e SEM IMOB. com o mesmo destaque da primeira coluna, mantendo contraste forte para leitura.
      if (hookData.column.index === totalColIndex || hookData.column.index === semImobColIndex) {
        hookData.cell.styles.fillColor = DARK_HIGHLIGHT;
        hookData.cell.styles.textColor = TEXT_LIGHT;
        hookData.cell.styles.fontStyle = "bold";
      }
    },
    margin: { bottom: 8, left: marginLeft, right: marginRight },
    theme: "grid",
  });


  // Comentário: seção gerencial reutiliza exclusivamente o dataset já consolidado, sem recalcular a folha.
  const managerial = buildManagerialSummary(dataset);
  const pct = (value: number) => `${(Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const requiredHeightForSection = 76;
  const mainFinalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY : 40;
  const availableHeight = pageHeight - 10 - mainFinalY;
  let sectionStartY = mainFinalY + 6;
  if (availableHeight < requiredHeightForSection) {
    doc.addPage();
    sectionStartY = 18;
  }

  doc.setDrawColor(...BORDER_LIGHT);
  doc.setLineWidth(0.2);
  doc.setFillColor(...LIGHT_ROW_HIGHLIGHT);
  doc.roundedRect(marginLeft, sectionStartY - 5, usableWidth, 8, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(9);
  doc.text("Resumo Gerencial para Aprovação", marginLeft + 2, sectionStartY);

  const cardsTopY = sectionStartY + 2.5;
  const cardGap = 2;
  const cardsPerRow = 5;
  const cardWidth = (usableWidth - cardGap * (cardsPerRow - 1)) / cardsPerRow;
  const cardHeight = 12;
  const metrics = [
    { label: "Total de Funcionários", value: String(managerial.totalEmployees) },
    { label: "Rendimentos", value: formatBRL(managerial.rendimentos) },
    { label: "Descontos", value: formatBRL(managerial.descontos) },
    { label: "Salário Líquido", value: formatBRL(managerial.salarioLiquido) },
    { label: "Custo Médio por Func.", value: formatBRL(managerial.custoMedioPorFuncionario) },
  ];

  metrics.forEach((metric, idx) => {
    const row = Math.floor(idx / cardsPerRow);
    const col = idx % cardsPerRow;
    const x = marginLeft + col * (cardWidth + cardGap);
    const y = cardsTopY + row * (cardHeight + 2);
    doc.setFillColor(...CARD_BACKGROUND);
    doc.setDrawColor(...BORDER_LIGHT);
    doc.roundedRect(x, y, cardWidth, cardHeight, 1, 1, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(71, 85, 105);
    doc.text(metric.label, x + 1.3, y + 4.1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    doc.setTextColor(...TEXT_DARK);
    doc.text(metric.value, x + 1.3, y + 8.8);
  });

  // Grid fixo de duas colunas para manter alinhamento e evitar "vazio" exagerado entre blocos.
  const blocksGap = 6;
  const leftBlockWidth = usableWidth * 0.56;
  const rightBlockWidth = usableWidth - leftBlockWidth - blocksGap;
  const leftBlockX = marginLeft;
  const rightBlockX = marginLeft + leftBlockWidth + blocksGap;
  const tablesStartY = cardsTopY + cardHeight + 6;
  const rankingBody = managerial.ranking
    .slice(0, 5)
    .map((item, index) => [String(index + 1), item.name, String(item.employees), formatBRL(item.salarioLiquido), pct(item.percentOfTotal)]);
  // Linha TOTAL no PDF deve ser explícita para não depender de item "TOTAL" no ranking de origem.
  rankingBody.push([
    "",
    "TOTAL",
    String(managerial.totalEmployees),
    formatBRL(managerial.salarioLiquido),
    managerial.salarioLiquido > 0 ? "100,0%" : "0,0%",
  ]);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...TEXT_DARK);
  doc.text("Ranking por Setor / Empresa", leftBlockX, tablesStartY - 1.7);
  doc.text("Composição da Folha", rightBlockX, tablesStartY - 1.7);

  autoTable(doc, {
    startY: tablesStartY,
    head: [["#", "Setor / Empresa", "Funcionários", "Salário Líquido", "% do Total"]],
    body: rankingBody,
    tableWidth: leftBlockWidth,
    margin: { left: leftBlockX, right: marginRight },
    styles: { fontSize: 6.1, cellPadding: { top: 1.1, right: 1, bottom: 1.1, left: 1 }, lineColor: BORDER_LIGHT, lineWidth: 0.1 },
    headStyles: { fillColor: LIGHT_ROW_HIGHLIGHT, textColor: TEXT_DARK, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: leftBlockWidth * 0.07, halign: "center" }, 1: { cellWidth: leftBlockWidth * 0.41 }, 2: { cellWidth: leftBlockWidth * 0.17, halign: "right" }, 3: { cellWidth: leftBlockWidth * 0.22, halign: "right" }, 4: { cellWidth: leftBlockWidth * 0.13, halign: "right" } },
    theme: "grid",
    didDrawPage: () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.4);
      doc.setTextColor(...TEXT_DARK);
      doc.text("Ranking por Setor / Empresa", marginLeft + 0.6, tablesStartY - 1.6);
    },
  });

  autoTable(doc, {
    startY: tablesStartY,
    head: [["Grupo", "Valor", "%"]],
    body: managerial.composition.map((item) => [item.label, formatBRL(item.value), pct(item.percent)]),
    tableWidth: rightBlockWidth,
    margin: { left: rightBlockX, right: marginRight, bottom: 8 },
    styles: { fontSize: 6.1, cellPadding: { top: 1.1, right: 1, bottom: 1.1, left: 1 }, lineColor: BORDER_LIGHT, lineWidth: 0.1 },
    headStyles: { fillColor: LIGHT_ROW_HIGHLIGHT, textColor: TEXT_DARK, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: rightBlockWidth * 0.50 }, 1: { cellWidth: rightBlockWidth * 0.32, halign: "right" }, 2: { cellWidth: rightBlockWidth * 0.18, halign: "right" } },
    theme: "grid",
    didParseCell: (hookData) => {
      if (hookData.section !== "body") return;
      const label = String(hookData.row.raw?.[0] ?? "");
      if (label === "Salário Líquido" || label === "Total da Folha / Rendimentos") {
        hookData.cell.styles.fillColor = LIGHT_ROW_HIGHLIGHT;
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save(buildFileName(dataset.month, dataset.year));
};
