import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { calculatePayrollTotals } from "@/lib/payrollSpreadsheet";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TotalsBar: React.FC = () => {
  const { payrollEntries, rubrics } = usePayroll();

  // Comentário: cards de totais também consomem a função única da Central.
  const totals = React.useMemo(() => calculatePayrollTotals({ entries: payrollEntries, rubrics }), [payrollEntries, rubrics]);

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
