import React from "react";
import { PayrollEntry, Employee, Department, JobRole, Rubric } from "@/types/payroll";
import { cn } from "@/lib/utils";
import { calculatePayrollFromEntry } from "@/lib/payrollSpreadsheet";
import { Check, Circle, CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PayrollSortKey = "employee" | "cpf" | "department" | "role" | "salarioReal" | "g2Complemento" | "salarioLiquido";
type PayrollSortDirection = "asc" | "desc";

const sortLabels: Record<PayrollSortKey, string> = {
  employee: "Funcionário",
  cpf: "CPF",
  department: "Setor",
  role: "Função",
  salarioReal: "Salário Real",
  g2Complemento: "G2 Complemento",
  salarioLiquido: "Salário Líquido",
};

interface PayrollTableProps {
  entries: PayrollEntry[];
  allEmployees: Employee[];
  allDepartments: Department[];
  allJobRoles: JobRole[];
  rubrics: Rubric[];
  onRowClick: (entry: PayrollEntry) => void;
  onToggleConferido: (entry: PayrollEntry) => void;
  updatingConferidoIds?: Record<string, boolean>;
  sortKey: PayrollSortKey;
  sortDirection: PayrollSortDirection;
  onSortChange: (key: PayrollSortKey) => void;
}

const PayrollTable: React.FC<PayrollTableProps> = ({
  entries = [],
  allEmployees = [],
  allDepartments = [],
  allJobRoles = [],
  rubrics = [],
  onRowClick,
  onToggleConferido,
  updatingConferidoIds = {},
  sortKey,
  sortDirection,
  onSortChange,
}) => {
  const employeeById = React.useMemo(() => new Map(allEmployees.map((item) => [item.id, item])), [allEmployees]);
  const departmentById = React.useMemo(() => new Map(allDepartments.map((item) => [item.id, item.name])), [allDepartments]);
  const roleById = React.useMemo(() => new Map(allJobRoles.map((item) => [item.id, item.name])), [allJobRoles]);

  const renderSortableHeader = (key: PayrollSortKey, align: "left" | "right" = "left", extraClassName?: string) => {
    const active = sortKey === key;

    return (
      <button
        type="button"
        className={cn(
          "inline-flex w-full items-center gap-1 rounded-sm transition-colors hover:text-foreground",
          align === "right" ? "justify-end text-right" : "justify-start text-left",
          active && "text-foreground"
        )}
        onClick={() => onSortChange(key)}
        aria-label={`Ordenar por ${sortLabels[key]}`}
        aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{sortLabels[key]}</span>
        <span className={cn("text-[10px] leading-none text-muted-foreground/70", extraClassName)} aria-hidden="true">
          {active ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  };

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
              <th className="text-center px-2 py-2.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90 w-[62px]">
                <span className="inline-flex items-center justify-center gap-1">
                  <span>Conf.</span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground/70 hover:text-foreground transition-colors"
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Ajuda sobre conferência"
                        >
                          <CircleHelp className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-left">
                        Marque quando os valores do funcionário já foram conferidos nesta competência. Isso não altera cálculos, recibos ou relatórios.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">{renderSortableHeader("employee")}</th>
              <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">{renderSortableHeader("cpf")}</th>
              <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">{renderSortableHeader("department")}</th>
              <th className="text-left px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">{renderSortableHeader("role")}</th>
              <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">{renderSortableHeader("salarioReal", "right")}</th>
              <th className="text-right px-4 py-2.5 font-medium text-[11px] uppercase tracking-[0.08em] text-muted-foreground/90">{renderSortableHeader("g2Complemento", "right")}</th>
              <th className="text-right px-4 py-2.5 font-semibold text-[11px] uppercase tracking-[0.08em] text-emerald-700/90 bg-emerald-50/70">{renderSortableHeader("salarioLiquido", "right", "text-emerald-700/80")}</th>
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
                  <td className="px-2 py-2.5 align-middle text-center">
                    {/* Comentário: toggle rápido de conferência na linha, sem abrir modal e sem recalcular folha. */}
                    <button
                      type="button"
                      className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors", entry.conferido ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:bg-muted")}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleConferido(entry);
                      }}
                      aria-label={entry.conferido ? "Desmarcar conferência" : "Marcar conferência"}
                      disabled={!!updatingConferidoIds[entry.id]}
                    >
                      {entry.conferido ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  {/* Comentário: redução intencional de densidade para empresas com muitos funcionários, com colunas estáveis para evitar tabela visualmente pesada. */}
                  <td className="px-4 py-2.5 font-medium align-middle whitespace-nowrap min-w-[220px]">
                    <span className="text-[0.95rem] font-semibold text-foreground">{employee?.name || "—"}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground/80 align-middle whitespace-nowrap min-w-[130px]">{employee?.cpf || "—"}</td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground/80 align-middle max-w-[220px]">
                    <span className="block truncate" title={departmentName}>{departmentName}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground/80 align-middle max-w-[220px]">
                    <span className="block truncate" title={roleName}>{roleName}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap text-foreground/95 align-middle">{fmt(localComputed.salarioReal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap text-foreground/95 align-middle">{fmt(localComputed.g2Complemento)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold whitespace-nowrap bg-emerald-50/60 text-emerald-800 align-middle">{fmt(localComputed.salarioLiquido)}</td>
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
