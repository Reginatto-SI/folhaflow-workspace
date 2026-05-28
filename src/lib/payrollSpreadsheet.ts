import { PayrollEntry, Rubric } from "@/types/payroll";

export type SpreadsheetComputedEntry = {
  valuesByRubricId: Record<string, number>;
  earningsTotal: number;
  deductionsTotal: number;
  inssAmount: number;
  netSalary: number;
  baseSalary: number;
};

export type PayrollCalculationResult = SpreadsheetComputedEntry & {
  salarioReal: number;
  g2Complemento: number;
  salarioLiquido: number;
  canonicalDerivedRubricIds: CanonicalDerivedRubricIds;
};

export type CanonicalDerivedRubricIds = {
  salarioRealId: string | null;
  g2ComplementoId: string | null;
  salarioLiquidoId: string | null;
};

type CanonicalDerivedCode = "salario_real" | "g2_complemento" | "salario_liquido";
type CanonicalDerivedResolutionStatus =
  | "resolved_by_code"
  | "resolved_by_legacy_code"
  | "resolved_by_legacy_name"
  | "missing"
  | "ambiguous_code"
  | "ambiguous_name";

type CanonicalDerivedRubricDiagnostic = {
  code: CanonicalDerivedCode;
  status: CanonicalDerivedResolutionStatus;
  resolvedRubricId: string | null;
  candidateRubricIds: string[];
};

export type CanonicalDerivedRubricsDiagnosis = Record<CanonicalDerivedCode, CanonicalDerivedRubricDiagnostic>;

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

