import React from "react";
import { PayrollEntry } from "@/types/payroll";
import { Textarea } from "@/components/ui/textarea";
import { usePayroll } from "@/contexts/PayrollContext";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  entry: PayrollEntry;
  colSpan: number;
}

const EmployeeRowExpansion: React.FC<Props> = ({ entry, colSpan }) => {
  const { updatePayrollEntry, allEmployees } = usePayroll();
  const employee = allEmployees.find((e) => e.id === entry.employeeId);

  const totalEarnings = Object.values(entry.earnings).reduce((a, b) => a + b, 0);
  const totalDeductions = Object.values(entry.deductions).reduce((a, b) => a + b, 0);
  const gross = entry.baseSalary + totalEarnings;
  const net = gross - totalDeductions;

  return (
    <tr className="bg-muted/30">
      <td colSpan={colSpan} className="p-4">
        <div className="grid grid-cols-3 gap-6">
          {/* Employee info */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Dados do Funcionário</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Cargo:</span> {employee?.role}</p>
              <p><span className="text-muted-foreground">Admissão:</span> {employee?.admissionDate ? new Date(employee.admissionDate).toLocaleDateString("pt-BR") : "-"}</p>
              <p><span className="text-muted-foreground">Status:</span> <span className="text-success font-medium">{employee?.isActive ? "Ativo" : "Inativo"}</span></p>
            </div>
          </div>

          {/* Breakdown */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Detalhamento</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salário Base</span>
                <span className="tabular-nums">{fmt(entry.baseSalary)}</span>
              </div>
              {Object.entries(entry.earnings).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">+ {k}</span>
                  <span className="tabular-nums text-success">{fmt(v)}</span>
                </div>
              ))}
              {Object.entries(entry.deductions).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">- {k}</span>
                  <span className="tabular-nums text-destructive">{fmt(v)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Líquido</span>
                <span className="tabular-nums">{fmt(net)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Observações</h4>
            <Textarea
              value={entry.notes}
              onChange={(e) => updatePayrollEntry(entry.id, { notes: e.target.value })}
              placeholder="Adicionar observação..."
              className="text-sm h-24 resize-none"
            />
          </div>
        </div>
      </td>
    </tr>
  );
};

export default EmployeeRowExpansion;
