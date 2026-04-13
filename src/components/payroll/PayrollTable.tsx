import React from "react";
import { PayrollEntry, Employee, Department, JobRole } from "@/types/payroll";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PayrollTableProps {
  entries: PayrollEntry[];
  allEmployees: Employee[];
  allDepartments: Department[];
  allJobRoles: JobRole[];
  onRowClick: (entry: PayrollEntry) => void;
}

const PayrollTable: React.FC<PayrollTableProps> = ({
  entries = [], allEmployees = [], allDepartments = [], allJobRoles = [], onRowClick,
}) => {
  const getEmployee = (id: string) => allEmployees.find((e) => e.id === id);
  const getDeptName = (emp?: Employee) => {
    if (!emp?.departmentId) return emp?.department || "—";
    return allDepartments.find((d) => d.id === emp.departmentId)?.name || emp.department || "—";
  };
  const getRoleName = (emp?: Employee) => {
    if (!emp?.jobRoleId) return emp?.role || "—";
    return allJobRoles.find((j) => j.id === emp.jobRoleId)?.name || emp.role || "—";
  };

  if (entries.length === 0) {
    return (
      <div className="border rounded-lg bg-card p-8 text-center text-muted-foreground text-sm">
        Nenhum funcionário encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Funcionário</th>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Setor</th>
              <th className="text-left px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Função</th>
              <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Salário Base</th>
              <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Proventos</th>
              <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Descontos</th>
              <th className="text-right px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground bg-muted/80">Líquido</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const emp = getEmployee(entry.employeeId);
              const totalEarnings = Object.values(entry.earnings).reduce((a, b) => a + b, 0);
              const totalDeductions = Object.values(entry.deductions).reduce((a, b) => a + b, 0);
              const gross = entry.baseSalary + totalEarnings;
              const net = gross - totalDeductions;

              return (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b transition-colors duration-150 hover:bg-muted/30 cursor-pointer"
                  )}
                  onClick={() => onRowClick(entry)}
                >
                  <td className="px-3 py-2 font-medium">
                    <span className="text-sm">{emp?.name || "—"}</span>
                    <span className="block text-xs text-muted-foreground">{emp?.cpf || ""}</span>
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">{getDeptName(emp)}</td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">{getRoleName(emp)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(entry.baseSalary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(totalEarnings)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">{fmt(totalDeductions)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold bg-muted/30">{fmt(net)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollTable;
