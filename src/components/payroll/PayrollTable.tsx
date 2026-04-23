import React from "react";
import { PayrollEntry, Employee, Department, JobRole, Rubric } from "@/types/payroll";
import { cn } from "@/lib/utils";
import { calculatePayrollFromEntry } from "@/lib/payrollSpreadsheet";
import EditableCell from "@/components/payroll/EditableCell";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PayrollTableProps {
  entries: PayrollEntry[];
  allEmployees: Employee[];
  allDepartments: Department[];
  allJobRoles: JobRole[];
  rubrics: Rubric[];
  onRowClick: (entry: PayrollEntry) => void;
  onInlineEntryChange: (id: string, rubric: Rubric, value: number, commit?: boolean) => void;
  inlineSaveStateByEntryId?: Record<string, "saving" | "error">;
}

const PayrollRow: React.FC<{
  entry: PayrollEntry;
  employee: Employee | undefined;
  departmentName: string;
  roleName: string;
  editableRubrics: Rubric[];
  rubrics: Rubric[];
  rowIndex: number;
  activeCellCol: number | null;
  onSetActiveCell: (row: number, col: number) => void;
  onNavigate: (row: number, col: number) => void;
  onInlineEntryChange: (id: string, rubric: Rubric, value: number, commit?: boolean) => void;
  onRowClick: (entry: PayrollEntry) => void;
  saveState?: "saving" | "error";
}> = React.memo(({
  entry,
  employee,
  departmentName,
  roleName,
  editableRubrics,
  rubrics,
  rowIndex,
  activeCellCol,
  onSetActiveCell,
  onNavigate,
  onInlineEntryChange,
  onRowClick,
  saveState,
}) => {
  const localComputed = React.useMemo(() => calculatePayrollFromEntry({ entry, rubrics }), [entry, rubrics]);

  return (
    <tr
      className={cn(
        "border-b transition-colors duration-150 hover:bg-muted/30 cursor-pointer",
        saveState === "saving" && "opacity-75",
        saveState === "error" && "bg-destructive/5"
      )}
      onClick={() => onRowClick(entry)}
    >
      <td className="px-3 py-1.5 font-medium sticky left-0 bg-card">
        <span className="text-sm">{employee?.name || "—"}</span>
        <span className="block text-xs text-muted-foreground">{employee?.cpf || ""}</span>
      </td>
      <td className="px-3 py-1.5 text-sm text-muted-foreground">{departmentName}</td>
      <td className="px-3 py-1.5 text-sm text-muted-foreground">{roleName}</td>

      {editableRubrics.map((rubric, colIndex) => {
        const value = rubric.type === "desconto"
          ? entry.deductions?.[rubric.id] || 0
          : entry.earnings?.[rubric.id] || 0;
        return (
          <EditableCell
            key={`${entry.id}:${rubric.id}`}
            value={value}
            rowIndex={rowIndex}
            colIndex={colIndex}
            isActive={activeCellCol === colIndex}
            setActive={() => onSetActiveCell(rowIndex, colIndex)}
            onNavigate={onNavigate}
            onChange={(nextValue) => onInlineEntryChange(entry.id, rubric, nextValue, false)}
            onCommit={(nextValue) => onInlineEntryChange(entry.id, rubric, nextValue, true)}
          />
        );
      })}

      <td className="px-3 py-1.5 text-right tabular-nums font-medium">
        {fmt(localComputed.salarioReal)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums font-medium">
        {fmt(localComputed.g2Complemento)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums font-semibold bg-muted/30">
        {fmt(localComputed.salarioLiquido)}
      </td>
    </tr>
  );
});

PayrollRow.displayName = "PayrollRow";

const PayrollTable: React.FC<PayrollTableProps> = ({
  entries = [], allEmployees = [], allDepartments = [], allJobRoles = [], rubrics = [], onRowClick, onInlineEntryChange, inlineSaveStateByEntryId = {},
}) => {
  const employeeById = React.useMemo(() => new Map(allEmployees.map((item) => [item.id, item])), [allEmployees]);
  const departmentById = React.useMemo(() => new Map(allDepartments.map((item) => [item.id, item.name])), [allDepartments]);
  const roleById = React.useMemo(() => new Map(allJobRoles.map((item) => [item.id, item.name])), [allJobRoles]);

  const editableRubrics = React.useMemo(
    () => [...rubrics].filter((rubric) => rubric.isActive && rubric.nature !== "calculada").sort((a, b) => a.order - b.order),
    [rubrics]
  );

  const [activeCell, setActiveCell] = React.useState<{ row: number; col: number } | null>(null);

  const handleNavigate = React.useCallback(
    (nextRow: number, nextCol: number) => {
      if (entries.length === 0 || editableRubrics.length === 0) return;

      let row = nextRow;
      let col = nextCol;

      if (col < 0) {
        col = editableRubrics.length - 1;
        row -= 1;
      }
      if (col >= editableRubrics.length) {
        col = 0;
        row += 1;
      }

      row = Math.max(0, Math.min(entries.length - 1, row));
      col = Math.max(0, Math.min(editableRubrics.length - 1, col));
      setActiveCell({ row, col });
    },
    [editableRubrics.length, entries.length]
  );

  if (entries.length === 0) {
    return (
      <div className="border rounded-md bg-card p-6 text-center text-muted-foreground text-sm">
        Nenhum funcionário encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden bg-card">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Funcionário</th>
              <th className="text-left px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Setor</th>
              <th className="text-left px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Função</th>
              {editableRubrics.map((rubric) => (
                <th key={rubric.id} className="text-right px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground min-w-[140px]">
                  {rubric.name}
                </th>
              ))}
              <th className="text-right px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Salário Real</th>
              <th className="text-right px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">G2 Complemento</th>
              <th className="text-right px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/80">Salário Líquido</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, rowIndex) => {
              const employee = employeeById.get(entry.employeeId);
              const departmentName = employee?.departmentId ? (departmentById.get(employee.departmentId) || employee.department || "—") : (employee?.department || "—");
              const roleName = employee?.jobRoleId ? (roleById.get(employee.jobRoleId) || employee.role || "—") : (employee?.role || "—");

              return (
                <PayrollRow
                  key={entry.id}
                  entry={entry}
                  employee={employee}
                  departmentName={departmentName}
                  roleName={roleName}
                  editableRubrics={editableRubrics}
                  rubrics={rubrics}
                  rowIndex={rowIndex}
                  activeCellCol={activeCell?.row === rowIndex ? activeCell.col : null}
                  onSetActiveCell={(row, col) => setActiveCell({ row, col })}
                  onNavigate={handleNavigate}
                  onInlineEntryChange={onInlineEntryChange}
                  onRowClick={onRowClick}
                  saveState={inlineSaveStateByEntryId[entry.id]}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollTable;
