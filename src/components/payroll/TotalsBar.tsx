import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { computeSpreadsheetEntry, getEntryManualValues } from "@/lib/payrollSpreadsheet";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TotalsBar: React.FC = () => {
  const { payrollEntries, rubrics } = usePayroll();

  const totals = React.useMemo(() => {
    let gross = 0;
    let totalDeductions = 0;
    let totalInss = 0;
    let net = 0;

    payrollEntries.forEach((entry) => {
      const computed = computeSpreadsheetEntry({
        rubrics,
        manualValues: getEntryManualValues(entry, rubrics),
      });
      gross += computed.earningsTotal;
      totalDeductions += computed.deductionsTotal;
      totalInss += computed.inssAmount;
      net += computed.netSalary;
    });

    return { gross, deductions: totalDeductions, inss: totalInss, net, count: payrollEntries.length };
  }, [payrollEntries, rubrics]);

  return (
    <div className="bg-card border rounded-md p-3 flex items-center gap-6 mb-3">
      <div>
        <p className="text-xs text-muted-foreground font-medium">Funcionários</p>
        <p className="text-base font-semibold tabular-nums">{totals.count}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div>
        <p className="text-xs text-muted-foreground font-medium">Total Bruto</p>
        <p className="text-base font-semibold tabular-nums">{fmt(totals.gross)}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div>
        <p className="text-xs text-muted-foreground font-medium">Descontos</p>
        <p className="text-base font-semibold tabular-nums text-destructive">{fmt(totals.deductions)}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div>
        <p className="text-xs text-muted-foreground font-medium">INSS</p>
        <p className="text-base font-semibold tabular-nums text-muted-foreground">{fmt(totals.inss)}</p>
      </div>
      <div className="h-7 w-px bg-border" />
      <div>
        <p className="text-xs text-muted-foreground font-medium">Líquido Total</p>
        <p className="text-base font-semibold tabular-nums text-success">{fmt(totals.net)}</p>
      </div>
    </div>
  );
};

export default TotalsBar;
