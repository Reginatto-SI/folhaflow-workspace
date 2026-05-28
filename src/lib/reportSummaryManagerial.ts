import type { ReportSummaryDataset, SummaryRow } from "@/lib/reportSummaryData";

export type ManagerialRankingRow = {
  companyId: string;
  name: string;
  employees: number;
  salarioLiquido: number;
  percentOfTotal: number;
};

export type ManagerialCompositionRow = {
  key: string;
  label: string;
  value: number;
  percent: number;
};

export type ManagerialSummary = {
  totalEmployees: number;
  rendimentos: number;
  descontos: number;
  salarioLiquido: number;
  custoMedioPorFuncionario: number;
  ranking: ManagerialRankingRow[];
  composition: ManagerialCompositionRow[];
};

const normalize = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

const getRowByKey = (rows: SummaryRow[], key: string) => rows.find((row) => row.key === key);

const getCanonicalRowByKey = (rows: SummaryRow[], key: string) =>
  rows.find((row) => row.isCanonical && row.key === key);

const getRubricRowByKeyOrLabelFallback = (
  rows: SummaryRow[],
  preferredKeys: string[],
  fallbackLabels: string[],
) => {
  const byKey = rows.find((row) => row.kind === "rubric" && preferredKeys.includes(row.key));
  if (byKey) return byKey;

  // Comentário: fallback por label é apenas contingência para bases legadas;
  // a fonte principal deve ser identificador estável (`row.key` da rubrica).
  const normalizedFallbacks = new Set(fallbackLabels.map(normalize));
  return rows.find((row) => row.kind === "rubric" && normalizedFallbacks.has(normalize(row.label)));
};

const getCompositionBase = (rows: SummaryRow[], fallbackValue: number) => {
  const baseProventosTotal = rows.reduce((acc, row) => {
    if (row.kind !== "rubric" || row.rubricType !== "provento" || row.isCanonical) return acc;
    return acc + (Number.isFinite(row.total) ? row.total : 0);
  }, 0);

  // Comentário: na composição, a referência de 100% precisa ser o total de proventos
  // de folha já consolidados no dataset, não a linha gerencial "Rendimentos" do legado
  // (que soma só adicionais e fazia salários aparecerem acima de 100%).
  return baseProventosTotal > 0 ? baseProventosTotal : fallbackValue;
};

export const buildManagerialSummary = (dataset: ReportSummaryDataset): ManagerialSummary => {
  const headcountRow = getRowByKey(dataset.rows, "__headcount__");
  const rendimentosRow = getRowByKey(dataset.rows, "__rendimentos__");
  const descontosRow = getRowByKey(dataset.rows, "__descontos__");
  const custoMedioRow = getRowByKey(dataset.rows, "__custo_medio__");
  const salarioLiquidoRow =
    getCanonicalRowByKey(dataset.rows, "salario_liquido") ??
    dataset.rows.find((row) => row.isCanonical && normalize(row.label) === "SALARIO LIQUIDO");

  const totalSalarioLiquido = salarioLiquidoRow?.total ?? 0;

  const ranking = dataset.companies
    .map((company) => {
      const salarioLiquido = salarioLiquidoRow?.valuesByCompanyId[company.id] ?? 0;
      return {
        companyId: company.id,
        name: company.name,
        employees: Math.round(headcountRow?.valuesByCompanyId[company.id] ?? company.headcount ?? 0),
        salarioLiquido,
        percentOfTotal: totalSalarioLiquido > 0 ? (salarioLiquido / totalSalarioLiquido) * 100 : 0,
      };
    })
    .sort((a, b) => b.salarioLiquido - a.salarioLiquido);

  const totalRendimentos = rendimentosRow?.total ?? 0;

  const salarioCtpsRow = getRubricRowByKeyOrLabelFallback(dataset.rows, ["salario_ctps"], ["Salário CTPS"]);
  const salarioGRow = getRubricRowByKeyOrLabelFallback(dataset.rows, ["salario_g"], ["Salário G"]);
  const salarioFiscalRow =
    getCanonicalRowByKey(dataset.rows, "salario_real") ??
    dataset.rows.find((row) => row.isCanonical && normalize(row.label) === "SALARIO REAL") ??
    getRubricRowByKeyOrLabelFallback(dataset.rows, ["salario_real"], ["Salário Fiscal", "Salário Real"]);
  const outrosRendimentosRow = getRubricRowByKeyOrLabelFallback(dataset.rows, ["outros_rendimentos"], ["Outros Rendimentos", "Outros Rend."]);

  const compositionBase = getCompositionBase(dataset.rows, totalRendimentos);

  const compositionCandidates = [
    { key: "salario_ctps", label: "Salário CTPS", value: salarioCtpsRow?.total ?? 0 },
    { key: "salario_g", label: "Salário G", value: salarioGRow?.total ?? 0 },
    { key: "salario_fiscal", label: "Salário Fiscal", value: salarioFiscalRow?.total ?? 0 },
    { key: "outros_rendimentos", label: "Outros Rendimentos", value: outrosRendimentosRow?.total ?? 0 },
    { key: "descontos", label: "Descontos", value: descontosRow?.total ?? 0 },
    { key: "salario_liquido", label: "Salário Líquido", value: totalSalarioLiquido },
    { key: "base_composicao", label: "Base da Composição", value: compositionBase },
  ];

  const composition = compositionCandidates.map((item) => ({
    ...item,
    percent: compositionBase > 0 ? (item.value / compositionBase) * 100 : 0,
  }));

  return {
    totalEmployees: Math.round(headcountRow?.total ?? 0),
    rendimentos: totalRendimentos,
    descontos: descontosRow?.total ?? 0,
    salarioLiquido: totalSalarioLiquido,
    custoMedioPorFuncionario: custoMedioRow?.total ?? 0,
    ranking,
    composition,
  };
};
