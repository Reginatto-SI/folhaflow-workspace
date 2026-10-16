import React from "react";
import { Download, Filter, Info, Percent } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { usePayroll } from "@/contexts/PayrollContext";
import { buildReportSummaryData } from "@/lib/reportSummaryData";
import { resolveCanonicalDerivedRubricIds } from "@/lib/payrollSpreadsheet";
import type { PayrollBatch } from "@/types/payroll";
import type { DashboardPdfData } from "@/lib/dashboardPdf";
import { toast } from "sonner";

const BRL = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PCT = (value: number | null) => (value === null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

const chartCurrency = (value: number) => `R$ ${value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 2 })}`;
const chartTooltipValue = (value: number | string | (number | string)[], name: number | string) => (
  <>
    <span className="text-muted-foreground">{({ rendimentos: "Rendimentos Adicionais", salarioLiquido: "Salário Líquido", diff: "Variação do Salário Líquido" } as Record<string, string>)[name] ?? name}</span>
    <span className="ml-auto font-mono font-medium tabular-nums">{name === "diff" && Number(value) > 0 ? "+" : ""}{BRL(Number(value))}</span>
  </>
);

const Dashboard: React.FC = () => {
  const { activeCompanies, allPayrollBatches, allEmployees, allPayrollEntries, rubrics, isLoading, loadError, payrollCatalogErrors } = usePayroll();
  const { hasPermission, loading: authLoading } = useAuth();
  const companies = React.useMemo(() => activeCompanies ?? [], [activeCompanies]);
  const dataError = loadError || payrollCatalogErrors.payrollEntries;
  const isPending = isLoading || authLoading;
  const canRead = !isPending && !dataError && hasPermission("folha.operar");

  const availableCompetences = React.useMemo(() => {
    const seen = new Map<string, { month: number; year: number }>();
    (allPayrollBatches ?? []).filter((b) => !b.isArchived && companies.some((company) => company.id === b.companyId)).forEach((b) => {
      const key = `${b.month}/${b.year}`;
      if (!seen.has(key)) seen.set(key, { month: b.month, year: b.year });
    });
    return Array.from(seen.values()).sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [allPayrollBatches, companies]);

  const resolveMonth = React.useCallback((key: string) => {
    const [month, year] = key.split("/").map(Number);
    return { month, year };
  }, []);

  const [baseKey, setBaseKey] = React.useState("");
  const [compareKey, setCompareKey] = React.useState("");
  const [companyId, setCompanyId] = React.useState("all");
  const [appliedFilters, setAppliedFilters] = React.useState({ baseKey: "", compareKey: "", companyId: "all" });
  const [isExporting, setIsExporting] = React.useState(false);

  const hasCompetence = React.useCallback((key: string, targetCompanyId: string) =>
    availableCompetences.some((c) => `${c.month}/${c.year}` === key) &&
    (targetCompanyId === "all" || (allPayrollBatches ?? []).some((batch) =>
      !batch.isArchived && batch.companyId === targetCompanyId && `${batch.month}/${batch.year}` === key)),
  [availableCompetences, allPayrollBatches]);
  const selectableCompetences = availableCompetences.filter((c) => hasCompetence(`${c.month}/${c.year}`, companyId));
  const selectionValid = (companyId === "all" || companies.some((company) => company.id === companyId)) &&
    hasCompetence(baseKey, companyId) && (!compareKey || (compareKey !== baseKey && hasCompetence(compareKey, companyId)));
  const appliedFiltersValid = (appliedFilters.companyId === "all" || companies.some((company) => company.id === appliedFilters.companyId)) &&
    hasCompetence(appliedFilters.baseKey, appliedFilters.companyId) &&
    (!appliedFilters.compareKey || (appliedFilters.compareKey !== appliedFilters.baseKey && hasCompetence(appliedFilters.compareKey, appliedFilters.companyId)));
  const filtersChanged = baseKey !== appliedFilters.baseKey || compareKey !== appliedFilters.compareKey || companyId !== appliedFilters.companyId;

  const didInitializeDefaultFilters = React.useRef(false);

  React.useEffect(() => {
    if (!canRead) return;
    if (companyId !== "all" && !companies.some((company) => company.id === companyId)) {
      setCompanyId("all");
      return;
    }

    if (!didInitializeDefaultFilters.current) {
      // Na primeira abertura, comparar o mês corrente com o anterior, quando disponíveis.
      // Sem folha no mês corrente, usar a competência mais recente e a anterior disponível.
      const today = new Date();
      const currentKey = `${today.getMonth() + 1}/${today.getFullYear()}`;
      const latest = availableCompetences.find((c) => hasCompetence(`${c.month}/${c.year}`, companyId));
      const initialBaseKey = hasCompetence(currentKey, companyId)
        ? currentKey
        : latest ? `${latest.month}/${latest.year}` : "";
      if (!initialBaseKey) return;

      const { month, year } = resolveMonth(initialBaseKey);
      const previous = new Date(year, month - 2, 1);
      const previousKey = `${previous.getMonth() + 1}/${previous.getFullYear()}`;
      const earlier = availableCompetences.find((c) =>
        (c.year < year || (c.year === year && c.month < month)) &&
        hasCompetence(`${c.month}/${c.year}`, companyId));
      const initialCompareKey = hasCompetence(previousKey, companyId)
        ? previousKey
        : earlier ? `${earlier.month}/${earlier.year}` : "";

      didInitializeDefaultFilters.current = true;
      setBaseKey(initialBaseKey);
      setCompareKey(initialCompareKey);
      setAppliedFilters({ baseKey: initialBaseKey, compareKey: initialCompareKey, companyId });
      return;
    }

    // Após a abertura, manter o fluxo manual de Aplicar filtros.
    const latest = availableCompetences.find((c) => hasCompetence(`${c.month}/${c.year}`, companyId));
    const nextBaseKey = hasCompetence(baseKey, companyId) ? baseKey : latest ? `${latest.month}/${latest.year}` : "";
    if (nextBaseKey !== baseKey) setBaseKey(nextBaseKey);
    if (compareKey && (compareKey === nextBaseKey || !hasCompetence(compareKey, companyId))) setCompareKey("");
  }, [canRead, companies, companyId, availableCompetences, hasCompetence, baseKey, compareKey, resolveMonth]);

  const baseDataset = React.useMemo(() => {
    if (!canRead || !appliedFiltersValid) return null;
    return buildReportSummaryData({
      month: resolveMonth(appliedFilters.baseKey),
      companies,
      allBatches: allPayrollBatches ?? [],
      allEmployees: allEmployees ?? [],
      allEntries: allPayrollEntries ?? [],
      rubrics: rubrics ?? [],
    });
  }, [canRead, appliedFiltersValid, appliedFilters.baseKey, companies, allPayrollBatches, allEmployees, allPayrollEntries, resolveMonth, rubrics]);

  const compareDataset = React.useMemo(() => {
    if (!canRead || !appliedFiltersValid || !appliedFilters.compareKey) return null;
    return buildReportSummaryData({
      month: resolveMonth(appliedFilters.compareKey),
      companies,
      allBatches: allPayrollBatches ?? [],
      allEmployees: allEmployees ?? [],
      allEntries: allPayrollEntries ?? [],
      rubrics: rubrics ?? [],
    });
  }, [canRead, appliedFiltersValid, appliedFilters.compareKey, companies, allPayrollBatches, allEmployees, allPayrollEntries, resolveMonth, rubrics]);

  const operationalStatuses = React.useMemo(() => {
    if (!appliedFiltersValid) return [];

    const periods = [{ key: appliedFilters.baseKey, label: "Competência base" }];
    if (appliedFilters.compareKey) periods.push({ key: appliedFilters.compareKey, label: "Comparação" });

    return periods.map((period) => {
      const { month, year } = resolveMonth(period.key);
      const batches = (allPayrollBatches ?? []).filter((batch) =>
        !batch.isArchived && batch.month === month && batch.year === year &&
        companies.some((company) => company.id === batch.companyId) &&
        (appliedFilters.companyId === "all" || batch.companyId === appliedFilters.companyId));
      const hasOngoing = batches.some((batch) => batch.status === "em_edicao" || batch.status === "em_revisao");
      const companyCounts = new Map<string, number>();
      batches.forEach((batch) => companyCounts.set(batch.companyId, (companyCounts.get(batch.companyId) ?? 0) + 1));
      const ambiguousCompanies = [...companyCounts.values()].filter((count) => count > 1).length;

      if (ambiguousCompanies > 0) return {
        ...period, hasOngoing, summary: "Status não consolidado",
        detail: `Há múltiplas folhas não arquivadas para ${ambiguousCompanies} ${ambiguousCompanies === 1 ? "empresa" : "empresas"} nesta competência.`,
      };
      if (!batches.length) return {
        ...period, hasOngoing, summary: "Sem folha elegível",
        detail: "Nenhuma folha não arquivada encontrada para esta seleção.",
      };

      const statusLabels: Record<PayrollBatch["status"], { label: string; detail: string }> = {
        em_edicao: { label: "Em edição", detail: "Folha ainda em edição." },
        em_revisao: { label: "Em revisão", detail: "Folha em processo de conferência." },
        finalizado: { label: "Finalizada", detail: "Folha marcada como finalizada no sistema." },
      };
      if (batches.some((batch) => !Object.prototype.hasOwnProperty.call(statusLabels, batch.status))) return {
        ...period, hasOngoing, summary: "Status operacional indisponível",
        detail: "Há folhas com status não reconhecido nesta seleção.",
      };
      if (appliedFilters.companyId !== "all") return {
        ...period, hasOngoing, summary: statusLabels[batches[0].status].label,
        detail: statusLabels[batches[0].status].detail,
      };

      const counts = { finalizado: 0, em_revisao: 0, em_edicao: 0 };
      batches.forEach((batch) => { counts[batch.status] += 1; });
      const countsByStatus = [
        { count: counts.finalizado, singular: "finalizada", plural: "finalizadas" },
        { count: counts.em_revisao, singular: "em revisão", plural: "em revisão" },
        { count: counts.em_edicao, singular: "em edição", plural: "em edição" },
      ].filter(({ count }) => count > 0);
      const summary = countsByStatus.map(({ count, singular, plural }) =>
        `${count} ${countsByStatus.length === 1 ? (count === 1 ? "folha " : "folhas ") : ""}${count === 1 ? singular : plural}`,
      ).join(" · ");
      return { ...period, hasOngoing, summary, detail: null };
    });
  }, [appliedFiltersValid, appliedFilters, allPayrollBatches, companies, resolveMonth]);

  // O resumo usa UUIDs nas linhas de rubrica; as chaves gerenciais permanecem literais.
  const metricRubricIds = React.useMemo(() => {
    const activeRubrics = (rubrics ?? []).filter((rubric) => rubric.isActive);
    const canonical = resolveCanonicalDerivedRubricIds(activeRubrics);
    const classifiedId = (classification: "salario_ctps" | "outros_rendimentos") => {
      const candidates = activeRubrics.filter((rubric) => rubric.type === "provento" && rubric.classification === classification);
      const byCode = candidates.filter((rubric) => rubric.code.trim().toLowerCase() === classification);
      if (byCode.length === 1) return byCode[0].id;
      // Outros Rendimentos também classifica Comissão/Prêmio: não escolher uma rubrica arbitrária desse grupo.
      return classification === "salario_ctps" && candidates.length === 1 ? candidates[0].id : null;
    };
    return {
      salario_liquido: canonical.salarioLiquidoId,
      salario_real: canonical.salarioRealId,
      g2_complemento: canonical.g2ComplementoId,
      salario_ctps: classifiedId("salario_ctps"),
      outros_rendimentos: classifiedId("outros_rendimentos"),
    };
  }, [rubrics]);

  const getMetricRow = React.useCallback((dataset: typeof baseDataset | null, key: string) => {
    const rowKey = Object.prototype.hasOwnProperty.call(metricRubricIds, key)
      ? metricRubricIds[key as keyof typeof metricRubricIds]
      : key;
    return rowKey ? dataset?.rows.find((row) => row.key === rowKey) : undefined;
  }, [metricRubricIds]);

  // Dashboard somente lê valores já consolidados, sem recálculo ou escrita.
  const getMetricValue = React.useCallback((dataset: typeof baseDataset | null, key: string) => {
    const row = getMetricRow(dataset, key);
    if (!row) return 0;
    return appliedFilters.companyId === "all" ? row.total : (row.valuesByCompanyId[appliedFilters.companyId] ?? 0);
  }, [appliedFilters.companyId, getMetricRow]);

  const hasEntries = React.useCallback((dataset: typeof baseDataset, targetCompanyId: string) => {
    const row = dataset?.rows.find((item) => item.key === "__headcount__");
    return (targetCompanyId === "all" ? row?.total ?? 0 : row?.valuesByCompanyId[targetCompanyId] ?? 0) > 0;
  }, []);
  const hasBaseData = hasEntries(baseDataset, appliedFilters.companyId);
  const hasComparisonData = hasEntries(compareDataset, appliedFilters.companyId);

  const calcPct = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    const pct = (current - previous) / previous * 100;
    return Number.isFinite(pct) ? pct : null;
  };

  const selectedCompanyName = companies.find((c) => c.id === appliedFilters.companyId)?.name;
  const isAllCompaniesView = appliedFilters.companyId === "all";

  const cardMetrics = [
    { label: "Funcionários", key: "__headcount__", format: (v: number) => Math.round(v).toLocaleString("pt-BR"), description: "Quantidade de participações/registros nas folhas selecionadas, não necessariamente pessoas únicas. Um funcionário pode ser contado em mais de uma empresa." },
    { label: "Rendimentos Adicionais", key: "__rendimentos__", format: BRL, description: "Total de proventos adicionais classificados, sem incluir os salários-base." },
    { label: "Descontos", key: "__descontos__", format: BRL },
    { label: "Salário Líquido", key: "salario_liquido", format: BRL },
    { label: "Salário G Médio por Registro", key: "__custo_medio__", format: BRL, description: "Média calculada pela divisão do Salário G total pela quantidade de registros considerados na folha. Não representa o custo trabalhista completo." },
  ];

  // Comentário: filtro de empresa aplicado de forma uniforme no histórico, lendo valuesByCompanyId quando necessário.
  const evolutionData = React.useMemo(() => {
    if (!canRead || !appliedFiltersValid) return [];
    const sorted = availableCompetences
      .filter((m) => hasCompetence(`${m.month}/${m.year}`, appliedFilters.companyId))
      .sort((a, b) => (a.year - b.year) || (a.month - b.month)).slice(-6);
    return sorted.flatMap((m) => {
      const ds = buildReportSummaryData({
        month: m,
        companies,
        allBatches: allPayrollBatches ?? [],
        allEmployees: allEmployees ?? [],
        allEntries: allPayrollEntries ?? [],
        rubrics: rubrics ?? [],
      });
      if (!hasEntries(ds, appliedFilters.companyId)) return [];
      return [{
        competencia: new Date(m.year, m.month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }),
        rendimentos: getMetricValue(ds, "__rendimentos__"),
        salarioLiquido: getMetricRow(ds, "salario_liquido") ? getMetricValue(ds, "salario_liquido") : null,
      }];
    });
  }, [canRead, appliedFiltersValid, appliedFilters.companyId, availableCompetences, hasCompetence, companies, allPayrollBatches, allEmployees, allPayrollEntries, rubrics, getMetricValue, getMetricRow, hasEntries]);

  const rankingRows = React.useMemo(() => {
    if (!hasBaseData || !hasComparisonData || !getMetricRow(baseDataset, "salario_liquido") || !getMetricRow(compareDataset, "salario_liquido")) return [];
    return baseDataset.companies.filter((company) => hasEntries(baseDataset, company.id) && hasEntries(compareDataset, company.id)).map((company) => {
      const baseNet = getMetricRow(baseDataset, "salario_liquido")?.valuesByCompanyId[company.id] ?? 0;
      const compareNet = getMetricRow(compareDataset, "salario_liquido")?.valuesByCompanyId[company.id] ?? 0;
      const baseHeadcount = baseDataset.rows.find((r) => r.key === "__headcount__")?.valuesByCompanyId[company.id] ?? 0;
      const compareHeadcount = compareDataset.rows.find((r) => r.key === "__headcount__")?.valuesByCompanyId[company.id] ?? 0;
      const diff = baseNet - compareNet;
      return {
        companyId: company.id,
        company: company.name,
        atual: baseNet,
        anterior: compareNet,
        diff,
        pct: calcPct(baseNet, compareNet),
        headcountDiff: baseHeadcount - compareHeadcount,
      };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) ||
      a.company.localeCompare(b.company, "pt-BR") || a.companyId.localeCompare(b.companyId));
  }, [baseDataset, compareDataset, getMetricRow, hasBaseData, hasComparisonData, hasEntries]);

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
    .filter((item) => hasBaseData && getMetricRow(baseDataset, item.key))
    .map((item) => {
      const atual = getMetricValue(baseDataset, item.key);
      const anterior = hasComparisonData && getMetricRow(compareDataset, item.key) ? getMetricValue(compareDataset, item.key) : null;
      const diff = anterior === null ? null : atual - anterior;
      return { label: item.label, atual, anterior, diff, pct: anterior === null ? null : calcPct(atual, anterior) };
    });

  const variations = rankingRows.length > 0 ? {
    maxUp: rankingRows.filter((row) => row.diff > 0).sort((a, b) => b.diff - a.diff)[0] ?? null,
    maxDown: rankingRows.filter((row) => row.diff < 0).sort((a, b) => a.diff - b.diff)[0] ?? null,
    maxPct: [...rankingRows]
      .filter((row): row is typeof row & { pct: number } => row.pct !== null)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0] ?? null,
  } : null;

  // Os cards e o PDF compartilham os mesmos valores de apresentação.
  const displayedMetrics = cardMetrics.map((metric) => {
    const atual = getMetricValue(baseDataset, metric.key);
    const anterior = hasComparisonData && getMetricRow(compareDataset, metric.key) ? getMetricValue(compareDataset, metric.key) : null;
    const diff = anterior === null || !getMetricRow(baseDataset, metric.key) ? null : atual - anterior;
    const pct = diff === null ? null : calcPct(atual, anterior);
    return { ...metric, atual: getMetricRow(baseDataset, metric.key) ? atual : null, anterior, diff, pct };
  });

  const exportDisabledReason = filtersChanged
    ? "Clique em Aplicar filtros antes de exportar o PDF."
    : !canRead || !appliedFiltersValid || !hasBaseData
      ? "A exportação requer uma competência base válida e lançamentos carregados, sem erros."
      : isExporting ? "Gerando o PDF..." : null;

  const handleExportPdf = async () => {
    if (exportDisabledReason) {
      toast.error(exportDisabledReason);
      return;
    }
    setIsExporting(true);
    try {
      const data: DashboardPdfData = {
        baseCompetence: { ...resolveMonth(appliedFilters.baseKey), label: formatCompetence(appliedFilters.baseKey) },
        comparisonLabel: appliedFilters.compareKey ? formatCompetence(appliedFilters.compareKey) : null,
        companyName: selectedCompanyName || "Todas as empresas",
        statuses: operationalStatuses.map((status) => ({ period: status.label, competence: formatCompetence(status.key), summary: status.summary, detail: status.detail })),
        provisional: operationalStatuses[0]?.hasOngoing ?? false,
        indicators: displayedMetrics.map((metric) => ({ label: metric.label, current: metric.atual === null ? "—" : metric.format(metric.atual), previous: metric.anterior === null ? "—" : metric.format(metric.anterior), difference: metric.diff === null ? "—" : metric.format(metric.diff), percentage: PCT(metric.pct) })),
        indicatorNotes: cardMetrics.filter((metric) => metric.description).map((metric) => `${metric.label}: ${metric.description}`),
        evolution: evolutionData.map((row) => [row.competencia, BRL(row.rendimentos), row.salarioLiquido === null ? "—" : BRL(row.salarioLiquido)]),
        highlights: isAllCompaniesView && variations ? [
          ["Maior aumento (R$)", variations.maxUp?.company ?? "—", variations.maxUp ? `+${BRL(variations.maxUp.diff)}` : "—"],
          ["Maior redução (R$)", variations.maxDown?.company ?? "—", variations.maxDown ? BRL(variations.maxDown.diff) : "—"],
          ["Maior variação percentual absoluta", variations.maxPct?.company ?? "—", PCT(variations.maxPct?.pct ?? null)],
        ] : [],
        ranking: isAllCompaniesView ? rankingRows.map((row) => [row.company, BRL(row.atual), BRL(row.anterior), BRL(row.diff), PCT(row.pct), row.headcountDiff.toLocaleString("pt-BR")]) : [],
        composition: compositionRows.map((row) => ({ label: row.label, current: BRL(row.atual), previous: row.anterior === null ? "—" : BRL(row.anterior), difference: row.diff === null ? "—" : BRL(row.diff), percentage: PCT(row.pct) })),
      };
      const { generateDashboardPdf } = await import("@/lib/dashboardPdf");
      await generateDashboardPdf(data);
      toast.success("PDF gerencial gerado com sucesso.");
    } catch {
      toast.error("Não foi possível gerar o PDF do Dashboard. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isPending) return <Card aria-busy="true"><CardHeader><CardTitle>Dashboard Comparativo da Folha</CardTitle></CardHeader><CardContent role="status" className="text-sm text-muted-foreground">Carregando dados do Dashboard...</CardContent></Card>;
  if (!hasPermission("folha.operar")) return <Alert><AlertTitle>Dados do Dashboard indisponíveis</AlertTitle><AlertDescription>Seu perfil não tem acesso aos dados necessários para este painel. Contate o administrador.</AlertDescription></Alert>;
  if (dataError) return <Alert variant="destructive"><AlertTitle>Não foi possível atualizar o Dashboard</AlertTitle><AlertDescription>{dataError} Os indicadores não serão exibidos enquanto houver erro de carregamento.</AlertDescription></Alert>;

  const comparisonMessage = !appliedFilters.compareKey
    ? "Selecione uma competência de comparação para visualizar as variações."
    : "Não há dados comparáveis disponíveis nas duas competências para esta seleção.";
  const formatCompetence = (key: string) => {
    const { month, year } = resolveMonth(key);
    return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };

  return <div className="space-y-4">
    <Card>
      <CardHeader><CardTitle>Dashboard Comparativo da Folha</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-5">
        <div className="space-y-2"><p className="text-sm font-medium">Competência base</p><Select value={baseKey} onValueChange={setBaseKey} disabled={!selectableCompetences.length}><SelectTrigger><SelectValue placeholder="Sem competência disponível" /></SelectTrigger><SelectContent>{selectableCompetences.map((c) => <SelectItem key={`${c.month}/${c.year}`} value={`${c.month}/${c.year}`}>{new Date(c.year, c.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><p className="text-sm font-medium">Comparar com</p><Select value={compareKey || "none"} onValueChange={(value) => setCompareKey(value === "none" ? "" : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem comparação</SelectItem>{selectableCompetences.filter((c) => `${c.month}/${c.year}` !== baseKey).map((c) => <SelectItem key={`${c.month}/${c.year}`} value={`${c.month}/${c.year}`}>{new Date(c.year, c.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><p className="text-sm font-medium">Empresa</p><Select value={companyId} onValueChange={setCompanyId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas as empresas</SelectItem>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="md:col-span-2 flex flex-wrap items-end justify-end gap-2"><Button disabled={!selectionValid} onClick={() => setAppliedFilters({ baseKey, compareKey, companyId })}><Filter className="mr-2 h-4 w-4" />Aplicar filtros</Button><Tooltip><TooltipTrigger asChild><span tabIndex={exportDisabledReason ? 0 : undefined}><Button variant="outline" disabled={Boolean(exportDisabledReason)} onClick={handleExportPdf}><Download className="mr-2 h-4 w-4" />{isExporting ? "Gerando PDF..." : "Exportar PDF"}</Button></span></TooltipTrigger>{exportDisabledReason && <TooltipContent className="max-w-xs">{exportDisabledReason}</TooltipContent>}</Tooltip></div>
      </CardContent>
    </Card>

    {filtersChanged && <p role="status" className="text-sm text-muted-foreground">Há filtros selecionados ainda não aplicados.</p>}
    {appliedFiltersValid && <p className="text-sm text-muted-foreground">Exibindo: {formatCompetence(appliedFilters.baseKey)} · {selectedCompanyName || "Todas as empresas"} · {appliedFilters.compareKey ? `Comparação: ${formatCompetence(appliedFilters.compareKey)}` : "Sem comparação"}</p>}
    {operationalStatuses.length > 0 && <section aria-label="Status operacional das folhas" className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">{operationalStatuses.map((period) => <div key={period.label} role="group" aria-label={period.label} className="space-y-1 rounded-md border bg-muted/30 p-3">
        <p className="text-sm font-medium">{period.label}: {formatCompetence(period.key)}</p>
        <Badge variant="secondary">{period.summary}</Badge>
        {period.detail && <p className="text-xs text-muted-foreground">{period.detail}</p>}
      </div>)}</div>
      {operationalStatuses[0].hasOngoing && <p className="text-xs text-muted-foreground">Os valores apresentados podem sofrer alterações enquanto houver folhas em andamento.</p>}
    </section>}
    {!appliedFiltersValid ? <Alert><AlertDescription>{availableCompetences.length ? "Selecione filtros válidos e clique em Aplicar filtros." : "Nenhuma competência disponível para consulta nas empresas acessíveis."}</AlertDescription></Alert> : !hasBaseData ? <Alert><AlertDescription>Não há lançamentos na competência base para a empresa selecionada.</AlertDescription></Alert> : null}
    {hasBaseData && appliedFilters.compareKey && !hasComparisonData && <Alert><AlertDescription>A competência de comparação não possui lançamentos para esta seleção. Os valores comparativos estão indisponíveis.</AlertDescription></Alert>}

    {hasBaseData && <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">{displayedMetrics.map((metric) => {
      return <Card key={metric.label}><CardContent className="p-4 space-y-2"><div className="flex items-start gap-1"><p className="text-sm font-semibold">{metric.label}</p>{metric.description && <Tooltip><TooltipTrigger asChild><button type="button" aria-label={`Sobre ${metric.label}`} className="shrink-0 rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-4 w-4" /></button></TooltipTrigger><TooltipContent className="max-w-xs">{metric.description}</TooltipContent></Tooltip>}</div><div className="text-xs text-muted-foreground">Atual</div><div className="font-semibold">{metric.atual === null ? "—" : metric.format(metric.atual)}</div><div className="text-xs text-muted-foreground">Anterior</div><div>{metric.anterior === null ? "—" : metric.format(metric.anterior)}</div><div className={`text-sm font-semibold ${metric.diff === null ? "text-muted-foreground" : metric.diff >= 0 ? "text-green-600" : "text-red-600"}`}>Variação: {metric.diff === null ? "—" : `${metric.format(metric.diff)} (${PCT(metric.pct)})`}</div></CardContent></Card>;
    })}</div>}

    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <Card className="xl:col-span-2"><CardHeader><CardTitle>Evolução por competência</CardTitle><p className="text-sm text-muted-foreground">{evolutionData.length} {evolutionData.length === 1 ? "competência com dados disponíveis" : "competências com dados disponíveis"}, em ordem cronológica (até 6).</p></CardHeader><CardContent>
        {evolutionData.length > 0 ? <ChartContainer config={{ rendimentos: { label: "Rendimentos Adicionais (R$)", color: "hsl(var(--primary))" }, salarioLiquido: { label: "Salário Líquido (R$)", color: "hsl(var(--foreground))" } }} className="h-[320px] w-full">
          <LineChart data={evolutionData}><CartesianGrid vertical={false} /><XAxis dataKey="competencia" /><YAxis tickFormatter={chartCurrency} width={86} /><ChartTooltip content={<ChartTooltipContent formatter={chartTooltipValue} />} /><ChartLegend content={<ChartLegendContent />} /><Line isAnimationActive={false} dataKey="rendimentos" stroke="var(--color-rendimentos)" strokeWidth={2} dot={{ r: 3 }} /><Line isAnimationActive={false} dataKey="salarioLiquido" stroke="var(--color-salarioLiquido)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} /></LineChart>
        </ChartContainer> : <p className="text-sm text-muted-foreground">Não há dados históricos disponíveis para esta seleção.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Principais variações</CardTitle></CardHeader><CardContent className="space-y-4">{isAllCompaniesView ? (variations ? <>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm">Maior aumento (R$)</p>{variations.maxUp && <p className="text-xs text-muted-foreground">{variations.maxUp.company}</p>}</div><p className={`font-semibold ${variations.maxUp ? "text-success" : "text-muted-foreground"}`}>{variations.maxUp ? `+${BRL(variations.maxUp.diff)}` : "—"}</p></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm">Maior redução (R$)</p>{variations.maxDown && <p className="text-xs text-muted-foreground">{variations.maxDown.company}</p>}</div><p className={`font-semibold ${variations.maxDown ? "text-primary" : "text-muted-foreground"}`}>{variations.maxDown ? BRL(variations.maxDown.diff) : "—"}</p></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Percent className="h-4 w-4 text-primary" /><p className="text-sm">Maior variação percentual absoluta</p></div><p className="font-semibold">{variations.maxPct ? `${variations.maxPct.company} (${PCT(variations.maxPct.pct)})` : "—"}</p></div>
      </> : <p className="text-sm text-muted-foreground">{comparisonMessage}</p>) : <p className="text-sm text-muted-foreground">Ranking disponível apenas na visão Todas as empresas.</p>}</CardContent></Card>
    </div>

    {isAllCompaniesView && rankingRows.length > 0 ? (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader><CardTitle>Ranking de variação por empresa</CardTitle><p className="text-sm text-muted-foreground">Ordenado pela variação absoluta do Salário Líquido.</p></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead className="text-right">Atual</TableHead><TableHead className="text-right">Anterior</TableHead><TableHead className="text-right">Diferença R$</TableHead><TableHead className="text-right">Diferença %</TableHead><TableHead className="text-right">Funcionários Δ</TableHead></TableRow></TableHeader><TableBody>{rankingRows.map((row) => <TableRow key={row.companyId}><TableCell>{row.company}</TableCell><TableCell className="text-right">{BRL(row.atual)}</TableCell><TableCell className="text-right">{BRL(row.anterior)}</TableCell><TableCell className={`text-right font-medium ${row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>{BRL(row.diff)}</TableCell><TableCell className="text-right">{PCT(row.pct)}</TableCell><TableCell className="text-right">{row.headcountDiff.toLocaleString("pt-BR")}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Maiores variações do Salário Líquido por empresa</CardTitle><p className="text-sm text-muted-foreground">Empresas com maior variação absoluta entre as competências selecionadas.</p><div className="flex flex-wrap gap-3 text-xs"><span className="text-success">Aumentos</span><span className="text-primary">Reduções</span></div></CardHeader><CardContent>
          <ChartContainer config={{ aumento: { label: "Aumentos", color: "hsl(var(--success))" }, reducao: { label: "Reduções", color: "hsl(var(--primary))" }, neutro: { label: "Sem variação", color: "hsl(var(--muted-foreground))" } }} className="h-[320px] w-full"><BarChart data={rankingRows.slice(0, 6)} layout="vertical"><CartesianGrid horizontal={false} /><XAxis type="number" tickFormatter={chartCurrency} domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]} /><YAxis type="category" dataKey="company" width={120} /><ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" /><ChartTooltip content={<ChartTooltipContent formatter={chartTooltipValue} />} /><Bar isAnimationActive={false} dataKey="diff" fill="var(--color-neutro)" radius={4}>{rankingRows.slice(0, 6).map((row) => <Cell key={row.companyId} fill={`var(--color-${row.diff > 0 ? "aumento" : row.diff < 0 ? "reducao" : "neutro"})`} />)}</Bar></BarChart></ChartContainer>
        </CardContent></Card>
      </div>
    ) : (
      <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{isAllCompaniesView ? comparisonMessage : "Ranking disponível apenas na visão Todas as empresas."}</p></CardContent></Card>
    )}

    {hasBaseData && <Card><CardHeader><CardTitle>Composição da variação</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Atual (R$)</TableHead><TableHead className="text-right">Anterior (R$)</TableHead><TableHead className="text-right">Diferença (R$)</TableHead><TableHead className="text-right">Diferença %</TableHead></TableRow></TableHeader><TableBody>{compositionRows.map((row) => <TableRow key={row.label}><TableCell>{row.label}</TableCell><TableCell className="text-right">{BRL(row.atual)}</TableCell><TableCell className="text-right">{row.anterior === null ? "—" : BRL(row.anterior)}</TableCell><TableCell className={`text-right ${row.diff === null ? "text-muted-foreground" : row.diff >= 0 ? "text-green-600" : "text-red-600"}`}>{row.diff === null ? "—" : BRL(row.diff)}</TableCell><TableCell className="text-right">{PCT(row.pct)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

    {selectedCompanyName && <p className="text-xs text-muted-foreground">Filtro aplicado para empresa: {selectedCompanyName}</p>}
  </div>;
};

export default Dashboard;
