import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { computeSpreadsheetEntry, getEntryManualValues } from "@/lib/payrollSpreadsheet";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalizeRubricCode = (value?: string) => (value || "").trim().toLowerCase();

const TotalsBar: React.FC = () => {
  const { payrollEntries, rubrics } = usePayroll();
  // Comentário: totais seguem o mesmo contrato visual da grade/drawer (rubricas derivadas canônicas).
  const derivedRubricIds = React.useMemo(() => {
    const activeRubrics = rubrics.filter((rubric) => rubric.isActive && rubric.nature === "calculada");
    const findDerivedId = (code: "salario_real" | "g2_complemento" | "salario_liquido") =>
      activeRubrics.find((rubric) => normalizeRubricCode(rubric.code) === code)?.id || null;

    return {
      salarioRealId: findDerivedId("salario_real"),
      g2ComplementoId: findDerivedId("g2_complemento"),
      salarioLiquidoId: findDerivedId("salario_liquido"),
    };
  }, [rubrics]);

  const totals = React.useMemo(() => {
    let totalSalarioReal = 0;
    let totalG2Complemento = 0;
    let totalSalarioLiquido = 0;

    payrollEntries.forEach((entry) => {
      const computed = computeSpreadsheetEntry({
        rubrics,
        manualValues: getEntryManualValues(entry, rubrics),
      });

      totalSalarioReal += derivedRubricIds.salarioRealId ? (computed.valuesByRubricId[derivedRubricIds.salarioRealId] || 0) : 0;
      totalG2Complemento += derivedRubricIds.g2ComplementoId ? (computed.valuesByRubricId[derivedRubricIds.g2ComplementoId] || 0) : 0;
      totalSalarioLiquido += derivedRubricIds.salarioLiquidoId ? (computed.valuesByRubricId[derivedRubricIds.salarioLiquidoId] || 0) : 0;
    });

    return {
      salarioReal: totalSalarioReal,
      g2Complemento: totalG2Complemento,
      salarioLiquido: totalSalarioLiquido,
      count: payrollEntries.length,
    };
  }, [derivedRubricIds.g2ComplementoId, derivedRubricIds.salarioLiquidoId, derivedRubricIds.salarioRealId, payrollEntries, rubrics]);

  return (
    <div className="bg-card border rounded-md p-3 flex items-center gap-6 mb-3">
      <div>
        <p className="text-xs text-muted-foreground font-medium">Funcionários</p>
        <p className="text-base font-semibold tabular-nums">{totals.count}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div>
        <p className="text-xs text-muted-foreground font-medium">Salário Real</p>
        <p className="text-base font-semibold tabular-nums">{fmt(totals.salarioReal)}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div>
        <p className="text-xs text-muted-foreground font-medium">G2 Complemento</p>
        <p className="text-base font-semibold tabular-nums">{fmt(totals.g2Complemento)}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div>
        <p className="text-xs text-muted-foreground font-medium">Salário Líquido</p>
        <p className="text-base font-semibold tabular-nums text-success">{fmt(totals.salarioLiquido)}</p>
      </div>
    </div>
  );
};

export default TotalsBar;
