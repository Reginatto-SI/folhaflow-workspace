import React, { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PayrollEntry, Employee, Rubric } from "@/types/payroll";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { FileText, Save } from "lucide-react";
import { computeSpreadsheetEntry, getEntryManualValues } from "@/lib/payrollSpreadsheet";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseCurrency = (v: string): number => {
  const cleaned = v
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  return Number.isFinite(Number(cleaned)) ? Math.max(0, Number(cleaned)) : 0;
};

type RubricValueInput = {
  rubricId: string;
  value: number;
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
  rubrics?: Rubric[];
  companyName?: string;
  competenceLabel?: string;
  onSave: (id: string, updates: Partial<PayrollEntry>) => Promise<void>;
}

const NumericRubricInput: React.FC<{
  rubric: Rubric;
  value: number;
  disabled?: boolean;
  labelClassName?: string;
  inputClassName?: string;
  onChange: (next: RubricValueInput) => void;
}> = ({ rubric, value, disabled, labelClassName, inputClassName, onChange }) => {
  const [text, setText] = useState(value.toFixed(2));

  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  return (
    <div className="space-y-1">
      <Label
        className={`text-[11px] leading-tight text-muted-foreground ${labelClassName || ""}`}
        title={`${rubric.code} — ${rubric.name}`}
      >
        {rubric.code} · {rubric.name}
      </Label>
      <Input
        className={`h-8 text-right tabular-nums text-sm font-medium ${inputClassName || ""}`}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const parsed = parseCurrency(text);
          onChange({ rubricId: rubric.id, value: parsed });
          setText(parsed.toFixed(2));
        }}
      />
    </div>
  );
};

// Regra operacional da Central simplificada: rubrica calculada (nature=calculada)
// é tratada como campo derivado readonly na tela estilo planilha.
const isBaseRubric = (rubric: Rubric) => rubric.nature === "base";
const isDerivedRubric = (rubric: Rubric) => rubric.nature === "calculada";
const normalizeRubricCode = (value?: string) => (value || "").trim().toLowerCase();