const normalizeRubricKey = (value?: string) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // Comentário: remove pontuação trivial (pontos, hífens) e colapsa espaços para
    // que abreviações cadastradas como "Salário G2 complem." casem com aliases canônicos.
    .replace(/[.\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const canonicalLegacyCodeAliases: Record<CanonicalDerivedCode, string[]> = {
  salario_real: [],
  // Compatibilidade com cadastro técnico legado que nomeava a rubrica como “salário G2”.
  // A resolução continua por code, não por label livre da UI.
  g2_complemento: ["salario_g2_complemento"],
  salario_liquido: [],
};

const canonicalLegacyNameAliases: Record<CanonicalDerivedCode, string[]> = {
  salario_real: ["salario real"],
  // Comentário: cobre cadastros legados ("Salário G2 complem.", "Salário G2 complemento", etc.).
  // A regra oficial continua sendo identificação por code canônico (PRD-12); estes aliases
  // são fallback explícito para o cadastro atual do grupo.
  g2_complemento: [
    "g2 complemento",
    "salario g2 complemento",
    "salario g2 complem",
    "salario g2",
  ],
  salario_liquido: ["salario liquido"],
};

const warnedCanonicalResolutionKeys = new Set<string>();

const warnCanonicalResolution = (key: string, message: string, context: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  if (warnedCanonicalResolutionKeys.has(key)) return;
  warnedCanonicalResolutionKeys.add(key);
  console.warn(`[Central de Folha] ${message}`, context);
};

const diagnoseCanonicalRubric = (
  derivedRubrics: Rubric[],
  canonicalCode: CanonicalDerivedCode
): CanonicalDerivedRubricDiagnostic => {
  // Comentário: comparamos códigos já normalizados dos dois lados. O normalizador
  // transforma underscores/hífens em espaço; sem isso, `salario_liquido` caía
  // indevidamente no fallback por nome e podia mascarar configuração canônica errada.
  const normalizedCanonicalCode = normalizeRubricKey(canonicalCode);
  const codeMatches = derivedRubrics.filter((rubric) => normalizeRubricKey(rubric.code) === normalizedCanonicalCode);
  if (codeMatches.length > 1) {
    return {
      code: canonicalCode,
      status: "ambiguous_code",
      resolvedRubricId: null,
      candidateRubricIds: codeMatches.map((rubric) => rubric.id),
    };
  }
  if (codeMatches.length === 1) {
    return {
      code: canonicalCode,
      status: "resolved_by_code",
      resolvedRubricId: codeMatches[0].id,
      candidateRubricIds: codeMatches.map((rubric) => rubric.id),
    };
  }

  const legacyCodeAliases = canonicalLegacyCodeAliases[canonicalCode].map((alias) => normalizeRubricKey(alias));
  const legacyCodeMatches = derivedRubrics.filter((rubric) => legacyCodeAliases.includes(normalizeRubricKey(rubric.code)));
  if (legacyCodeMatches.length > 1) {
    return {
      code: canonicalCode,
      status: "ambiguous_code",
      resolvedRubricId: null,
      candidateRubricIds: legacyCodeMatches.map((rubric) => rubric.id),
    };
  }
  if (legacyCodeMatches.length === 1) {
    return {
      code: canonicalCode,
      status: "resolved_by_legacy_code",
      resolvedRubricId: legacyCodeMatches[0].id,
      candidateRubricIds: legacyCodeMatches.map((rubric) => rubric.id),
    };
  }

  // Comentário: fallback por nome existe apenas para compatibilidade legada transitória.
  // Regra oficial permanece sendo identificação por code canônico (PRD-12).
  const aliases = canonicalLegacyNameAliases[canonicalCode];
  const nameMatches = derivedRubrics.filter((rubric) => aliases.includes(normalizeRubricKey(rubric.name)));

  if (nameMatches.length > 1) {
    return {
      code: canonicalCode,
      status: "ambiguous_name",
      resolvedRubricId: null,
      candidateRubricIds: nameMatches.map((rubric) => rubric.id),
    };
  }

  if (nameMatches.length === 1) {
    return {
      code: canonicalCode,
      status: "resolved_by_legacy_name",
      resolvedRubricId: nameMatches[0].id,
      candidateRubricIds: nameMatches.map((rubric) => rubric.id),
    };
  }

  return {
    code: canonicalCode,
    status: "missing",
    resolvedRubricId: null,
    candidateRubricIds: [],
  };
};

const isCanonicalResolutionConsistent = (status: CanonicalDerivedResolutionStatus) =>
  // Comentário: fallback legado por nome ainda identifica uma única rubrica calculada.
  // O alerta visual deve ficar restrito a ausência/ambiguidade que impeça a Central
  // de identificar com segurança os resultados canônicos.
  status === "resolved_by_code" || status === "resolved_by_legacy_code" || status === "resolved_by_legacy_name";

export const diagnoseCanonicalDerivedRubrics = (rubrics: Rubric[]): CanonicalDerivedRubricsDiagnosis => {
  const derivedRubrics = rubrics.filter((rubric) => rubric.isActive && rubric.nature === "calculada");
  return {
    salario_real: diagnoseCanonicalRubric(derivedRubrics, "salario_real"),
    g2_complemento: diagnoseCanonicalRubric(derivedRubrics, "g2_complemento"),
    salario_liquido: diagnoseCanonicalRubric(derivedRubrics, "salario_liquido"),
  };
};

// Comentário: Centraliza a identificação dos 3 derivados canônicos da Central.
// Divergência anterior: tabela/totais exigiam apenas `code` canônico e podiam zerar
// enquanto o drawer continuava mostrando o derivado por lista de resultados.
// Agora priorizamos `code` (regra oficial PRD-12) e mantemos fallback por `name`
// APENAS como compatibilidade legada explícita, rastreável e determinística.
export const resolveCanonicalDerivedRubricIds = (rubrics: Rubric[]): CanonicalDerivedRubricIds => {
  const diagnosis = diagnoseCanonicalDerivedRubrics(rubrics);

  (Object.keys(diagnosis) as CanonicalDerivedCode[]).forEach((canonicalCode) => {
    const item = diagnosis[canonicalCode];
    if (item.status === "ambiguous_code") {
      // Comentário: inconsistência cadastral deve ser corrigida na origem.
      // A UI não mascara ambiguidade escolhendo rubrica arbitrária.
      warnCanonicalResolution(
        `ambiguous-code:${canonicalCode}`,
        `Mais de uma rubrica calculada ativa encontrada para o código canônico "${canonicalCode}".`,
        { rubricIds: item.candidateRubricIds }
      );
      return;
    }
    if (item.status === "ambiguous_name") {
      warnCanonicalResolution(
        `ambiguous-name:${canonicalCode}`,
        `Fallback legado por nome ficou ambíguo para "${canonicalCode}".`,
        { rubricIds: item.candidateRubricIds, aliases: canonicalLegacyNameAliases[canonicalCode] }
      );
      return;
    }
    if (item.status === "resolved_by_legacy_code") {
      warnCanonicalResolution(
        `legacy-code-fallback:${canonicalCode}`,
        `Rubrica canônica "${canonicalCode}" resolvida por code legado. Atualize para o code canônico quando possível.`,
        { rubricId: item.resolvedRubricId, canonicalCode }
      );
    }
    if (item.status === "resolved_by_legacy_name") {
      warnCanonicalResolution(
        `legacy-fallback:${canonicalCode}`,
        `Rubrica canônica "${canonicalCode}" resolvida por nome legado. Corrija o code no cadastro para evitar dependência transitória.`,
        { rubricId: item.resolvedRubricId }
      );
    }
  });

  const salarioRealId = diagnosis.salario_real.resolvedRubricId;
  const g2ComplementoId = diagnosis.g2_complemento.resolvedRubricId;
  const salarioLiquidoId = diagnosis.salario_liquido.resolvedRubricId;

  return {
    salarioRealId,
    g2ComplementoId,
    salarioLiquidoId,
  };
};

export const hasCanonicalRubricInconsistency = (diagnosis: CanonicalDerivedRubricsDiagnosis) =>
  Object.values(diagnosis).some((item) => !isCanonicalResolutionConsistent(item.status));

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

  // PRD-01/12: rubricas calculadas são saídas readonly.
  // Totais operacionais somam apenas rubricas-base para não duplicar derivados/canônicas.
  const baseRubrics = activeRubrics.filter((rubric) => rubric.nature !== "calculada");

  const earningsTotal = baseRubrics.reduce((sum, rubric) => {
    if (rubric.type !== "provento") return sum;
    return sum + toSafeNumber(valuesByRubricId[rubric.id]);
  }, 0);

  const deductionsTotal = baseRubrics.reduce((sum, rubric) => {
    if (rubric.type !== "desconto") return sum;
    return sum + toSafeNumber(valuesByRubricId[rubric.id]);
  }, 0);

  const inssAmount = activeRubrics.reduce((sum, rubric) => {
    if (rubric.classification !== "inss") return sum;
    return sum + toSafeNumber(valuesByRubricId[rubric.id]);
  }, 0);

  const baseSalary = baseRubrics.reduce((sum, rubric) => {
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

// Comentário: função única de cálculo da Central.
// salario_real, g2_complemento e salario_liquido são rubricas canônicas: drawer,
// tabela e resumo devem consumir estes mesmos campos resolvidos, sem cálculo paralelo.
export const calculatePayroll = ({
  rubrics,
  manualValues,
}: {
  rubrics: Rubric[];
  manualValues: Record<string, number>;
}): PayrollCalculationResult => {
  const computed = computeSpreadsheetEntry({ rubrics, manualValues });
  const canonicalDerivedRubricIds = resolveCanonicalDerivedRubricIds(rubrics);

  return {
    ...computed,
    salarioReal: canonicalDerivedRubricIds.salarioRealId ? (computed.valuesByRubricId[canonicalDerivedRubricIds.salarioRealId] || 0) : 0,
    g2Complemento: canonicalDerivedRubricIds.g2ComplementoId ? (computed.valuesByRubricId[canonicalDerivedRubricIds.g2ComplementoId] || 0) : 0,
    salarioLiquido: canonicalDerivedRubricIds.salarioLiquidoId ? (computed.valuesByRubricId[canonicalDerivedRubricIds.salarioLiquidoId] || 0) : 0,
    canonicalDerivedRubricIds,
  };
};

export const calculatePayrollFromEntry = ({
  entry,
  rubrics,
}: {
  entry: PayrollEntry | null;
  rubrics: Rubric[];
}): PayrollCalculationResult => calculatePayroll({
  rubrics,
  manualValues: getEntryManualValues(entry, rubrics),
});

export const calculatePayrollTotals = ({
  entries,
  rubrics,
}: {
  entries: PayrollEntry[];
  rubrics: Rubric[];
}) =>
  entries.reduce(
    (acc, entry) => {
      const result = calculatePayrollFromEntry({ entry, rubrics });
      acc.salarioReal += result.salarioReal;
      acc.g2Complemento += result.g2Complemento;
      acc.salarioLiquido += result.salarioLiquido;
      acc.totalProventos += result.earningsTotal;
      acc.totalDescontos += result.deductionsTotal;
      return acc;
    },
    {
      salarioReal: 0,
      g2Complemento: 0,
      salarioLiquido: 0,
      totalProventos: 0,
      totalDescontos: 0,
      count: entries.length,
    }
  );
