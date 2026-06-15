import React from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayroll } from "@/contexts/PayrollContext";
import { buildReportSummaryData } from "@/lib/reportSummaryData";
import { generateReportSummaryPdf } from "@/lib/reportSummaryPdf";
import { generateReportSummaryExcel } from "@/lib/reportSummaryExcel";
import { buildManagerialSummary } from "@/lib/reportSummaryManagerial";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { noTranslateAttributes, withNoTranslateClass } from "@/lib/noTranslate";

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PCT = (value: number) => `${(Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

type ReportsSummaryFilters = {
  competencia: { month: number; year: number };
};

const ReportsSummary: React.FC = () => {
  const {
    activeCompanies,
    allPayrollBatches,
    allEmployees,
    allPayrollEntries,
    rubrics,
    isLoading,
    selectedMonth,
  } = usePayroll();

  // Lista única de competências de todo o grupo (deduplicada por mês/ano, desc).
  const availableCompetences = React.useMemo(() => {
    const seen = new Map<string, { month: number; year: number }>();
    (allPayrollBatches ?? [])
      .filter((b) => !b.isArchived)
      .forEach((b) => {
        const key = `${b.month}/${b.year}`;
        if (!seen.has(key)) seen.set(key, { month: b.month, year: b.year });
      });
    return Array.from(seen.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [allPayrollBatches]);

  const [reportMonth, setReportMonth] = React.useState(selectedMonth);
  const persistedFilters = usePersistedFilters<ReportsSummaryFilters>("relatorios-resumo-completo");
  const restoredFiltersRef = React.useRef(false);
  const [filtersReady, setFiltersReady] = React.useState(false);

  React.useEffect(() => {
    if (isLoading || restoredFiltersRef.current) return;
    if (availableCompetences.length === 0) return;

    const saved = persistedFilters.readFilters();
    const savedCompetence = saved?.competencia
      ? availableCompetences.find((competence) =>
          competence.month === saved.competencia?.month && competence.year === saved.competencia?.year
        )
      : null;

    // Comentário: só restaura a competência consolidada se ela ainda existir em alguma folha ativa do grupo.
    if (savedCompetence) setReportMonth({ month: savedCompetence.month, year: savedCompetence.year });
    restoredFiltersRef.current = true;
    setFiltersReady(true);
  }, [availableCompetences, isLoading, persistedFilters]);

  React.useEffect(() => {
    if (!filtersReady) return;
    const hasReportMonth = availableCompetences.some((competence) =>
      competence.month === reportMonth.month && competence.year === reportMonth.year
    );
    if (!hasReportMonth) return;

    persistedFilters.saveFilters({ competencia: { month: reportMonth.month, year: reportMonth.year } });
  }, [availableCompetences, filtersReady, persistedFilters, reportMonth.month, reportMonth.year]);

  const resetToDefaultFilters = React.useCallback(() => {
    persistedFilters.clearFilters();
    const [mostRecentCompetence] = availableCompetences;
    if (mostRecentCompetence) setReportMonth({ month: mostRecentCompetence.month, year: mostRecentCompetence.year });
  }, [availableCompetences, persistedFilters]);

  React.useEffect(() => {
    if (!filtersReady) return;
    if (availableCompetences.length === 0) return;
    const hasReportMonth = availableCompetences.some(
      (competence) => competence.month === reportMonth.month && competence.year === reportMonth.year,
    );
    if (hasReportMonth) return;

    // Comentário: o Resumo Completo consolida todo o grupo; por isso a competência do relatório
    // precisa seguir as folhas do grupo, sem ser forçada pela empresa selecionada na Central.
    const [mostRecentCompetence] = availableCompetences;
    setReportMonth({ month: mostRecentCompetence.month, year: mostRecentCompetence.year });
  }, [availableCompetences, filtersReady, reportMonth.month, reportMonth.year]);

  const dataset = React.useMemo(() => {
    if (!reportMonth || (activeCompanies ?? []).length === 0) return null;
    // Reaproveita a mesma fonte do Relatório por Empresa (sem novo motor de cálculo).
    return buildReportSummaryData({
      month: reportMonth,
      companies: activeCompanies ?? [],
      allBatches: allPayrollBatches ?? [],
      allEmployees: allEmployees ?? [],
      allEntries: allPayrollEntries ?? [],
      rubrics: rubrics ?? [],
    });
  }, [reportMonth, activeCompanies, allPayrollBatches, allEmployees, allPayrollEntries, rubrics]);

  const mainRows = React.useMemo(
    () => dataset?.rows.filter((row) => !["rendimentos", "descontos", "custo_medio"].includes(row.kind)) ?? [],
    [dataset],
  );
  const summaryRows = React.useMemo(
    () => dataset?.rows.filter((row) => ["rendimentos", "descontos", "custo_medio"].includes(row.kind)) ?? [],
    [dataset],
  );

  const managerial = React.useMemo(() => (dataset ? buildManagerialSummary(dataset) : null), [dataset]);


  const exportPdf = React.useCallback(() => {
    if (!dataset) return;
    generateReportSummaryPdf(dataset);
    toast.success("PDF gerado e baixado com sucesso.");
  }, [dataset]);

  const exportExcel = React.useCallback(() => {
    if (!dataset) return;
    // Comentário: exporta o mesmo dataset usado no PDF para manter 100% de paridade.
    generateReportSummaryExcel(dataset);
    toast.success("Excel gerado e baixado com sucesso.");
  }, [dataset]);

  return (
    // Comentário: relatórios visuais/exportáveis não devem sofrer tradução automática do navegador.
    <div className={withNoTranslateClass("space-y-4")} {...noTranslateAttributes}>
      <Card>
        <CardHeader>
          <CardTitle>Resumo Completo da Folha</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Competência</p>
            <Select
              value={`${reportMonth.month}/${reportMonth.year}`}
              onValueChange={(value) => {
                const [month, year] = value.split("/").map(Number);
                setReportMonth({ month, year });
              }}
              disabled={availableCompetences.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a competência" />
              </SelectTrigger>
              <SelectContent>
                {availableCompetences.map((c) => {
                  const label = new Date(c.year, c.month - 1, 1).toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  });
                  return (
                    <SelectItem key={`${c.month}/${c.year}`} value={`${c.month}/${c.year}`}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button onClick={exportPdf} disabled={!dataset || dataset.companies.length === 0}>
              <FileText className="mr-2 h-4 w-4" />
              Gerar PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={!dataset || dataset.companies.length === 0}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
            <Button variant="ghost" onClick={resetToDefaultFilters}>
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{dataset?.title || "Resumo Completo da Folha"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando dados do relatório...</p>
          ) : !dataset || dataset.companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma empresa ativa para consolidar nesta competência.
            </p>
          ) : (
            <>
            <div className={withNoTranslateClass("overflow-x-auto")} {...noTranslateAttributes}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Renda</TableHead>
                    {dataset.companies.map((c) => (
                      <TableHead key={c.id} className="text-right">
                        {c.name}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">TOTAL</TableHead>
                    <TableHead className="text-right">SEM IMOB.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mainRows.map((row) => {
                    const cellClass = row.isBold ? "font-semibold bg-muted/40" : "";
                    const format = (v: number) => (row.isInteger ? String(Math.round(v)) : BRL(v));
                    return (
                      <TableRow key={row.key}>
                        <TableCell className={cellClass}>{row.label}</TableCell>
                        {dataset.companies.map((c) => (
                          <TableCell key={`${row.key}-${c.id}`} className={`text-right ${cellClass}`}>
                            {format(row.valuesByCompanyId[c.id] ?? 0)}
                          </TableCell>
                        ))}
                        <TableCell className={`text-right font-semibold ${cellClass}`}>
                          {format(row.total)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${cellClass}`}>
                          {format(row.semImob)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="mt-4">
                <Table>
                  <TableBody>
                    {summaryRows.map((row) => {
                      const cellClass = row.isBold ? "font-semibold bg-muted/40" : "";
                      const format = (v: number) => (row.isInteger ? String(Math.round(v)) : BRL(v));
                      return (
                        <TableRow key={row.key}>
                          <TableCell className={cellClass}>{row.label}</TableCell>
                          {dataset.companies.map((c) => (
                            <TableCell key={`${row.key}-${c.id}`} className={`text-right ${cellClass}`}>
                              {format(row.valuesByCompanyId[c.id] ?? 0)}
                            </TableCell>
                          ))}
                          <TableCell className={`text-right font-semibold ${cellClass}`}>
                            {format(row.total)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${cellClass}`}>
                            {format(row.semImob)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

              {managerial && (
                <section className="mt-6 space-y-4 rounded-md border p-4">
                  {/* Comentário: resumo gerencial é apenas consolidação visual do mesmo dataset; não recalcula a folha. */}
                  <h3 className="text-lg font-semibold">Resumo Gerencial para Aprovação</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {[
                      ["Total de Funcionários", String(managerial.totalEmployees)],
                      ["Rendimentos", BRL(managerial.rendimentos)],
                      ["Descontos", BRL(managerial.descontos)],
                      ["Salário Líquido", BRL(managerial.salarioLiquido)],
                      ["Custo Médio por Func.", BRL(managerial.custoMedioPorFuncionario)],
                    ].map(([label, value]) => (
                      <Card key={label}>
                        <CardContent className="p-3">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-lg font-semibold">{value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
                    <Card className="xl:col-span-2">
                      <CardHeader className="pb-2"><CardTitle className="text-base">Ranking por Setor / Empresa</CardTitle></CardHeader>
                      <CardContent>
                        <Table className="w-full table-fixed text-sm">
                          <TableHeader><TableRow><TableHead className="w-8">#</TableHead><TableHead>Setor / Empresa</TableHead><TableHead className="w-12 text-right">Func.</TableHead><TableHead className="w-28 text-right">Salário Líquido</TableHead><TableHead className="w-20 text-right">% do Total</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {managerial.ranking.slice(0, 5).map((item, idx) => (
                              <TableRow key={item.companyId}>
                                <TableCell>{idx + 1}</TableCell><TableCell className="break-words">{item.name}</TableCell><TableCell className="text-right tabular-nums">{item.employees}</TableCell><TableCell className="text-right tabular-nums">{BRL(item.salarioLiquido)}</TableCell><TableCell className="text-right tabular-nums">{PCT(item.percentOfTotal)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-semibold"><TableCell colSpan={2}>TOTAL</TableCell><TableCell className="text-right tabular-nums">{managerial.totalEmployees}</TableCell><TableCell className="text-right tabular-nums">{BRL(managerial.salarioLiquido)}</TableCell><TableCell className="text-right tabular-nums">{PCT(managerial.salarioLiquido > 0 ? 100 : 0)}</TableCell></TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-base">Top setores por custo</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {(() => {
                          const top = managerial.ranking.slice(0, 5);
                          const max = top[0]?.salarioLiquido ?? 0;
                          return top.map((item) => (
                            <div key={`bar-${item.companyId}`} className="space-y-1">
                              <div className="flex justify-between text-xs"><span>{item.name}</span><span>{BRL(item.salarioLiquido)}</span></div>
                              <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${max > 0 ? (item.salarioLiquido / max) * 100 : 0}%` }} /></div>
                            </div>
                          ));
                        })()}
                      </CardContent>
                    </Card>

                    <Card className="xl:col-span-2">
                      <CardHeader className="pb-2"><CardTitle className="text-base">Composição da Folha</CardTitle></CardHeader>
                      <CardContent>
                        <Table><TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader><TableBody>
                          {managerial.composition.map((row) => (<TableRow key={row.key}><TableCell>{row.label}</TableCell><TableCell className="text-right">{BRL(row.value)}</TableCell><TableCell className="text-right">{PCT(row.percent)}</TableCell></TableRow>))}
                        </TableBody></Table>
                      </CardContent>
                    </Card>
                  </div>
                </section>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsSummary;
