import React from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayroll } from "@/contexts/PayrollContext";
import { buildReportByCompanyData } from "@/lib/reportByCompanyData";

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FOOTER_TEXT = "Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030";

const formatAdmissionRegistrationForPrint = (value: string): string => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const [datePart, ...rest] = text.split("/").map((part) => part.trim()).filter(Boolean);
  const isoDateMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!isoDateMatch) return text;

  const [, year, month, day] = isoDateMatch;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  const isValidDate = (
    parsedDate.getFullYear() === Number(year) &&
    parsedDate.getMonth() === Number(month) - 1 &&
    parsedDate.getDate() === Number(day)
  );

  if (!isValidDate) return text;

  const formattedDate = `${day}/${month}/${year}`;
  return rest.length > 0 ? `${formattedDate} / ${rest.join(" / ")}` : formattedDate;
};

const normalizeFileToken = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const buildReportFileName = (companyName: string, month: number, year: number, extension: string): string => {
  const competence = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const companyToken = normalizeFileToken(companyName || "empresa");
  const competenceToken = normalizeFileToken(competence || `${month}-${year}`);
  return `${companyToken}-${competenceToken}.${extension}`;
};

const PDF_LABEL_ALIASES: Record<string, string> = {
  "salário ctps": "Salário\nCTPS",
  "salario ctps": "Salário\nCTPS",
  "salário g": "Salário\nG",
  "salario g": "Salário\nG",
  "salário fiscal": "Salário\nFiscal",
  "salario fiscal": "Salário\nFiscal",
  "(+) outros rendim.": "(+)\nOutros\nRendim.",
  "(+) horas extras": "(+)\nHoras\nExtras",
  "(+) 1/3 de férias": "(+)\n1/3\nFérias",
  "(+) 1/3 de ferias": "(+)\n1/3\nFérias",
  "(+) premio/desemp.": "(+)\nPrêmio/\nDesemp.",
  "(+) prêmio/desemp.": "(+)\nPrêmio/\nDesemp.",
  "(-)inss": "(-)\nINSS",
  "(-) emprést. consig.": "(-)\nEmprést.\nConsig.",
  "(-) emprest. consig.": "(-)\nEmprést.\nConsig.",
  "(-) adiant geren.": "(-)\nAdiant.\nGeren.",
  "(-) vales/descontos": "(-)\nVales/\nDesc.",
  "(-) faltas/descontos": "(-)\nFaltas/\nDesc.",
  "salário real": "Salário\nReal",
  "salario real": "Salário\nReal",
  "salário g2 complem.": "Salário G2\nComplem.",
  "salario g2 complem.": "Salário G2\nComplem.",
  "salário líquido": "Salário\nLíquido",
  "salario liquido": "Salário\nLíquido",
};

const normalizePdfLabelKey = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const formatPdfColumnLabel = (label: string): string => {
  const sanitized = String(label ?? "").replace(/\s+/g, " ").trim();
  if (!sanitized) return "";

  const alias = PDF_LABEL_ALIASES[normalizePdfLabelKey(sanitized)];
  if (alias) return alias;

  const firstTokenOperatorMatch = sanitized.match(/^([(+-)/\d]+)\s+(.+)$/);
  const operatorPrefix = firstTokenOperatorMatch ? firstTokenOperatorMatch[1] : "";
  const baseLabel = firstTokenOperatorMatch ? firstTokenOperatorMatch[2] : sanitized;

  const words = baseLabel.split(" ").filter(Boolean);
  const lines: string[] = operatorPrefix ? [operatorPrefix] : [];
  let currentLine = "";
  const maxLineLength = 10;

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxLineLength) {
      currentLine = candidate;
      return;
    }
    if (currentLine) lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
};

