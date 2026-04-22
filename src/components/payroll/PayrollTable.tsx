import React from "react";
import { PayrollEntry, Employee, Department, JobRole, Rubric } from "@/types/payroll";
import { cn } from "@/lib/utils";
import { calculatePayrollFromEntry } from "@/lib/payrollSpreadsheet";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PayrollTableProps {
  entries: PayrollEntry[];
  allEmployees: Employee[];
  allDepartments: Department[];
  allJobRoles: JobRole[];
  rubrics: Rubric[];
  onRowClick: (entry: PayrollEntry) => void;
}

const PayrollTable: React.FC<PayrollTableProps> = ({
  entries = [], allEmployees = [], allDepartments = [], allJobRoles = [], rubrics = [], onRowClick,
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
              <th className="text-right px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">Salário Real</th>
              <th className="text-right px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">G2 Complemento</th>
              <th className="text-right px-3 py-1.5 font-semibold text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/80">Salário Líquido</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const emp = getEmployee(entry.employeeId);
              // Comentário: tabela usa a função única da Central para evitar cálculo paralelo.
              const localComputed = calculatePayrollFromEntry({ entry, rubrics });

              return (
                <tr
                  key={entry.id}
                  className={cn("border-b transition-colors duration-150 hover:bg-muted/30 cursor-pointer")}
                  onClick={() => onRowClick(entry)}
                >
                  <td className="px-3 py-1.5 font-medium">
                    <span className="text-sm">{emp?.name || "—"}</span>
                    <span className="block text-xs text-muted-foreground">{emp?.cpf || ""}</span>
                  </td>
                  <td className="px-3 py-1.5 text-sm text-muted-foreground">{getDeptName(emp)}</td>
                  <td className="px-3 py-1.5 text-sm text-muted-foreground">{getRoleName(emp)}</td>
                  {/* Comentário: leitura das colunas pelos mesmos derivados do drawer (valuesByRubricId). */}
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PayrollTable;
