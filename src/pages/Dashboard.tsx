import React from "react";
import { Download, Filter, Percent } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePayroll } from "@/contexts/PayrollContext";
import { buildReportSummaryData } from "@/lib/reportSummaryData";

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PCT = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

const Dashboard: React.FC = () => {
  const { activeCompanies, allPayrollBatches, allEmployees, allPayrollEntries, rubrics, selectedMonth } = usePayroll();
  const companies = activeCompanies ?? [];

  const availableCompetences = React.useMemo(() => {
    const seen = new Map<string, { month: number; year: number }>();
    (allPayrollBatches ?? []).filter((b) => !b.isArchived).forEach((b) => {
      const key = `${b.month}/${b.year}`;
      if (!seen.has(key)) seen.set(key, { month: b.month, year: b.year });
    });
    return Array.from(seen.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [allPayrollBatches]);

  const resolveMonth = React.useCallback((key: string) => {
    const [month, year] = key.split("/").map(Number);
    return { month, year };
  }, []);

  const selectedMonthKey = `${selectedMonth.month}/${selectedMonth.year}`;
  const [baseKey, setBaseKey] = React.useState(selectedMonthKey);
  const [compareKey, setCompareKey] = React.useState("");
  const [companyId, setCompanyId] = React.useState("all");
  const [appliedFilters, setAppliedFilters] = React.useState({ baseKey: selectedMonthKey, compareKey: "", companyId: "all" });

  React.useEffect(() => {
    const baseExists = availableCompetences.some((c) => `${c.month}/${c.year}` === baseKey);
    const normalizedBaseKey = baseExists ? baseKey : selectedMonthKey;

    const baseIndex = availableCompetences.findIndex((c) => `${c.month}/${c.year}` === normalizedBaseKey);
    const previous = baseIndex >= 0 ? availableCompetences[baseIndex + 1] : undefined;
    const suggestedCompareKey = previous ? `${previous.month}/${previous.year}` : "";

    if (normalizedBaseKey !== baseKey) setBaseKey(normalizedBaseKey);
    if (!compareKey || compareKey === normalizedBaseKey || !availableCompetences.some((c) => `${c.month}/${c.year}` === compareKey)) {
      setCompareKey(suggestedCompareKey);
    }
  }, [availableCompetences, baseKey, compareKey, selectedMonthKey]);

  React.useEffect(() => {
    if (!appliedFilters.compareKey && compareKey) {
      setAppliedFilters({ baseKey, compareKey, companyId });
    }
  }, [appliedFilters.compareKey, baseKey, compareKey, companyId]);

  const baseDataset = React.useMemo(() => {
    return buildReportSummaryData({
      month: resolveMonth(appliedFilters.baseKey),
      companies,
      allBatches: allPayrollBatches ?? [],
      allEmployees: allEmployees ?? [],
      allEntries: allPayrollEntries ?? [],
      rubrics: rubrics ?? [],
    });
  }, [appliedFilters.baseKey, companies, allPayrollBatches, allEmployees, allPayrollEntries, resolveMonth, rubrics]);

  const compareDataset = React.useMemo(() => {
    if (!appliedFilters.compareKey) return null;
    return buildReportSummaryData({
      month: resolveMonth(appliedFilters.compareKey),
      companies,
      allBatches: allPayrollBatches ?? [],
      allEmployees: allEmployees ?? [],
      allEntries: allPayrollEntries ?? [],
      rubrics: rubrics ?? [],
    });
  }, [appliedFilters.compareKey, companies, allPayrollBatches, allEmployees, allPayrollEntries, resolveMonth, rubrics]);

  // Comentário: dashboard somente compara dados já consolidados (sem recálculo da folha).
  const getMetricValue = React.useCallback((dataset: typeof baseDataset | null, key: string) => {
    if (!dataset) return 0;
    const row = dataset.rows.find((r) => r.key === key);
    if (!row) return 0;
    return appliedFilters.companyId === "all" ? row.total : (row.valuesByCompanyId[appliedFilters.companyId] ?? 0);
  }, [appliedFilters.companyId]);

  const calcPct = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    const pct = (current - previous) / previous * 100;
    return Number.isFinite(pct) ? pct : null;
  };

  const selectedCompanyName = companies.find((c) => c.id === appliedFilters.companyId)?.name;
  const isAllCompaniesView = appliedFilters.companyId === "all";

  const cardMetrics = [
    { label: "Funcionários", key: "__headcount__", format: (v: number) => Math.round(v).toLocaleString("pt-BR") },
    { label: "Rendimentos", key: "__rendimentos__", format: BRL },
    { label: "Descontos", key: "__descontos__", format: BRL },
    { label: "Salário Líquido", key: "salario_liquido", format: BRL },
    { label: "Custo Médio por Funcionário", key: "__custo_medio__", format: BRL },
  ];

  // Comentário: filtro de empresa aplicado de forma uniforme no histórico, lendo valuesByCompanyId quando necessário.
  const evolutionData = React.useMemo(() => {
    const sorted = [...availableCompetences].sort((a, b) => (a.year - b.year) || (a.month - b.month)).slice(-6);
    return sorted.map((m) => {
      const ds = buildReportSummaryData({
        month: m,
        companies,
        allBatches: allPayrollBatches ?? [],
        allEmployees: allEmployees ?? [],
        allEntries: allPayrollEntries ?? [],
        rubrics: rubrics ?? [],
      });
      return {
        competencia: new Date(m.year, m.month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
        rendimentos: getMetricValue(ds, "__rendimentos__"),
        salarioLiquido: getMetricValue(ds, "salario_liquido"),
      };
    });
  }, [availableCompetences, companies, allPayrollBatches, allEmployees, allPayrollEntries, rubrics, getMetricValue]);

  const rankingRows = React.useMemo(() => {
    if (!compareDataset) return [];
    return baseDataset.companies.map((company) => {
      const baseNet = baseDataset.rows.find((r) => r.key === "salario_liquido")?.valuesByCompanyId[company.id] ?? 0;
      const compareNet = compareDataset.rows.find((r) => r.key === "salario_liquido")?.valuesByCompanyId[company.id] ?? 0;
      const baseHeadcount = baseDataset.rows.find((r) => r.key === "__headcount__")?.valuesByCompanyId[company.id] ?? 0;
      const compareHeadcount = compareDataset.rows.find((r) => r.key === "__headcount__")?.valuesByCompanyId[company.id] ?? 0;
      const diff = baseNet - compareNet;
      return {
        company: company.name,
        atual: baseNet,
        anterior: compareNet,
        diff,
        pct: calcPct(baseNet, compareNet),
        headcountDiff: baseHeadcount - compareHeadcount,
      };
    }).sort((a, b) => b.diff - a.diff);
  }, [baseDataset, compareDataset]);

  // Comentário: composição usa apenas chaves estáveis do dataset (row.key), sem heurística por label.
  const compositionMap = [
    { label: "Salário CTPS", key: "salario_ctps" },
    { label: "G2 Complemento", key: "g2_complemento" },
    { label: "Salário Real", key: "salario_real" },
    { label: "Outros Rendimentos", key: "outros_rendimentos" },
    { label: "Descontos", key: "__descontos__" },
    { label: "Salário Líquido", key: "salario_liquido" },
  ];

  const compositionRows = compositionMap
    .filter((item) => baseDataset.rows.some((row) => row.key === item.key) && (compareDataset ? compareDataset.rows.some((row) => row.key === item.key) : true))
    .map((item) => {
      const atual = getMetricValue(baseDataset, item.key);
      const anterior = getMetricValue(compareDataset, item.key);
      const diff = atual - anterior;
      return { label: item.label, atual, anterior, diff, pct: calcPct(atual, anterior) };
    });

  const variations = rankingRows.length > 0 ? {
    maxUp: [...rankingRows].sort((a, b) => b.diff - a.diff)[0],
    maxDown: [...rankingRows].sort((a, b) => a.diff - b.diff)[0],
    maxPct: [...rankingRows]
      .filter((row) => row.pct !== null)
      .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0] ?? null,
  } : null;

  return <div className="space-y-4">
    <Card>
      <CardHeader><CardTitle>Dashboard Comparativo da Folha</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-5">
        <div className="space-y-2"><p className="text-sm font-medium">Competência base</p><Select value={baseKey} onValueChange={setBaseKey}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{availableCompetences.map((c) => <SelectItem key={`${c.month}/${c.year}`} value={`${c.month}/${c.year}`}>{new Date(c.year, c.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><p className="text-sm font-medium">Comparar com</p><Select value={compareKey} onValueChange={setCompareKey}><SelectTrigger><SelectValue placeholder="Sem competência anterior disponível" /></SelectTrigger><SelectContent>{availableCompetences.filter((c) => `${c.month}/${c.year}` !== baseKey).map((c) => <SelectItem key={`${c.month}/${c.year}`} value={`${c.month}/${c.year}`}>{new Date(c.year, c.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><p className="text-sm font-medium">Empresa</p><Select value={companyId} onValueChange={setCompanyId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as empresas</SelectItem>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="md:col-span-2 flex items-end justify-end gap-2"><Button disabled={!compareKey} onClick={() => setAppliedFilters({ baseKey, compareKey, companyId })}><Filter className="mr-2 h-4 w-4" />Aplicar filtros</Button><Tooltip><TooltipTrigger asChild><span><Button variant="outline" disabled><Download className="mr-2 h-4 w-4" />Exportar</Button></span></TooltipTrigger><TooltipContent>Exportação do dashboard será implementada em etapa futura.</TooltipContent></Tooltip></div>
      </CardContent>
    </Card>

    <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">{cardMetrics.map((metric) => {
      const atual = getMetricValue(baseDataset, metric.key);
      const anterior = getMetricValue(compareDataset, metric.key);
      const diff = atual - anterior;
      const pct = calcPct(atual, anterior);
      const positive = diff >= 0;
      return <Card key={metric.label}><CardContent className="p-4 space-y-2"><p className="text-sm font-semibold">{metric.label}</p><div className="text-xs text-muted-foreground">Atual</div><div className="font-semibold">{metric.format(atual)}</div><div className="text-xs text-muted-foreground">Anterior</div><div>{metric.format(anterior)}</div><div className={`text-sm font-semibold ${positive ? "text-green-600" : "text-red-600"}`}>Variação: {metric.format(diff)} ({PCT(pct)})</div></CardContent></Card>;
    })}</div>

    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <Card className="xl:col-span-2"><CardHeader><CardTitle>Evolução dos últimos 6 meses</CardTitle></CardHeader><CardContent>
        <ChartContainer config={{ rendimentos: { label: "Rendimentos (R$)", color: "hsl(var(--chart-1))" }, salarioLiquido: { label: "Salário Líquido (R$)", color: "hsl(var(--chart-2))" } }} className="h-[320px] w-full">
          <LineChart data={evolutionData}><CartesianGrid vertical={false} /><XAxis dataKey="competencia" /><YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)} mi`} /><ChartTooltip content={<ChartTooltipContent />} /><ChartLegend content={<ChartLegendContent />} /><Line dataKey="rendimentos" stroke="var(--color-rendimentos)" dot={false} /><Line dataKey="salarioLiquido" stroke="var(--color-salarioLiquido)" dot={false} /></LineChart>
        </ChartContainer>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Principais variações</CardTitle></CardHeader><CardContent className="space-y-4">{isAllCompaniesView ? (variations && <>
        <div className="flex items-center justify-between"><div><p className="text-sm">Maior aumento (R$)</p><p className="text-xs text-muted-foreground">{variations.maxUp.company}</p></div><p className="font-semibold text-green-600">+{BRL(variations.maxUp.diff)}</p></div>
        <div className="flex items-center justify-between"><div><p className="text-sm">Maior redução (R$)</p><p className="text-xs text-muted-foreground">{variations.maxDown.company}</p></div><p className="font-semibold text-red-600">{BRL(variations.maxDown.diff)}</p></div>
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Percent className="h-4 w-4 text-primary" /><p className="text-sm">Maior variação percentual</p></div><p className="font-semibold">{variations.maxPct ? `${variations.maxPct.company} (${PCT(variations.maxPct.pct)})` : "—"}</p></div>
      </>) : <p className="text-sm text-muted-foreground">Ranking disponível apenas na visão Todas as empresas.</p>}</CardContent></Card>
    </div>

    {isAllCompaniesView ? (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Ranking de variação por empresa</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead className="text-right">Atual</TableHead><TableHead className="text-right">Anterior</TableHead><TableHead className="text-right">Diferença R$</TableHead><TableHead className="text-right">Diferença %</TableHead><TableHead className="text-right">Funcionários Δ</TableHead></TableRow></TableHeader><TableBody>{rankingRows.map((row) => <TableRow key={row.company}><TableCell>{row.company}</TableCell><TableCell className="text-right">{BRL(row.atual)}</TableCell><TableCell className="text-right">{BRL(row.anterior)}</TableCell><TableCell className={`text-right font-medium ${row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>{BRL(row.diff)}</TableCell><TableCell className="text-right">{PCT(row.pct)}</TableCell><TableCell className="text-right">{row.headcountDiff.toLocaleString("pt-BR")}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Empresas com maior impacto na variação (R$)</CardTitle></CardHeader><CardContent>
          <ChartContainer config={{ impact: { label: "Impacto", color: "hsl(var(--chart-1))" } }} className="h-[320px] w-full"><BarChart data={rankingRows.slice(0, 6)} layout="vertical"><CartesianGrid horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="company" width={120} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="diff" fill="var(--color-impact)" radius={4} /></BarChart></ChartContainer>
        </CardContent></Card>
      </div>
    ) : (
      <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Ranking disponível apenas na visão Todas as empresas.</p></CardContent></Card>
    )}

    <Card><CardHeader><CardTitle>Composição da variação</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Atual (R$)</TableHead><TableHead className="text-right">Anterior (R$)</TableHead><TableHead className="text-right">Diferença (R$)</TableHead><TableHead className="text-right">Diferença %</TableHead></TableRow></TableHeader><TableBody>{compositionRows.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell className="text-right">{BRL(row.atual)}</TableCell><TableCell className="text-right">{BRL(row.anterior)}</TableCell><TableCell className={`text-right ${row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>{BRL(row.diff)}</TableCell><TableCell className="text-right">{PCT(row.pct)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

    {selectedCompanyName && <p className="text-xs text-muted-foreground">Filtro aplicado para empresa: {selectedCompanyName}</p>}
  </div>;
};

export default Dashboard;
