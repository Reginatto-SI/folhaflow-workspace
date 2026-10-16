import jsPDF from "jspdf";
import autoTable, { type Table } from "jspdf-autotable";

export type DashboardPdfIndicator = {
  label: string;
  current: string;
  previous: string;
  difference: string;
  percentage: string;
};

// Somente valores já apresentados no Dashboard; não recebe folhas ou dados pessoais.
export type DashboardPdfData = {
  baseCompetence: { month: number; year: number; label: string };
  comparisonLabel: string | null;
  companyName: string;
  statuses: { period: string; competence: string; summary: string; detail: string | null }[];
  provisional: boolean;
  indicators: DashboardPdfIndicator[];
  indicatorNotes: string[];
  evolution: [string, string, string][];
  highlights: [string, string, string][];
  ranking: [string, string, string, string, string, string][];
  composition: DashboardPdfIndicator[];
};

const FOOTER = "Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030";
const TITLE = "DASHBOARD GERENCIAL — FOLHA DE PAGAMENTO";
const PROVISIONAL = "Os valores apresentados podem sofrer alterações enquanto houver folhas em andamento.";

const filename = ({ baseCompetence, companyName }: DashboardPdfData) => {
  const company = companyName.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100) || "Empresa";
  return `Dashboard_Folha_${baseCompetence.year}-${String(baseCompetence.month).padStart(2, "0")}_${company}.pdf`;
};

export const generateDashboardPdf = async (data: DashboardPdfData) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 12;
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const usableWidth = width - margin * 2;
  let y = 22;

  const table = (title: string | null, head: string[], rows: string[][], firstColumnWidth: number, numeric = true, textColumns: number[] = []) => {
    if (y + 32 > height - 16) {
      doc.addPage();
      y = 22;
    }
    if (title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text(title, margin, y + 3);
      y += 6;
    }
    autoTable(doc, {
      startY: y,
      head: head.length ? [head] : [],
      body: rows.map((row) => row.map((cell) => cell.replace(/\u00a0/g, " "))),
      margin: { left: margin, right: margin, top: 22, bottom: 16 },
      tableWidth: usableWidth,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1, overflow: "linebreak", valign: "middle", textColor: [31, 41, 55], lineColor: [203, 213, 225], lineWidth: 0.1, halign: numeric ? "right" : "left" },
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: firstColumnWidth, halign: "left" }, ...Object.fromEntries(textColumns.map((column) => [column, { halign: "left" }])) },
      showHead: "everyPage",
      rowPageBreak: "avoid",
      didParseCell: ({ cell, column }) => {
        if (column.index === 0 || textColumns.includes(column.index)) cell.styles.halign = "left";
      },
    });
    y = (doc as jsPDF & { lastAutoTable: Table }).lastAutoTable.finalY + 3;
  };
  const indicatorRows = (rows: DashboardPdfIndicator[]) => rows.map((row) =>
    [row.label, row.current, row.previous, row.difference, row.percentage]);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(31, 41, 55);
  for (const text of [
    `Competência base: ${data.baseCompetence.label}`,
    ...(data.comparisonLabel ? [`Comparação: ${data.comparisonLabel}`] : []),
    `Empresa: ${data.companyName}`,
    `Gerado em: ${new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
  ]) {
    const lines: string[] = doc.splitTextToSize(text, usableWidth);
    for (const line of lines) {
      if (y + 5 > height - 16) { doc.addPage(); y = 22; }
      doc.text(line, margin, y + 3);
      y += 4.5;
    }
  }
  y += 3;
  table("Status operacional das folhas", ["Período", "Competência", "Situação registrada"], data.statuses.map((status) =>
    [status.period, status.competence, [status.summary, status.detail].filter(Boolean).join("\n")]), 36, false);
  if (data.provisional) table(null, [], [[PROVISIONAL]], usableWidth, false);
  table("Resumo dos indicadores", ["Indicador", "Atual", "Anterior", "Diferença", "Variação %"], indicatorRows(data.indicators), 78);
  if (data.indicatorNotes.length) table(null, [], data.indicatorNotes.map((note) => [note]), usableWidth, false);
  if (data.evolution.length) table("Evolução por competência", ["Competência", "Rendimentos Adicionais", "Salário Líquido"], data.evolution, 60);
  if (data.highlights.length) table("Principais variações", ["Indicador", "Empresa", "Variação"], data.highlights, 78, true, [1]);
  if (data.ranking.length) table("Ranking de variação por empresa", ["Empresa", "Atual", "Anterior", "Diferença R$", "Diferença %", "Funcionários\nDiferença"], data.ranking, 84);
  if (data.composition.length) table("Composição da variação", ["Grupo", "Atual", "Anterior", "Diferença", "Variação %"], indicatorRows(data.composition), 78);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(31, 41, 55);
    doc.text(TITLE, margin, 12);
    doc.setDrawColor(196, 21, 28);
    doc.setLineWidth(0.6);
    doc.line(margin, 16, width - margin, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(FOOTER, width / 2, height - 8, { align: "center" });
    doc.text(`Página ${page} de ${pages}`, width / 2, height - 4, { align: "center" });
  }
  await doc.save(filename(data), { returnPromise: true });
};
