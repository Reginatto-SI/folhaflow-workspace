import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ReportByCompanyDataset } from "@/lib/reportByCompanyData";

const FOOTER_TEXT = "Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030";

const formatPdfCurrency = (value: number | string) => {
  const numericValue = typeof value === "number"
    ? value
    : Number(String(value).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", "."));
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return safeValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
const formatPdfColumnLabel = (label: string): string => {
  const sanitized = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!sanitized) return "";
  const alias = PDF_LABEL_ALIASES[normalizePdfLabelKey(sanitized)];
  if (alias) return alias;
  return sanitized;
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
  const pageUsableWidth = pageWidth - marginLeft - 6;

  autoTable(doc, {
    startY: 16,
    head: [[...dataset.fixedColumns.map((column) => formatPdfColumnLabel(column.label)), ...dataset.dynamicColumns.map((column) => formatPdfColumnLabel(column.rubricName))]],
    body: [
      ...dataset.rows.map((row) => [row.name, row.department, row.jobRole, formatAdmissionRegistrationForPrint(row.admissionRegistration), ...dataset.dynamicColumns.map((column) => formatPdfCurrency(row.rubricValues[column.rubricId] ?? 0))]),
      ["TOTAL", "", "", "", ...dataset.dynamicColumns.map((column) => formatPdfCurrency(dataset.totalsByRubricId[column.rubricId] ?? 0))],
    ],
    tableWidth: pageUsableWidth,
    styles: { fontSize: 4.8, cellPadding: 0.45, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [226, 232, 240], textColor: 15, halign: "center", overflow: "linebreak", fontSize: 4.6 },
    didDrawPage: () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(dataset.title, marginLeft, 9);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Gerado em ${generatedAtLabel}`, marginLeft, 13);
      doc.setFontSize(7); doc.text(FOOTER_TEXT, pageWidth / 2, pageHeight - 4, { align: "center" });
    },
    margin: { top: 16, bottom: 8, left: marginLeft, right: 6 },
    theme: "grid",
    showHead: "everyPage",
  });

  doc.save(buildReportFileName(dataset.companyName, dataset.month, dataset.year));
};
