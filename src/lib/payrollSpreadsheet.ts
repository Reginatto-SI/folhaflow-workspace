import { PayrollEntry, Rubric } from "@/types/payroll";

export type SpreadsheetComputedEntry = {
  valuesByRubricId: Record<string, number>;
  earningsTotal: number;
  deductionsTotal: number;
  inssAmount: number;
  netSalary: number;
  baseSalary: number;
};

const toSafeNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getLegacyValue = (rubric: Rubric, payload: Record<string, number>) => {
  const directById = payload[rubric.id];
  if (typeof directById === "number") return directById;

  const byCode = payload[rubric.code];
  if (typeof byCode === "number") return byCode;

  const byName = payload[rubric.name];
  if (typeof byName === "number") return byName;

  return 0;
};

const resolveFormulaRubric = (
  rubric: Rubric,
  valuesByRubricId: Record<string, number>,
  rubricsById: Map<string, Rubric>
): number => {
  const orderedItems = [...(rubric.formulaItems || [])].sort((a, b) => a.order - b.order);
  return orderedItems.reduce((total, item) => {
    const sourceRubric = rubricsById.get(item.sourceRubricId);
    if (!sourceRubric) return total;
    const sourceValue = toSafeNumber(valuesByRubricId[sourceRubric.id]);
    if (item.operation === "subtract") return total - sourceValue;
    return total + sourceValue;
  }, 0);
};

// Centralização do fluxo "planilha" da Central de Folha:
// 1) valores manuais (editáveis) entram como fonte única local;
// 2) rubricas derivadas (nature=calculada) são resolvidas no frontend;
// 3) totais consolidados da UI saem deste cálculo único e previsível.
export const computeSpreadsheetEntry = ({
  rubrics,
  manualValues,
}: {
  rubrics: Rubric[];
  manualValues: Record<string, number>;
}): SpreadsheetComputedEntry => {
  const activeRubrics = [...rubrics]
    .filter((rubric) => rubric.isActive)
    .sort((a, b) => a.order - b.order);
  const rubricsById = new Map(activeRubrics.map((rubric) => [rubric.id, rubric]));

  const valuesByRubricId: Record<string, number> = {};

  activeRubrics.forEach((rubric) => {
    if (rubric.nature !== "calculada") {
      valuesByRubricId[rubric.id] = toSafeNumber(manualValues[rubric.id]);
    }
  });

  // Passes simples para suportar dependência entre rubricas derivadas.
  // Mantemos abordagem determinística e leve (sem arquitetura pesada).
  for (let pass = 0; pass < activeRubrics.length; pass += 1) {
    let changed = false;

    activeRubrics.forEach((rubric) => {
      if (rubric.nature !== "calculada") return;

      let nextValue = 0;
      if (rubric.calculationMethod === "valor_fixo") {
        nextValue = toSafeNumber(rubric.fixedValue);
      } else if (rubric.calculationMethod === "percentual") {
        const baseValue = rubric.percentageBaseRubricId ? toSafeNumber(valuesByRubricId[rubric.percentageBaseRubricId]) : 0;
        nextValue = baseValue * (toSafeNumber(rubric.percentageValue) / 100);
      } else if (rubric.calculationMethod === "formula") {
        nextValue = resolveFormulaRubric(rubric, valuesByRubricId, rubricsById);
      } else {
        // Fallback seguro: rubrica calculada sem método explícito mantém 0 na visão planilha.
        nextValue = 0;
      }

      if (toSafeNumber(valuesByRubricId[rubric.id]) !== nextValue) {
        valuesByRubricId[rubric.id] = nextValue;
        changed = true;
      }
    });

    if (!changed) break;
  }

  const earningsTotal = activeRubrics.reduce((sum, rubric) => {
    if (rubric.type !== "provento") return sum;
    return sum + toSafeNumber(valuesByRubricId[rubric.id]);
  }, 0);

  const deductionsTotal = activeRubrics.reduce((sum, rubric) => {
    if (rubric.type !== "desconto") return sum;
    return sum + toSafeNumber(valuesByRubricId[rubric.id]);
  }, 0);

  const inssAmount = activeRubrics.reduce((sum, rubric) => {
    if (rubric.classification !== "inss") return sum;
    return sum + toSafeNumber(valuesByRubricId[rubric.id]);
  }, 0);

  const baseSalary = activeRubrics.reduce((sum, rubric) => {
    if (rubric.nature !== "base" || rubric.type !== "provento") return sum;
    return sum + toSafeNumber(valuesByRubricId[rubric.id]);
  }, 0);

  return {
    valuesByRubricId,
    earningsTotal,
    deductionsTotal,
    inssAmount,
    netSalary: earningsTotal - deductionsTotal,
    baseSalary,
  };
};

export const getEntryManualValues = (entry: PayrollEntry | null, rubrics: Rubric[]) => {
  if (!entry) return {};

  const activeRubrics = rubrics.filter((rubric) => rubric.isActive);
  return activeRubrics.reduce<Record<string, number>>((acc, rubric) => {
    const source = rubric.type === "desconto" ? entry.deductions : entry.earnings;
    acc[rubric.id] = getLegacyValue(rubric, source || {});
    return acc;
  }, {});
};
