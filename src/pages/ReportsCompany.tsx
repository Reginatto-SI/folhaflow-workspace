import React from "react";
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

const escapeHtml = (value: unknown): string => {
  const text = String(value ?? "");
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    rubrics,
    selectedCompany,
    setSelectedCompany,
    selectedMonth,
    setSelectedMonth,
  } = usePayroll();

  const availableCompetences = React.useMemo(() => {
    if (!selectedCompany) return [];
    return allPayrollBatches
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
      allBatches: allPayrollBatches,
      allEmployees,
      allEntries: allPayrollEntries,
      rubrics,
    });
  }, [selectedCompany, selectedMonth, selectedBatch, allPayrollBatches, allEmployees, allPayrollEntries, rubrics]);

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
    a.download = `relatorio-empresa-${dataset.month}-${dataset.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação CSV concluída.");
  }, [dataset]);

  const exportPdf = React.useCallback(() => {
    if (!dataset) return;
    const tableHead = `
      <tr>
        ${dataset.fixedColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
        ${dataset.dynamicColumns.map((column) => `<th>${escapeHtml(column.rubricName)}</th>`).join("")}
      </tr>`;
    const tableBody = dataset.rows
      .map(
        (row) => `<tr>
        <td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.department)}</td><td>${escapeHtml(row.jobRole)}</td><td>${escapeHtml(row.admissionRegistration)}</td>
        ${dataset.dynamicColumns.map((column) => `<td class="num">${BRL(row.rubricValues[column.rubricId] ?? 0)}</td>`).join("")}
      </tr>`,
      )
      .join("");
    const totals = `<tr class="total"><td>TOTAL</td><td></td><td></td><td></td>${dataset.dynamicColumns.map((column) => `<td class="num">${BRL(dataset.totalsByRubricId[column.rubricId] ?? 0)}</td>`).join("")}</tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; }
      h1 { font-size: 14px; margin: 0 0 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #999; padding: 3px 4px; white-space: nowrap; }
      th { background: #eee; position: sticky; top: 0; }
      .num { text-align: right; }
      .total td { font-weight: bold; }
      .footer { margin-top: 8px; font-size: 9px; }
      thead { display: table-header-group; }
    </style></head><body>
      <h1>${escapeHtml(dataset.title)}</h1>
      <table><thead>${tableHead}</thead><tbody>${tableBody}${totals}</tbody></table>
      <div class="footer">${escapeHtml(FOOTER_TEXT)}</div>
    </body></html>`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Não foi possível abrir a janela de impressão.");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      setTimeout(() => printWindow.print(), 100);
    };
    toast.success("PDF pronto para salvar/imprimir.");
  }, [dataset]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Relatório por Empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Empresa</p>
            <Select value={selectedCompany?.id || ""} onValueChange={(value) => {
              const company = activeCompanies.find((item) => item.id === value);
              if (company) setSelectedCompany(company);
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>{activeCompanies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
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
          {!dataset || dataset.rows.length === 0 ? (
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
