import { Company, Employee, PayrollBatch, PayrollEntry, PayrollMonth, Rubric } from "@/types/payroll";
import { buildReportByCompanyData } from "@/lib/reportByCompanyData";
import { resolveCanonicalDerivedRubricIds } from "@/lib/payrollSpreadsheet";

// Comentário (PRD-08/PRD-12): este helper NÃO recalcula folha.
// Para cada empresa do grupo na competência selecionada, ele apenas reaproveita
// `buildReportByCompanyData` (mesma fonte usada pelo Relatório por Empresa) e
// consolida os totais por rubrica em uma única matriz [linha=rubrica, coluna=empresa].

export type SummaryRowKind = "headcount" | "rubric" | "rendimentos" | "descontos" | "custo_medio";

export type SummaryRow = {
  key: string;            // identificador estável (id da rubrica ou chave da linha derivada)
  label: string;
  kind: SummaryRowKind;
  rubricId?: string;
  rubricType?: Rubric["type"];
  isCanonical?: boolean;  // salario_real / g2_complemento / salario_liquido
  isBold?: boolean;       // destaque visual (linhas finais e canônicas)
  isInteger?: boolean;    // headcount renderiza inteiro, demais como BRL
  valuesByCompanyId: Record<string, number>;
  total: number;
  semImob: number;        // TOTAL - IMOBILIÁRIA (não é "sem movimento")
};

export type SummaryCompanyColumn = {
  id: string;
  name: string;
  headcount: number;
};

export type ReportSummaryDataset = {
  title: string;
  competenceLabel: string;
  month: number;
  year: number;
  companies: SummaryCompanyColumn[];
  rows: SummaryRow[];
};

