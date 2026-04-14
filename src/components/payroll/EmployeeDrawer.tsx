import React, { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PayrollEntry, Employee, Rubric } from "@/types/payroll";
import { toast } from "sonner";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseCurrency = (v: string): number => {
  const cleaned = v.replace(/[^\d,.-]/g, "").replace(",", ".");
  return Math.max(0, Number(cleaned) || 0);
};

interface EmployeeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "edit" | "create";
  entry: PayrollEntry | null;
  employee: Employee | null;
  employees?: Employee[];
  selectedEmployeeId?: string;
  onSelectedEmployeeIdChange?: (id: string) => void;
  defaultRubrics?: Rubric[];
  departmentName?: string;
  jobRoleName?: string;
  onSave: (id: string, updates: Partial<PayrollEntry>) => Promise<void>;
}

const CurrencyInput: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => {
  const [text, setText] = useState(value.toFixed(2));

  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-8 text-right tabular-nums text-sm"
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const parsed = parseCurrency(text);
          onChange(parsed);
          setText(parsed.toFixed(2));
        }}
      />
    </div>
  );
};

const EmployeeDrawer: React.FC<EmployeeDrawerProps> = ({
  open, onOpenChange, mode = "edit", entry, employee, employees = [], selectedEmployeeId = "", onSelectedEmployeeIdChange, defaultRubrics = [], departmentName, jobRoleName, onSave, onCreate,
}) => {
  const isCreateMode = mode === "create";
  const [baseSalary, setBaseSalary] = useState(0);
  const [earnings, setEarnings] = useState<Record<string, number>>({});
  const [deductions, setDeductions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isCreateMode) {
      // Comentário: no modo criação, inicializa valores a partir do funcionário selecionado e das rubricas ativas.
      setBaseSalary(employee?.baseSalary || 0);
      const nextEarnings = defaultRubrics
        .filter((rubric) => rubric.isActive && rubric.type === "provento")
        .reduce<Record<string, number>>((acc, rubric) => {
          acc[rubric.name] = 0;
          return acc;
        }, {});
      const nextDeductions = defaultRubrics
        .filter((rubric) => rubric.isActive && rubric.type === "desconto")
        .reduce<Record<string, number>>((acc, rubric) => {
          acc[rubric.name] = 0;
          return acc;
        }, {});
      setEarnings(nextEarnings);
      setDeductions(nextDeductions);
      return;
    }
    if (entry) {
      setBaseSalary(entry.baseSalary);
      setEarnings({ ...entry.earnings });
      setDeductions({ ...entry.deductions });
    }
  }, [defaultRubrics, employee?.baseSalary, entry, isCreateMode]);

  const totals = useMemo(() => {
    const totalEarnings = Object.values(earnings).reduce((a, b) => a + b, 0);
    const totalDeductions = Object.values(deductions).reduce((a, b) => a + b, 0);
    const gross = baseSalary + totalEarnings;
    return { gross, totalDeductions, net: gross - totalDeductions };
  }, [baseSalary, earnings, deductions]);

  const handleSave = async () => {
    if (!entry) return;
    try {
      await onSave(entry.id, { baseSalary, earnings, deductions });
      toast.success("Valores salvos com sucesso.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar os valores do lançamento.");
    }
  };

  const updateEarning = (key: string, val: number) => {
    setEarnings((prev) => ({ ...prev, [key]: val }));
  };

  const updateDeduction = (key: string, val: number) => {
    setDeductions((prev) => ({ ...prev, [key]: val }));
  };

  if (!isCreateMode && (!entry || !employee)) return null;
  const canEditValues = isCreateMode ? !!selectedEmployeeId : true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg">{isCreateMode ? "Novo lançamento" : employee?.name}</SheetTitle>
          <SheetDescription className="text-xs">
            {isCreateMode
              ? "Selecione o funcionário e informe os valores do lançamento."
              : `CPF: ${employee?.cpf || "—"} · ${departmentName || "—"} · ${jobRoleName || "—"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-1">
          {isCreateMode && (
            <div className="space-y-1">
              <Label className="text-xs">Funcionário</Label>
              <Select value={selectedEmployeeId} onValueChange={(value) => onSelectedEmployeeIdChange?.(value)}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={employees.length ? "Selecione o funcionário" : "Sem funcionários disponíveis"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Proventos */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Proventos</h4>
            <div className="space-y-2">
              <CurrencyInput label="Salário Base" value={baseSalary} onChange={setBaseSalary} disabled={!canEditValues} />
              {Object.entries(earnings).map(([key, val]) => (
                <CurrencyInput key={key} label={key} value={val} onChange={(v) => updateEarning(key, v)} disabled={!canEditValues} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Descontos */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Descontos</h4>
            <div className="space-y-2">
              {Object.entries(deductions).map(([key, val]) => (
                <CurrencyInput key={key} label={key} value={val} onChange={(v) => updateDeduction(key, v)} disabled={!canEditValues} />
              ))}
            </div>
          </div>

          <Separator />

          {/* Totais */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Bruto</span>
              <span className="font-semibold tabular-nums">{fmt(totals.gross)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Descontos</span>
              <span className="font-semibold tabular-nums text-destructive">{fmt(totals.totalDeductions)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span>Líquido</span>
              <span className="tabular-nums text-success">{fmt(totals.net)}</span>
            </div>
          </div>
        </div>

        <SheetFooter className="pt-4 flex gap-2">
          <Button onClick={handleSave} className="flex-1" disabled={!canEditValues}>{isCreateMode ? "Criar" : "Salvar"}</Button>
          <Button variant="outline" disabled className="flex-1">Gerar recibo</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default EmployeeDrawer;
