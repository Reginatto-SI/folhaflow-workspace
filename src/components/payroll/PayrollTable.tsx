import React, { useState, useCallback } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { ChevronDown, ChevronRight } from "lucide-react";
import EditableCell from "./EditableCell";
import EmployeeRowExpansion from "./EmployeeRowExpansion";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const EDITABLE_COLS = ["baseSalary", "horasExtras", "bonus", "vt", "vr", "inss", "irrf"];

const PayrollTable: React.FC = () => {
  const { payrollEntries, updatePayrollEntry, allEmployees } = usePayroll();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleNavigate = useCallback(
    (row: number, col: number) => {
      const maxRow = payrollEntries.length - 1;
      const maxCol = EDITABLE_COLS.length - 1;
      const clampedRow = Math.max(0, Math.min(row, maxRow));
      const clampedCol = Math.max(0, Math.min(col, maxCol));
      setActiveCell({ row: clampedRow, col: clampedCol });
    },
    [payrollEntries.length]
  );

  const handleCellChange = useCallback(
    (entryId: string, colKey: string, value: number) => {
      const entry = payrollEntries.find((e) => e.id === entryId);
      if (!entry) return;

      if (colKey === "baseSalary") {
        updatePayrollEntry(entryId, { baseSalary: value });
      } else if (["horasExtras", "bonus"].includes(colKey)) {
        const key = colKey === "horasExtras" ? "Horas Extras" : "Bônus";
        updatePayrollEntry(entryId, { earnings: { ...entry.earnings, [key]: value } });
      } else {
        const keyMap: Record<string, string> = { vt: "Vale Transporte", vr: "Vale Refeição", inss: "INSS", irrf: "IRRF" };
        updatePayrollEntry(entryId, { deductions: { ...entry.deductions, [keyMap[colKey]]: value } });
      }
    },
    [payrollEntries, updatePayrollEntry]
  );

  const getCellValue = (entry: (typeof payrollEntries)[0], colKey: string): number => {
    if (colKey === "baseSalary") return entry.baseSalary;
    if (colKey === "horasExtras") return entry.earnings["Horas Extras"] || 0;
    if (colKey === "bonus") return entry.earnings["Bônus"] || 0;
    const keyMap: Record<string, string> = { vt: "Vale Transporte", vr: "Vale Refeição", inss: "INSS", irrf: "IRRF" };
    return entry.deductions[keyMap[colKey]] || 0;
  };

  const colSpan = 10;

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="w-8 px-3 py-3" />
              <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Funcionário</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Salário Base</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-l">Horas Extras</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Bônus</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-l">VT</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">VR</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">INSS</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">IRRF</th>
              <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-l bg-muted/80">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {payrollEntries.map((entry, rowIndex) => {
              const employee = allEmployees.find((e) => e.id === entry.employeeId);
              const totalEarnings = Object.values(entry.earnings).reduce((a, b) => a + b, 0);
              const totalDeductions = Object.values(entry.deductions).reduce((a, b) => a + b, 0);
              const gross = entry.baseSalary + totalEarnings;
              const net = gross - totalDeductions;
              const isExpanded = expandedRows.has(entry.id);

              return (
                <React.Fragment key={entry.id}>
                  <tr className={cn("border-b transition-colors duration-150 hover:bg-muted/30", isExpanded && "bg-muted/20")}>
                    <td
                      className="px-3 py-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => toggleRow(entry.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </td>
                    <td className="px-3 py-2 font-medium border-r">
                      <div>
                        <span className="text-sm">{employee?.name}</span>
                        <span className="block text-xs text-muted-foreground">{employee?.role || "-"}</span>
                      </div>
                    </td>
                    {EDITABLE_COLS.map((colKey, colIndex) => (
                      <EditableCell
                        key={colKey}
                        value={getCellValue(entry, colKey)}
                        onChange={(v) => handleCellChange(entry.id, colKey, v)}
                        rowIndex={rowIndex}
                        colIndex={colIndex}
                        onNavigate={handleNavigate}
                        isActive={activeCell?.row === rowIndex && activeCell?.col === colIndex}
                        setActive={() => setActiveCell({ row: rowIndex, col: colIndex })}
                      />
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums font-semibold border-l bg-muted/30">
                      <span className="text-sm">{fmt(net)}</span>
                    </td>
                  </tr>
                  {isExpanded && <EmployeeRowExpansion entry={entry} colSpan={colSpan} />}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollTable;
