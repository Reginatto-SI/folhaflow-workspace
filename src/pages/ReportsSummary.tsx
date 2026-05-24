import React from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePayroll } from "@/contexts/PayrollContext";
import { buildReportSummaryData } from "@/lib/reportSummaryData";
import { generateReportSummaryPdf } from "@/lib/reportSummaryPdf";

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  const exportPdf = React.useCallback(() => {
    if (!dataset) return;
    generateReportSummaryPdf(dataset);
    toast.success("PDF gerado e baixado com sucesso.");
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
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsSummary;
