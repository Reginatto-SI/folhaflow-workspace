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

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PCT = (value: number) => `${(Number.isFinite(value) ? value : 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const ReportsSummary: React.FC = () => {
  const {
    activeCompanies,
    allPayrollBatches,
    allEmployees,
    allPayrollEntries,
    rubrics,
    isLoading,
    selectedMonth,
    setSelectedMonth,
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

  const dataset = React.useMemo(() => {
    if (!selectedMonth || (activeCompanies ?? []).length === 0) return null;
    // Reaproveita a mesma fonte do Relatório por Empresa (sem novo motor de cálculo).
    return buildReportSummaryData({
      month: selectedMonth,
      companies: activeCompanies ?? [],
      allBatches: allPayrollBatches ?? [],
      allEmployees: allEmployees ?? [],
      allEntries: allPayrollEntries ?? [],
      rubrics: rubrics ?? [],
    });
  }, [selectedMonth, activeCompanies, allPayrollBatches, allEmployees, allPayrollEntries, rubrics]);

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumo Completo da Folha</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Competência</p>
            <Select
              value={`${selectedMonth.month}/${selectedMonth.year}`}
              onValueChange={(value) => {
                const [month, year] = value.split("/").map(Number);
                setSelectedMonth({ month, year });
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
            <div className="overflow-x-auto">
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
