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
  entries = [],
  allEmployees = [],
  allDepartments = [],
  allJobRoles = [],
  rubrics = [],
  onRowClick,
}) => {
  const employeeById = React.useMemo(() => new Map(allEmployees.map((item) => [item.id, item])), [allEmployees]);
  const departmentById = React.useMemo(() => new Map(allDepartments.map((item) => [item.id, item.name])), [allDepartments]);
  const roleById = React.useMemo(() => new Map(allJobRoles.map((item) => [item.id, item.name])), [allJobRoles]);

  if (entries.length === 0) {
    return (
      <div className="border rounded-md bg-card p-6 text-center text-muted-foreground text-sm">
        Nenhum funcionário encontrado para os filtros selecionados.
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Comentário: cabeçalho com contraste suave e hierarquia leve para leitura diária. */}
            <tr className="bg-muted/35 border-b border-border/80">
              <th className="text-left px-4 py-3.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">Funcionário</th>
              <th className="text-left px-4 py-3.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">Setor</th>
              <th className="text-left px-4 py-3.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">Função</th>
              <th className="text-right px-4 py-3.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">Salário Real</th>
              <th className="text-right px-4 py-3.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">G2 Complemento</th>
              <th className="text-right px-4 py-3.5 font-semibold text-[11px] uppercase tracking-[0.08em] text-emerald-700/90 bg-emerald-50/70">Salário Líquido</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const employee = employeeById.get(entry.employeeId);
              const departmentName = employee?.departmentId ? (departmentById.get(employee.departmentId) || employee.department || "—") : (employee?.department || "—");
              const roleName = employee?.jobRoleId ? (roleById.get(employee.jobRoleId) || employee.role || "—") : (employee?.role || "—");
              const localComputed = calculatePayrollFromEntry({ entry, rubrics });

              return (
                <tr
                  key={entry.id}
                  // Comentário: hover mais perceptível para comunicar claramente que a linha é clicável.
                  className={cn("border-b border-border/70 transition-all duration-150 hover:bg-muted/45 hover:shadow-[inset_3px_0_0_0_hsl(var(--primary)/0.28)] cursor-pointer")}
                  onClick={() => onRowClick(entry)}
                >
                  {/* Comentário: nome ganha protagonismo; CPF fica discreto para reduzir ruído visual. */}
                  <td className="px-4 py-4 font-medium align-middle">
                    <span className="text-[0.95rem] font-semibold text-foreground">{employee?.name || "—"}</span>
                    <span className="block text-[11px] leading-4 text-muted-foreground/80 mt-1">{employee?.cpf || ""}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground/80 align-middle">{departmentName}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground/80 align-middle">{roleName}</td>
                  <td className="px-4 py-4 text-right tabular-nums font-semibold text-foreground/95 align-middle">{fmt(localComputed.salarioReal)}</td>
                  <td className="px-4 py-4 text-right tabular-nums font-semibold text-foreground/95 align-middle">{fmt(localComputed.g2Complemento)}</td>
                  {/* Comentário: coluna-chave com tipografia maior + fundo/contraste dedicados. */}
                  <td className="px-4 py-4 text-right tabular-nums text-base font-bold bg-emerald-50/60 text-emerald-800 align-middle">{fmt(localComputed.salarioLiquido)}</td>
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