const safeCsvCell = (value: unknown): string => {
  if (value === null || value === undefined) return "\"\"";

  // Comentário: mantemos números como números para preservar uso em soma no Excel.
  if (typeof value === "number") return `"${String(value).replace(/"/g, '""')}"`;

  const text = String(value);
  const formulaRisk = /^[=+\-@]/.test(text);
  const safeText = `${formulaRisk ? "'" : ""}${text}`;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const ReportsCompany: React.FC = () => {
  const {
    activeCompanies,
    allPayrollBatches,
    allEmployees,
    allPayrollEntries,
    payrollEntries,
    rubrics,
    isLoading,
    selectedCompany,
    setSelectedCompany,
    selectedMonth,
    setSelectedMonth,
  } = usePayroll();

  const safeActiveCompanies = activeCompanies ?? [];

  const availableCompetences = React.useMemo(() => {
    if (!selectedCompany) return [];
    return (allPayrollBatches ?? [])
      .filter((batch) => batch.companyId === selectedCompany.id && !batch.isArchived)
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [allPayrollBatches, selectedCompany]);

  const selectedBatch = React.useMemo(
    () => availableCompetences.find((batch) => batch.month === selectedMonth.month && batch.year === selectedMonth.year) || null,
    [availableCompetences, selectedMonth.month, selectedMonth.year],
  );

  const dataset = React.useMemo(() => {
    if (!selectedCompany) return null;
    return buildReportByCompanyData({
      company: selectedCompany,
      month: selectedMonth,
      batch: selectedBatch,
      allBatches: allPayrollBatches ?? [],
      allEmployees: allEmployees ?? [],
      // O relatório deve usar a mesma lista operacional da Central de Folha.
      // Isso evita divergência entre o que a Central mostra e o que o relatório exporta.
      allEntries: payrollEntries ?? [],
      rubrics: rubrics ?? [],
    });
  }, [selectedCompany, selectedMonth, selectedBatch, allPayrollBatches, allEmployees, payrollEntries, rubrics]);

  React.useEffect(() => {
    if (!import.meta.env.DEV) return;

    console.table({
      selectedCompanyId: selectedCompany?.id,
      selectedCompanyName: selectedCompany?.name,
      selectedMonth: selectedMonth?.month,
      selectedYear: selectedMonth?.year,
      selectedBatchId: selectedBatch?.id,
      selectedBatchArchived: selectedBatch?.isArchived,
      payrollEntriesCount: payrollEntries?.length ?? 0,
      allPayrollEntriesCount: allPayrollEntries?.length ?? 0,
      allPayrollBatchesCount: allPayrollBatches?.length ?? 0,
      datasetRows: dataset?.rows?.length ?? 0,
    });

    console.table(
      (payrollEntries ?? []).map((entry) => ({
        id: entry.id,
        companyId: entry.companyId,
        employeeId: entry.employeeId,
        month: entry.month,
        year: entry.year,
        payrollBatchId: entry.payrollBatchId,
        netSalary: entry.netSalary,
        inssAmount: entry.inssAmount,
      }))
    );
  }, [selectedCompany, selectedMonth, selectedBatch, payrollEntries, allPayrollEntries, allPayrollBatches, dataset]);

  const exportCsv = React.useCallback(() => {
    if (!dataset) return;
    const header = [...dataset.fixedColumns.map((column) => column.label), ...dataset.dynamicColumns.map((column) => column.rubricName)];
    const lines = [
      [dataset.title],
      [],
      header,
      ...dataset.rows.map((row) => [
        row.name,
        row.department,
        row.jobRole,
        row.admissionRegistration,
        ...dataset.dynamicColumns.map((column) => row.rubricValues[column.rubricId] ?? 0),
      ]),
      [
        "TOTAL",
        "",
        "",
        "",
        ...dataset.dynamicColumns.map((column) => dataset.totalsByRubricId[column.rubricId] ?? 0),
      ],
    ];

    const csv = lines.map((line) => line.map((cell) => safeCsvCell(cell)).join(";")).join("\n");

    // Comentário: não há biblioteca .xlsx no projeto nesta fase; exportamos CSV UTF-8
    // compatível com Excel para manter implementação simples e segura.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Comentário: padroniza nome amigável com empresa + competência sem alterar os dados exportados.
    a.download = buildReportFileName(dataset.companyName, dataset.month, dataset.year, "csv");
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação CSV concluída.");
  }, [dataset]);

  const exportPdf = React.useCallback(() => {
    if (!dataset) return;

    const generatedAt = new Date();
    const generatedAtLabel = generatedAt.toLocaleDateString("pt-BR") + " às " + generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const fileName = buildReportFileName(dataset.companyName, dataset.month, dataset.year, "pdf");

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginLeft = 6;
    const marginRight = 6;

    const drawHeader = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(dataset.title, marginLeft, 9);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Gerado em ${generatedAtLabel}`, marginLeft, 13);
    };

    const fixedColumnsPdfLabels = dataset.fixedColumns.map((column) => formatPdfColumnLabel(column.label));
    const dynamicColumnsPdfLabels = dataset.dynamicColumns.map((column) => formatPdfColumnLabel(column.rubricName));
    const head = [[...fixedColumnsPdfLabels, ...dynamicColumnsPdfLabels]];

    const body = dataset.rows.map((row) => [
      row.name,
      row.department,
      row.jobRole,
      formatAdmissionRegistrationForPrint(row.admissionRegistration),
      ...dataset.dynamicColumns.map((column) => BRL(row.rubricValues[column.rubricId] ?? 0)),
    ]);

    const totalsRow = [
      "TOTAL",
      "",
      "",
      "",
      ...dataset.dynamicColumns.map((column) => BRL(dataset.totalsByRubricId[column.rubricId] ?? 0)),
    ];

    const dynamicColumnCount = dataset.dynamicColumns.length;
    const compactFontSize = dynamicColumnCount > 14 ? 5 : 6;
    const compactCellPadding = dynamicColumnCount > 14 ? 0.6 : 0.8;
    const enableExtremeHorizontalFallback = dynamicColumnCount > 24;

    // Comentário: o relatório somente exporta os valores já calculados na folha; não há recálculo no PDF.
    // Comentário: priorizamos manter colunas na mesma página usando compactação; quebra horizontal só em cenário extremo.
    autoTable(doc, {
      startY: 16,
      head,
      body: [...body, totalsRow],
      tableWidth: "auto",
      styles: { fontSize: compactFontSize, cellPadding: compactCellPadding, overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: [226, 232, 240], textColor: 15, halign: "center", overflow: "linebreak", fontSize: compactFontSize },
      bodyStyles: { textColor: 15 },
      columnStyles: {
        0: { cellWidth: 24, overflow: "linebreak" },
        1: { cellWidth: 14, overflow: "linebreak" },
        2: { cellWidth: 16, overflow: "linebreak" },
        3: { cellWidth: 14, overflow: "linebreak" },
        ...Object.fromEntries(
          dataset.dynamicColumns.map((_, index) => [index + 4, { cellWidth: "wrap", minCellWidth: 8 }]),
        ),
      },
      horizontalPageBreak: enableExtremeHorizontalFallback,
      horizontalPageBreakRepeat: enableExtremeHorizontalFallback ? [0, 1, 2, 3] : undefined,
      didParseCell: (hookData) => {
        if (hookData.section === "body" && hookData.row.index === body.length) {
          hookData.cell.styles.fillColor = [241, 245, 249];
          hookData.cell.styles.fontStyle = "bold";
        }

        // Comentário: mantém valores monetários alinhados à direita em todas as páginas/segmentos.
        if (hookData.section !== "head" && hookData.column.index >= 4) {
          hookData.cell.styles.halign = "right";
        }
      },
      didDrawPage: () => {
        drawHeader();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(FOOTER_TEXT, pageWidth / 2, pageHeight - 4, { align: "center" });
      },
      margin: { top: 16, bottom: 8, left: marginLeft, right: marginRight },
      theme: "grid",
      showHead: "everyPage",
    });

    // Comentário: download direto substitui abertura de nova aba/print para operação mais rápida em lote.
    doc.save(fileName);
    toast.success("PDF gerado e baixado com sucesso.");
  }, [dataset]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Relatório por Empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Empresa</p>
            <Select value={selectedCompany?.id || ""} onValueChange={(value) => {
              const company = safeActiveCompanies.find((item) => item.id === value);
              if (company) setSelectedCompany(company);
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>{safeActiveCompanies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Competência</p>
            <Select
              value={`${selectedMonth.month}/${selectedMonth.year}`}
              onValueChange={(value) => {
                const [month, year] = value.split("/").map(Number);
                setSelectedMonth({ month, year });
              }}
              disabled={!selectedCompany || availableCompetences.length === 0}
            >
              <SelectTrigger><SelectValue placeholder="Selecione a competência" /></SelectTrigger>
              <SelectContent>
                {availableCompetences.map((batch) => {
                  const label = new Date(batch.year, batch.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                  return <SelectItem key={batch.id} value={`${batch.month}/${batch.year}`}>{label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={exportPdf} disabled={!dataset || dataset.rows.length === 0}><FileText className="mr-2 h-4 w-4" />Gerar PDF</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!dataset || dataset.rows.length === 0}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar CSV (Excel)</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{dataset?.title || "Relatório por Empresa"}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados do relatório...</p>
          ) : !selectedCompany ? (
            <p className="text-sm text-muted-foreground">Selecione uma empresa para visualizar o relatório.</p>
          ) : availableCompetences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há folhas não arquivadas para a empresa selecionada.</p>
          ) : !dataset || dataset.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há lançamentos para a empresa/competência selecionadas.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {dataset.fixedColumns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
                    {dataset.dynamicColumns.map((column) => <TableHead key={column.rubricId}>{column.rubricName}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataset.rows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>{row.jobRole}</TableCell>
                      <TableCell>{row.admissionRegistration}</TableCell>
                      {dataset.dynamicColumns.map((column) => (
                        <TableCell key={`${row.employeeId}-${column.rubricId}`} className="text-right">
                          {BRL(row.rubricValues[column.rubricId] ?? 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-semibold">TOTAL</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    {dataset.dynamicColumns.map((column) => (
                      <TableCell key={`total-${column.rubricId}`} className="text-right font-semibold">
                        {BRL(dataset.totalsByRubricId[column.rubricId] ?? 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsCompany;
