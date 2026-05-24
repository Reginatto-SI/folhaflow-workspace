import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportSummaryDataset } from "@/lib/reportSummaryData";

// Comentário: PDF do Resumo Completo da Folha — fiel ao modelo legado "Resumo Completo DF.pdf".
// Reaproveita jsPDF + autoTable (mesma stack do relatório por empresa). Não recalcula nada;
// apenas consolida visualmente o dataset já agregado por `buildReportSummaryData`.

const FOOTER_TEXT = "Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030";

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

  // Colunas: [Rubrica] + [empresa…] + [TOTAL] + [SEM MOV.]
  const companyColumns = dataset.companies;
  const totalNumericCols = companyColumns.length + 2;
  const firstColWidth = 32; // primeira coluna mais larga (modelo legado).
  const numericColWidth = Math.max(8, (usableWidth - firstColWidth) / totalNumericCols);

  const head = [
    [
      "Renda",
      ...companyColumns.map((c) => abbreviate(c.name)),
      "TOTAL",
      "SEM MOV.",
    ],
  ];

  // Comentário: linha headcount usa inteiros; demais usam BRL.
  const formatCell = (value: number, isInteger?: boolean) =>
    isInteger ? String(Math.round(value)) : formatBRL(value);

  const body = dataset.rows.map((row) => [
    row.label,
    ...companyColumns.map((c) => formatCell(row.valuesByCompanyId[c.id] ?? 0, row.isInteger)),
    formatCell(row.total, row.isInteger),
    formatCell(row.semMov, row.isInteger),
  ]);

  // Mapa de destaque por índice de linha (para didParseCell).
  const boldRowIndexes = new Set<number>();
  dataset.rows.forEach((row, idx) => {
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
      fillColor: [71, 85, 105],         // cinza escuro (slate-600)
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      minCellHeight: 6,
      fontSize: 5.2,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: firstColWidth, halign: "left", fontStyle: "bold" },
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
      const row = dataset.rows[rowIndex];
      if (!row) return;

      // Headcount alinhado ao centro; demais valores à direita.
      if (row.kind === "headcount" && hookData.column.index > 0) {
        hookData.cell.styles.halign = "center";
      }

      // Linhas com destaque: fundo cinza claro + negrito.
      if (boldRowIndexes.has(rowIndex)) {
        hookData.cell.styles.fillColor = [226, 232, 240];
        hookData.cell.styles.fontStyle = "bold";
      }

      // Coluna TOTAL (penúltima) e SEM MOV. (última) sempre em negrito.
      const lastIndex = totalNumericCols; // 0=label, depois empresas, depois TOTAL, SEM MOV.
      if (hookData.column.index === lastIndex - 1 || hookData.column.index === lastIndex) {
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

  doc.save(buildFileName(dataset.month, dataset.year));
};
