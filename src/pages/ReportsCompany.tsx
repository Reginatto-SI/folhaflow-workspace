import React from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayroll } from "@/contexts/PayrollContext";
import { buildReportByCompanyData } from "@/lib/reportByCompanyData";
import { generateReportByCompanyPdf } from "@/lib/reportByCompanyPdf";
import { exportReportByCompanyExcel } from "@/lib/reportByCompanyExcel";

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

    // Comentário: página de relatórios e Central reutilizam a mesma rotina de exportação Excel (CSV compatível).
    exportReportByCompanyExcel(dataset);
  }, [dataset]);

  const exportPdf = React.useCallback(() => {
    if (!dataset) return;

    // Comentário: a página e a Central reutilizam a geração oficial do relatório por empresa.
    generateReportByCompanyPdf(dataset);
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