const EmployeeDrawer: React.FC<EmployeeDrawerProps> = ({
  open,
  onOpenChange,
  mode = "edit",
  entry,
  employee,
  employees = [],
  selectedEmployeeId = "",
  onSelectedEmployeeIdChange,
  rubrics = [],
  companyName,
  competenceLabel,
  onSave,
}) => {
  const isCreateMode = mode === "create";
  const [rubricValues, setRubricValues] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");

  const activeRubricsOrdered = useMemo(
    () => [...rubrics].filter((rubric) => rubric.isActive).sort((a, b) => a.order - b.order),
    [rubrics]
  );

  const groupedRubrics = useMemo(() => {
    const editable = activeRubricsOrdered.filter((rubric) => !isDerivedRubric(rubric));

    return {
      base: editable.filter(isBaseRubric),
      proventos: editable.filter((rubric) => !isBaseRubric(rubric) && rubric.type === "provento"),
      descontos: editable.filter((rubric) => !isBaseRubric(rubric) && rubric.type === "desconto"),
      derivadas: activeRubricsOrdered.filter(isDerivedRubric),
    };
  }, [activeRubricsOrdered]);

  const derivedResultRubricIds = useMemo(() => {
    const findDerivedByCode = (canonicalCode: string) =>
      activeRubricsOrdered.find(
        (rubric) => rubric.nature === "calculada" && normalizeRubricCode(rubric.code) === canonicalCode
      )?.id;

    return {
      salarioReal: findDerivedByCode("salario_real"),
      g2Complemento: findDerivedByCode("g2_complemento"),
      salarioLiquido: findDerivedByCode("salario_liquido"),
    };
  }, [activeRubricsOrdered]);

  useEffect(() => {
    if (!open) return;

    const emptyValues = activeRubricsOrdered.reduce<Record<string, number>>((acc, rubric) => {
      acc[rubric.id] = 0;
      return acc;
    }, {});

    if (isCreateMode || !entry) {
      setRubricValues(emptyValues);
      setNotes("");
      return;
    }

    // Leitura padronizada da entrada manual para evitar dupla transformação local vs salvo.
    setRubricValues({
      ...emptyValues,
      ...getEntryManualValues(entry, activeRubricsOrdered),
    });
    setNotes(entry.notes || "");
  }, [activeRubricsOrdered, entry, isCreateMode, open]);

  // Cálculo único da tela: usado para prévia, derivados readonly e totais persistidos.
  const spreadsheetPreview = useMemo(
    () => computeSpreadsheetEntry({ rubrics: activeRubricsOrdered, manualValues: rubricValues }),
    [activeRubricsOrdered, rubricValues]
  );

  const derivedResultValues = useMemo(() => {
    const { valuesByRubricId } = spreadsheetPreview;
    const readDerivedValue = (rubricId?: string) => (rubricId ? valuesByRubricId[rubricId] || 0 : 0);

    return {
      salarioReal: readDerivedValue(derivedResultRubricIds.salarioReal),
      g2Complemento: readDerivedValue(derivedResultRubricIds.g2Complemento),
      salarioLiquido: readDerivedValue(derivedResultRubricIds.salarioLiquido),
    };
  }, [derivedResultRubricIds, spreadsheetPreview]);

  const updateRubricValue = ({ rubricId, value }: RubricValueInput) => {
    setRubricValues((prev) => ({ ...prev, [rubricId]: value }));
  };

  const canEditValues = isCreateMode ? !!selectedEmployeeId : true;

  const handleSave = async () => {
    if (!entry) {
      toast.error("Lançamento não encontrado para salvar.");
      return;
    }

    const earningsPayload: Record<string, number> = {};
    const deductionsPayload: Record<string, number> = {};

    activeRubricsOrdered.forEach((rubric) => {
      if (isDerivedRubric(rubric)) return;
      const value = rubricValues[rubric.id] || 0;
      if (rubric.type === "desconto") {
        deductionsPayload[rubric.id] = value;
        return;
      }
      earningsPayload[rubric.id] = value;
    });

    try {
      await onSave(entry.id, {
        baseSalary: spreadsheetPreview.baseSalary,
        earnings: earningsPayload,
        deductions: deductionsPayload,
        notes,
      });
      toast.success("Valores salvos com sucesso.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar os valores do lançamento.");
    }
  };

  if (!isCreateMode && (!entry || !employee)) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden px-0">
        <SheetHeader className="px-4 pb-2.5 border-b">
          <div className="min-w-0">
            <SheetTitle className="text-lg">{isCreateMode ? "Novo lançamento" : employee?.name}</SheetTitle>
            <SheetDescription className="text-xs">
              <span className="block">CPF: {employee?.cpf || "—"}</span>
              <span className="block">Empresa: {companyName || "—"}</span>
              <span className="block">Competência: {competenceLabel || "—"}</span>
            </SheetDescription>
          </div>

          <div className="mt-1.5 flex w-full flex-wrap justify-end gap-2">
            <Button onClick={handleSave} size="sm" className="h-8 rounded-md px-4" disabled={!canEditValues}>
              <Save className="mr-1 h-4 w-4" />
              {isCreateMode ? "Criar" : "Salvar"}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button variant="outline" size="sm" disabled className="h-8 rounded-md px-4">
                      <FileText className="mr-1 h-4 w-4" />
                      Gerar recibo
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Disponível em sprint futura (PRD-07).</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </SheetHeader>

        <div className="h-[calc(100vh-162px)] overflow-y-auto px-4 py-3 space-y-3">
          {isCreateMode && (
            <div className="space-y-1 border rounded-md p-2.5 bg-card">
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

          {/* Densidade e alinhamento: menos respiro vertical para leitura operacional mais rápida. */}
          <section className="border rounded-md bg-card p-2.5 space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rubricas-base</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {groupedRubrics.base.length > 0 ? (
                groupedRubrics.base.map((rubric) => (
                  <NumericRubricInput key={rubric.id} rubric={rubric} value={rubricValues[rubric.id] || 0} disabled={!canEditValues} onChange={updateRubricValue} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground col-span-full">Nenhuma rubrica-base identificada para a empresa/competência atual.</p>
              )}
            </div>
          </section>

          {/* Proventos e descontos recebem bloco levemente destacado, aproximando a leitura ao layout legado. */}
          <section className="border rounded-md border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proventos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {groupedRubrics.proventos.length > 0 ? (
                groupedRubrics.proventos.map((rubric) => (
                  <NumericRubricInput key={rubric.id} rubric={rubric} value={rubricValues[rubric.id] || 0} disabled={!canEditValues} onChange={updateRubricValue} />
                ))
              ) : (
                <p className="text-xs text-muted-foreground col-span-full">Nenhuma rubrica de provento ativa.</p>
              )}
            </div>
          </section>

          <section className="border rounded-md border-red-100 bg-red-50/30 p-2.5 space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive">Descontos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {groupedRubrics.descontos.length > 0 ? (
                groupedRubrics.descontos.map((rubric) => (
                  <NumericRubricInput
                    key={rubric.id}
                    rubric={rubric}
                    value={rubricValues[rubric.id] || 0}
                    disabled={!canEditValues}
                    labelClassName="text-destructive"
                    onChange={updateRubricValue}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground col-span-full">Nenhuma rubrica de desconto ativa.</p>
              )}
            </div>
          </section>

          {/* Campos derivados ficam readonly e recalculam no frontend imediatamente. */}
          {groupedRubrics.derivadas.length > 0 && (
            <section className="border rounded-md bg-slate-100 p-2.5 space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campos derivados (readonly)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                {groupedRubrics.derivadas.map((rubric) => (
                  <NumericRubricInput
                    key={rubric.id}
                    rubric={rubric}
                    value={spreadsheetPreview.valuesByRubricId[rubric.id] || 0}
                    disabled
                    inputClassName="bg-slate-200/80 border-slate-300 text-slate-900"
                    onChange={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Linha crítica de resultado: este bloco é somente exibição.
              Os valores devem vir das rubricas derivadas reais (por code canônico),
              sem fórmula paralela hardcoded na UI. */}
          <section className="border rounded-md bg-slate-100/80 p-2.5 space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resultados</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <div className="rounded-md border bg-white px-2 py-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Salário Real</p>
                <p className="text-sm font-semibold tabular-nums">{fmt(derivedResultValues.salarioReal)}</p>
              </div>
              <div className="rounded-md border bg-white px-2 py-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">G2 Complemento</p>
                <p className="text-sm font-semibold tabular-nums">{fmt(derivedResultValues.g2Complemento)}</p>
              </div>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Salário Líquido</p>
                <p className="text-sm font-bold tabular-nums text-emerald-900">{fmt(derivedResultValues.salarioLiquido)}</p>
              </div>
            </div>
          </section>

          <section className="border rounded-md bg-card p-2.5 space-y-1.5">
            <Label htmlFor="payroll-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observação</Label>
            <Textarea
              id="payroll-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Adicionar observação da folha para este funcionário/competência"
              className="text-sm min-h-20 leading-snug"
              disabled={!canEditValues}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EmployeeDrawer;
