import React from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayroll } from "@/contexts/PayrollContext";
import { buildConsolidatedReportByCompanyData, buildReportByCompanyData, type ReportByCompanyDataset } from "@/lib/reportByCompanyData";
import { generateReportByCompanyPdf } from "@/lib/reportByCompanyPdf";
import { exportReportByCompanyExcel } from "@/lib/reportByCompanyExcel";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { noTranslateAttributes, withNoTranslateClass } from "@/lib/noTranslate";

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ALL_COMPANIES_VALUE = "__all_companies__";

type ReportsCompanyFilters = {
  empresaId: string;
  competencia: { month: number; year: number };
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

  const persistedFilters = usePersistedFilters<ReportsCompanyFilters>("relatorios-por-empresa");
  const restoredFiltersRef = React.useRef(false);
  const [filtersReady, setFiltersReady] = React.useState(false);
  const [isAllCompaniesSelected, setIsAllCompaniesSelected] = React.useState(false);

  const safeActiveCompanies = React.useMemo(() => activeCompanies ?? [], [activeCompanies]);

  React.useEffect(() => {
    if (isLoading || restoredFiltersRef.current) return;
    if (safeActiveCompanies.length === 0) return;

    const saved = persistedFilters.readFilters();
    const savedAllCompanies = saved?.empresaId === ALL_COMPANIES_VALUE;
    const savedCompany = saved?.empresaId && !savedAllCompanies ? safeActiveCompanies.find((company) => company.id === saved.empresaId) : null;
    const companyCompetences = savedAllCompanies
      ? (allPayrollBatches ?? [])
          .filter((batch) => !batch.isArchived && safeActiveCompanies.some((company) => company.id === batch.companyId))
          .sort((a, b) => (b.year - a.year) || (b.month - a.month))
      : savedCompany
        ? (allPayrollBatches ?? [])
            .filter((batch) => batch.companyId === savedCompany.id && !batch.isArchived)
            .sort((a, b) => (b.year - a.year) || (b.month - a.month))
        : [];
    const savedCompetence = saved?.competencia
      ? companyCompetences.find((batch) =>
          batch.month === saved.competencia?.month &&
          batch.year === saved.competencia?.year
        )
      : null;
    const competenceToRestore = savedCompetence ?? companyCompetences[0] ?? null;

    // Comentário: restaura após carregar empresas/folhas; se a competência salva não existe mais, usa a mais recente da própria empresa.
    if (savedAllCompanies) {
      setIsAllCompaniesSelected(true);
      if (competenceToRestore) setSelectedMonth({ month: competenceToRestore.month, year: competenceToRestore.year });
    } else if (savedCompany) {
      setIsAllCompaniesSelected(false);
      setSelectedCompany(savedCompany);
      if (competenceToRestore) setSelectedMonth({ month: competenceToRestore.month, year: competenceToRestore.year });
    }

    restoredFiltersRef.current = true;
    setFiltersReady(true);
  }, [allPayrollBatches, isLoading, persistedFilters, safeActiveCompanies, setSelectedCompany, setSelectedMonth]);

  React.useEffect(() => {
    if (!filtersReady) return;

    const hasSelectedCompetence = (allPayrollBatches ?? []).some((batch) =>
      !batch.isArchived &&
      batch.month === selectedMonth.month &&
      batch.year === selectedMonth.year &&
      (isAllCompaniesSelected || batch.companyId === selectedCompany?.id)
    );

    if (isAllCompaniesSelected) {
      persistedFilters.saveFilters({
        empresaId: ALL_COMPANIES_VALUE,
        ...(hasSelectedCompetence ? { competencia: { month: selectedMonth.month, year: selectedMonth.year } } : {}),
      });
      return;
    }

    if (!selectedCompany) return;
    persistedFilters.saveFilters({
      empresaId: selectedCompany.id,
      ...(hasSelectedCompetence ? { competencia: { month: selectedMonth.month, year: selectedMonth.year } } : {}),
    });
  }, [allPayrollBatches, filtersReady, isAllCompaniesSelected, persistedFilters, selectedCompany, selectedMonth.month, selectedMonth.year]);

  const resetToDefaultFilters = React.useCallback(() => {
    persistedFilters.clearFilters();
    const fallbackCompany = safeActiveCompanies[0];
    if (!fallbackCompany) return;

    setIsAllCompaniesSelected(false);
    setSelectedCompany(fallbackCompany);
    const [fallbackCompetence] = (allPayrollBatches ?? [])
      .filter((batch) => batch.companyId === fallbackCompany.id && !batch.isArchived)
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
    if (fallbackCompetence) setSelectedMonth({ month: fallbackCompetence.month, year: fallbackCompetence.year });
  }, [allPayrollBatches, persistedFilters, safeActiveCompanies, setSelectedCompany, setSelectedMonth]);

  const availableCompetences = React.useMemo(() => {
    if (!selectedCompany && !isAllCompaniesSelected) return [];
    const batches = (allPayrollBatches ?? [])
      .filter((batch) => !batch.isArchived && (isAllCompaniesSelected || batch.companyId === selectedCompany?.id))
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));

    if (!isAllCompaniesSelected) return batches;

    // Comentário: no consolidado a competência aparece uma única vez, mesmo existindo batch em várias empresas.
    const seenCompetences = new Set<string>();
    return batches.filter((batch) => {
      const key = `${batch.month}/${batch.year}`;
      if (seenCompetences.has(key)) return false;
      seenCompetences.add(key);
      return true;
    });
  }, [allPayrollBatches, isAllCompaniesSelected, selectedCompany]);

  const selectedBatch = React.useMemo(
    () => availableCompetences.find((batch) => batch.month === selectedMonth.month && batch.year === selectedMonth.year) || null,
    [availableCompetences, selectedMonth.month, selectedMonth.year],
  );

  React.useEffect(() => {
    if (!isAllCompaniesSelected || availableCompetences.length === 0) return;

    const hasCurrentConsolidatedCompetence = availableCompetences.some((batch) =>
      batch.month === selectedMonth.month && batch.year === selectedMonth.year
    );
    if (hasCurrentConsolidatedCompetence) return;

    const [latestConsolidatedCompetence] = availableCompetences;
    // Comentário: ao entrar no consolidado, evita estado vazio se a competência anterior só existia na empresa individual.
    setSelectedMonth({ month: latestConsolidatedCompetence.month, year: latestConsolidatedCompetence.year });
  }, [availableCompetences, isAllCompaniesSelected, selectedMonth.month, selectedMonth.year, setSelectedMonth]);

  const dataset = React.useMemo(() => {
    if (!selectedCompany && !isAllCompaniesSelected) return null;

    if (isAllCompaniesSelected) {
      const companyDatasets = safeActiveCompanies
        .map((company) => {
          const companyBatch = (allPayrollBatches ?? []).find((batch) =>
            batch.companyId === company.id &&
            !batch.isArchived &&
            batch.month === selectedMonth.month &&
            batch.year === selectedMonth.year
          ) || null;
          if (!companyBatch) return null;

          const companyDataset = buildReportByCompanyData({
            company,
            month: selectedMonth,
            batch: companyBatch,
            allBatches: allPayrollBatches ?? [],
            allEmployees: allEmployees ?? [],
            // Comentário: consolidado usa lançamentos persistidos de todas as empresas, sem recalcular ou alterar a Central.
            allEntries: allPayrollEntries ?? [],
            rubrics: rubrics ?? [],
          });

          return companyDataset;
        })
        .filter((item): item is ReportByCompanyDataset => Boolean(item));

      return buildConsolidatedReportByCompanyData(companyDatasets);
    }

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
  }, [selectedCompany, isAllCompaniesSelected, safeActiveCompanies, selectedMonth, selectedBatch, allPayrollBatches, allEmployees, payrollEntries, allPayrollEntries, rubrics]);

  const exportCsv = React.useCallback(() => {
    if (!dataset) {
      toast.error("Nenhuma folha encontrada para a competência selecionada.");
      return;
    }

    // Comentário: página de relatórios e Central reutilizam a mesma rotina de exportação Excel (CSV compatível).
    exportReportByCompanyExcel(dataset);
  }, [dataset]);

  const exportPdf = React.useCallback(() => {
    if (!dataset) {
      toast.error("Nenhuma folha encontrada para a competência selecionada.");
      return;
    }

    // Comentário: a página e a Central reutilizam a geração oficial do relatório por empresa.
    generateReportByCompanyPdf(dataset);
    toast.success("PDF gerado e baixado com sucesso.");
  }, [dataset]);

  const previewRows = React.useMemo(() => {
    if (!dataset?.isConsolidated) return dataset?.rows.map((row) => ({ row, companyName: "" })) ?? [];

    // Comentário: prévia consolidada mostra Empresa sem mudar a estrutura da tabela individual.
    return (dataset.companySections ?? []).flatMap((companyDataset) =>
      companyDataset.rows.map((row) => ({ row, companyName: companyDataset.companyName }))
    );
  }, [dataset]);

  return (
    // Comentário: relatórios visuais/exportáveis não devem sofrer tradução automática do navegador.
    <div className={withNoTranslateClass("space-y-4")} {...noTranslateAttributes}>
      <Card>
        <CardHeader><CardTitle>Relatório por Empresa</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Empresa</p>
            <Select value={isAllCompaniesSelected ? ALL_COMPANIES_VALUE : selectedCompany?.id || ""} onValueChange={(value) => {
              if (value === ALL_COMPANIES_VALUE) {
                setIsAllCompaniesSelected(true);
                return;
              }

              const company = safeActiveCompanies.find((item) => item.id === value);
              if (company) {
                setIsAllCompaniesSelected(false);
                setSelectedCompany(company);
              }
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMPANIES_VALUE}>Todas as empresas</SelectItem>
                {safeActiveCompanies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}
              </SelectContent>
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
              disabled={(!selectedCompany && !isAllCompaniesSelected) || availableCompetences.length === 0}
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
            <Button onClick={exportPdf} disabled={isLoading || (!selectedCompany && !isAllCompaniesSelected)}><FileText className="mr-2 h-4 w-4" />Gerar PDF</Button>
            <Button variant="outline" onClick={exportCsv} disabled={isLoading || (!selectedCompany && !isAllCompaniesSelected)}><FileSpreadsheet className="mr-2 h-4 w-4" />Exportar CSV (Excel)</Button>
            <Button variant="ghost" onClick={resetToDefaultFilters}>Limpar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{dataset?.title || "Relatório por Empresa"}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados do relatório...</p>
          ) : !selectedCompany && !isAllCompaniesSelected ? (
            <p className="text-sm text-muted-foreground">Selecione uma empresa para visualizar o relatório.</p>
          ) : availableCompetences.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há folhas não arquivadas para a seleção atual.</p>
          ) : !dataset || dataset.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma folha encontrada para a competência selecionada.</p>
          ) : (
            <div className={withNoTranslateClass("overflow-x-auto")} {...noTranslateAttributes}>
              <Table>
                <TableHeader>
                  <TableRow>
                    {dataset.isConsolidated ? <TableHead>Empresa</TableHead> : null}
                    {dataset.fixedColumns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
                    {dataset.dynamicColumns.map((column) => <TableHead key={column.rubricId}>{column.rubricName}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map(({ row, companyName }, rowIndex) => (
                    <TableRow key={`${row.employeeId}-${rowIndex}`}>
                      {dataset.isConsolidated ? <TableCell>{companyName}</TableCell> : null}
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
                    {dataset.isConsolidated ? <TableCell className="font-semibold">TOTAL GERAL</TableCell> : null}
                    <TableCell className="font-semibold">{dataset.isConsolidated ? "" : "TOTAL"}</TableCell>
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
