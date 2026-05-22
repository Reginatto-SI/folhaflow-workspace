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
    a.download = `relatorio-empresa-${dataset.month}-${dataset.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exportação CSV concluída.");
  }, [dataset]);

  const exportPdf = React.useCallback(() => {
    if (!dataset) return;

    const generatedAt = new Date();
    const generatedAtLabel = generatedAt.toLocaleDateString("pt-BR") + " às " + generatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Comentário: distribuímos a largura das rubricas dinamicamente para evitar overflow
    // quando o cadastro possuir muitas colunas variáveis no relatório.
    const fixedNameWidth = 10;
    const fixedDepartmentWidth = 7;
    const fixedJobRoleWidth = 8;
    const fixedAdmissionWidth = 7;
    const fixedColumnsWidth = fixedNameWidth + fixedDepartmentWidth + fixedJobRoleWidth + fixedAdmissionWidth;
    const numericColumnsCount = dataset.dynamicColumns.length;
    const numericColumnWidth = numericColumnsCount > 0 ? (100 - fixedColumnsWidth) / numericColumnsCount : 0;

    const fixedColumnClasses: Record<string, string> = {
      name: "col-name",
      department: "col-department",
      jobRole: "col-job-role",
      admissionRegistration: "col-admission",
    };

    const tableHead = `
      <tr>
        ${dataset.fixedColumns.map((column) => `<th class="${fixedColumnClasses[column.key] ?? "col-default"}">${escapeHtml(column.label)}</th>`).join("")}
        ${dataset.dynamicColumns.map((column) => `<th class="col-numeric">${escapeHtml(column.rubricName)}</th>`).join("")}
      </tr>`;

    const tableBody = dataset.rows
      .map(
        (row) => `<tr>
        <td class="col-name">${escapeHtml(row.name)}</td>
        <td class="col-department">${escapeHtml(row.department)}</td>
        <td class="col-job-role">${escapeHtml(row.jobRole)}</td>
        <td class="col-admission">${escapeHtml(formatAdmissionRegistrationForPrint(row.admissionRegistration))}</td>
        ${dataset.dynamicColumns.map((column) => `<td class="numeric col-numeric">${BRL(row.rubricValues[column.rubricId] ?? 0)}</td>`).join("")}
      </tr>`,
      )
      .join("");
    const totals = `<tr class="total-row"><td>TOTAL</td><td></td><td></td><td></td>${dataset.dynamicColumns.map((column) => `<td class="numeric col-numeric">${BRL(dataset.totalsByRubricId[column.rubricId] ?? 0)}</td>`).join("")}</tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
      @page { size: A4 landscape; margin: 6mm; }
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 7px; color: #0f172a; }
      .report-header { margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; }
      .report-title { font-size: 12px; margin: 0; font-weight: 700; }
      .report-generated-at { margin-top: 2px; font-size: 8px; color: #334155; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border: 1px solid #999; padding: 2px 3px; }
      th {
        background: #e2e8f0;
        white-space: normal;
        word-break: normal;
        overflow-wrap: anywhere;
        line-height: 1.1;
        text-align: center;
        vertical-align: middle;
      }
      td { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      td.numeric { text-align: right; white-space: nowrap; }
      .col-name { width: ${fixedNameWidth}%; }
      .col-department { width: ${fixedDepartmentWidth}%; }
      .col-job-role { width: ${fixedJobRoleWidth}%; }
      .col-admission { width: ${fixedAdmissionWidth}%; }
      .col-numeric { width: ${numericColumnWidth}%; }
      tr.total-row td { background: #f1f5f9; font-weight: 700; border-top: 2px solid #475569; }
      .footer { margin-top: 8px; font-size: 8px; color: #334155; text-align: center; }
      thead { display: table-header-group; }
      tfoot { display: table-row-group; }
    </style></head><body>
      <div class="report-header">
        <h1 class="report-title">${escapeHtml(dataset.title)}</h1>
        <div class="report-generated-at">Gerado em ${escapeHtml(generatedAtLabel)}</div>
      </div>
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