const monthLabelLegacy = (month: number, year: number) => {
  // Comentário: legado usa "ABRIL-26" (mês em caixa-alta + 2 dígitos do ano).
  const full = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
  return `${full.toUpperCase()}-${String(year).slice(-2)}`;
};

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function buildReportSummaryData(params: {
  month: PayrollMonth;
  companies: Company[];
  allBatches: PayrollBatch[];
  allEmployees: Employee[];
  allEntries: PayrollEntry[];
  rubrics: Rubric[];
}): ReportSummaryDataset {
  const { month, companies, allBatches, allEmployees, allEntries, rubrics } = params;

  const canonical = resolveCanonicalDerivedRubricIds(rubrics);
  const activeRubrics = [...rubrics].filter((r) => r.isActive).sort((a, b) => a.order - b.order);

  // Comentário: a competência corresponde, por empresa, ao batch não arquivado daquele mês/ano.
  const batchByCompany = new Map<string, PayrollBatch | null>();
  companies.forEach((company) => {
    const batch = allBatches.find(
      (b) => b.companyId === company.id && b.month === month.month && b.year === month.year && !b.isArchived,
    ) || null;
    batchByCompany.set(company.id, batch);
  });

  // Reaproveita o helper oficial por empresa para garantir mesma leitura/canônicas.
  const datasetByCompany = new Map<string, ReturnType<typeof buildReportByCompanyData>>();
  companies.forEach((company) => {
    datasetByCompany.set(
      company.id,
      buildReportByCompanyData({
        company,
        month,
        batch: batchByCompany.get(company.id) ?? null,
        allBatches,
        allEmployees,
        allEntries,
        rubrics,
      }),
    );
  });

  const columns: SummaryCompanyColumn[] = companies.map((company) => {
    const ds = datasetByCompany.get(company.id)!;
    const headcount = ds.rows.length;
    return { id: company.id, name: company.name, headcount };
  });

  // Regra de apresentação do legado: "SEM IMOB." = TOTAL - IMOBILIÁRIA.
  // Não é "empresa sem movimento" e não recalcula a folha; apenas subtrai uma coluna existente.
  const normalize = (value: string) =>
    String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  const imobCompanyId =
    columns.find((c) => {
      const normalizedName = normalize(c.name);
      return normalizedName === "IMOBILIARIA";
    })?.id ?? null;

  const makeRow = (
    key: string,
    label: string,
    kind: SummaryRowKind,
    getValue: (companyId: string) => number,
    extras: Partial<SummaryRow> = {},
  ): SummaryRow => {
    const valuesByCompanyId: Record<string, number> = {};
    let total = 0;
    let imobValue = 0;
    columns.forEach((col) => {
      const v = toNumber(getValue(col.id));
      valuesByCompanyId[col.id] = v;
      total += v;
      if (imobCompanyId && col.id === imobCompanyId) imobValue = v;
    });
    return { key, label, kind, valuesByCompanyId, total, semImob: total - imobValue, ...extras };
  };

  const rows: SummaryRow[] = [];

  // Linha inicial: Total de Funcionários (headcount derivado das linhas do relatório por empresa).
  rows.push(
    makeRow(
      "__headcount__",
      "Total de Funcionários",
      "headcount",
      (companyId) => columns.find((c) => c.id === companyId)?.headcount ?? 0,
      { isInteger: true, isBold: true },
    ),
  );

  // Linhas por rubrica (na ordem oficial). Reaproveita totalsByRubricId já consolidado.
  activeRubrics.forEach((rubric) => {
    const isCanonical =
      rubric.id === canonical.salarioRealId ||
      rubric.id === canonical.g2ComplementoId ||
      rubric.id === canonical.salarioLiquidoId;

    rows.push(
      makeRow(
        rubric.id,
        rubric.name,
        "rubric",
        (companyId) => datasetByCompany.get(companyId)?.totalsByRubricId[rubric.id] ?? 0,
        {
          rubricId: rubric.id,
          rubricType: rubric.type,
          isCanonical,
          isBold: isCanonical,
        },
      ),
    );
  });

  // Linhas finais derivadas (somatórios já calculados — não há novo motor).
  const proventos = activeRubrics.filter(
    (r) =>
      r.type === "provento" &&
      r.id !== canonical.salarioRealId &&
      r.id !== canonical.g2ComplementoId &&
      r.id !== canonical.salarioLiquidoId,
  );
  const descontos = activeRubrics.filter((r) => r.type === "desconto");

  rows.push(
    makeRow(
      "__rendimentos__",
      "Rendimentos",
      "rendimentos",
      (companyId) =>
        proventos.reduce(
          (acc, r) => acc + toNumber(datasetByCompany.get(companyId)?.totalsByRubricId[r.id] ?? 0),
          0,
        ),
      { isBold: true },
    ),
  );

  rows.push(
    makeRow(
      "__descontos__",
      "Descontos",
      "descontos",
      (companyId) =>
        descontos.reduce(
          (acc, r) => acc + toNumber(datasetByCompany.get(companyId)?.totalsByRubricId[r.id] ?? 0),
          0,
        ),
      { isBold: true },
    ),
  );

  // Custo médio por funcionário no legado = Salário G / headcount (por empresa).
  // A linha base já existe no próprio resumo (linha de rubrica "Salário G").
  // Não recalculamos rubrica: apenas reaproveitamos o valor consolidado já montado acima.
  const salarioGRow = rows.find((r) => normalize(r.label) === "SALARIO G");

  const custoMedioValues: Record<string, number> = {};
  columns.forEach((col) => {
    const salarioG = salarioGRow?.valuesByCompanyId[col.id] ?? 0;
    custoMedioValues[col.id] = col.headcount > 0 ? salarioG / col.headcount : 0;
  });
  const totalSalarioG = salarioGRow?.total ?? 0;
  const totalHeadcount = columns.reduce((acc, c) => acc + c.headcount, 0);
  const imobHeadcount = imobCompanyId ? (columns.find((c) => c.id === imobCompanyId)?.headcount ?? 0) : 0;
  const imobSalarioG = imobCompanyId ? (salarioGRow?.valuesByCompanyId[imobCompanyId] ?? 0) : 0;

  rows.push({
    key: "__custo_medio__",
    label: "Custo médio por Func.",
    kind: "custo_medio",
    valuesByCompanyId: custoMedioValues,
    total: totalHeadcount > 0 ? totalSalarioG / totalHeadcount : 0,
    // Para média, SEM IMOB. não é subtração direta da média da IMOBILIÁRIA.
    // Regra correta: (Salário G total - Salário G IMOB) / (Headcount total - Headcount IMOB).
    semImob: totalHeadcount - imobHeadcount > 0 ? (totalSalarioG - imobSalarioG) / (totalHeadcount - imobHeadcount) : 0,
    isBold: true,
  });

  const competenceLabel = monthLabelLegacy(month.month, month.year);

  return {
    title: `Resumo de Folha de Pagamento - ${competenceLabel}`,
    competenceLabel,
    month: month.month,
    year: month.year,
    companies: columns,
    rows,
  };
}
