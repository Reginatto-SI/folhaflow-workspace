// Comentário: visualização em tela cheia dos recibos (1 ou N).
// - O Drawer e o botão "Gerar recibos" na Central abrem ESTE componente.
// - O mesmo componente <Receipt /> é reutilizado para individual e lote.
// - Impressão usa o diálogo nativo do navegador (window.print) com A4.
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { Company, Department, Employee, JobRole, PayrollEntry, Rubric } from "@/types/payroll";
import Receipt from "./Receipt";
import { noTranslateAttributes, withNoTranslateClass } from "@/lib/noTranslate";

export interface ReceiptPrintViewProps {
  open: boolean;
  onClose: () => void;
  entries: PayrollEntry[];
  allEmployees: Employee[];
  allDepartments: Department[];
  allJobRoles: JobRole[];
  company?: Company | null;
  rubrics: Rubric[];
  title?: string;
  paymentDate?: string | null;
}

const ReceiptPrintView: React.FC<ReceiptPrintViewProps> = ({
  open,
  onClose,
  entries,
  allEmployees,
  allDepartments,
  allJobRoles,
  company,
  rubrics,
  title,
  paymentDate,
}) => {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const employeeById = new Map(allEmployees.map((e) => [e.id, e]));
  const departmentById = new Map(allDepartments.map((d) => [d.id, d]));
  const jobRoleById = new Map(allJobRoles.map((j) => [j.id, j]));

  const items = entries
    .map((entry) => {
      const employee = employeeById.get(entry.employeeId);
      if (!employee) return null;
      const department = (employee.departmentId && departmentById.get(employee.departmentId)) || null;
      const jobRole = (employee.jobRoleId && jobRoleById.get(employee.jobRoleId)) || null;
      return { entry, employee, department, jobRole };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  return createPortal(
    // Comentário: raiz usada na impressão/PDF nativo protegida contra tradução automática.
    <div className={withNoTranslateClass("receipt-print-root fixed inset-0 z-[100] bg-slate-200 overflow-auto")} {...noTranslateAttributes}>
      {/* Barra de ações — escondida ao imprimir */}
      <div className="receipt-toolbar sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white px-4 py-2 shadow-sm print:hidden">
        <div className="text-sm font-medium text-slate-700">
          {title || (items.length > 1 ? `Recibos (${items.length})` : "Recibo de pagamento")}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            <X className="mr-1 h-4 w-4" /> Fechar
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={items.length === 0}>
            <Printer className="mr-1 h-4 w-4" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <div className={withNoTranslateClass("receipt-print-canvas py-6 px-4 flex flex-col items-center gap-6")} {...noTranslateAttributes}>
        {items.length === 0 ? (
          <div className="rounded border bg-white px-6 py-8 text-sm text-muted-foreground">
            Nenhum lançamento disponível para gerar recibo.
          </div>
        ) : (
          items.map((item, idx) => (
            <Receipt
              key={item.entry.id}
              entry={item.entry}
              employee={item.employee}
              company={company}
              department={item.department}
              jobRole={item.jobRole}
              rubrics={rubrics}
              isLast={idx === items.length - 1}
              paymentDate={paymentDate}
            />
          ))
        )}
      </div>
    </div>,
    document.body,
  );
};

export default ReceiptPrintView;
