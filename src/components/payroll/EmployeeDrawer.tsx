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

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseCurrency = (v: string): number => {
  const cleaned = v.replace(/[^\d,.-]/g, "").replace(".", "").replace(",", ".");
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
  onChange: (next: RubricValueInput) => void;
}> = ({ rubric, value, disabled, onChange }) => {
  const [text, setText] = useState(value.toFixed(2));

  useEffect(() => {
    setText(value.toFixed(2));
  }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-[11px] leading-tight text-muted-foreground" title={`${rubric.code} — ${rubric.name}`}>
        {rubric.code} · {rubric.name}
      </Label>
      <Input
        className="h-8 text-right tabular-nums text-sm"
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

// PRD-02 + PRD-01: a única verdade de comportamento é `rubric.nature`.
// • `nature = base` → input operacional (rubrica-base ou provento/desconto manual);
// • `nature = calculada` → DERIVADA (output do motor de cálculo). Não é editável manualmente,
//   não aparece como campo de entrada no drawer. O cálculo real será implementado quando o
//   motor (PRD-01) for ativado em sprint futura — até lá, derivadas existem apenas como cadastro.
// Heurística por nome/código foi removida. `getLegacyValue` permanece SOMENTE para leitura
// de payloads antigos persistidos por chave-nome (compat transitória).
const isBaseRubric = (rubric: Rubric) => rubric.nature === "base";
const isDerivedRubric = (rubric: Rubric) => rubric.nature === "calculada";

const getLegacyValue = (rubric: Rubric, payload: Record<string, number>) => {
  const directById = payload[rubric.id];
  if (typeof directById === "number") return directById;

  const byCode = payload[rubric.code];
  if (typeof byCode === "number") return byCode;

  const byName = payload[rubric.name];
  if (typeof byName === "number") return byName;

  const codeInsensitive = Object.entries(payload).find(([key]) => key.toLowerCase() === rubric.code.toLowerCase());
  if (codeInsensitive && typeof codeInsensitive[1] === "number") return codeInsensitive[1];

  const nameInsensitive = Object.entries(payload).find(([key]) => key.toLowerCase() === rubric.name.toLowerCase());
  if (nameInsensitive && typeof nameInsensitive[1] === "number") return nameInsensitive[1];

  return 0;
};

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
    const base = activeRubricsOrdered.filter(isBaseRubric);
    // PRD-02/PRD-01: derivadas (nature=calculada) NÃO entram como input no drawer —
    // são saídas do motor de cálculo. Filtradas defensivamente das seções operacionais.
    const operational = activeRubricsOrdered.filter((rubric) => !isBaseRubric(rubric) && !isDerivedRubric(rubric));

    return {
      base,
      proventos: operational.filter((rubric) => rubric.type === "provento"),
      descontos: operational.filter((rubric) => rubric.type === "desconto"),
    };
  }, [activeRubricsOrdered]);

  useEffect(() => {
    if (!open) return;

    const emptyValues = activeRubricsOrdered.reduce<Record<string, number>>((acc, rubric) => {
      acc[rubric.id] = 0;
      return acc;
    }, {});

    if (isCreateMode) {
      setRubricValues(emptyValues);
      setNotes("");
      return;
    }

    if (!entry) {
      setRubricValues(emptyValues);
      setNotes("");
      return;
    }

    // Compatibilidade transitória: leitura aceita chaves legadas por nome/código
    // e prioriza chave estável por rubric.id quando disponível.
    const nextValues = activeRubricsOrdered.reduce<Record<string, number>>((acc, rubric) => {
      const source = rubric.type === "desconto" ? entry.deductions : entry.earnings;
      acc[rubric.id] = getLegacyValue(rubric, source);
      return acc;
    }, emptyValues);

    // Compatibilidade adicional: se houver rubrica-base sem valor legado, usa base_salary atual apenas no primeiro item.
    const firstBaseRubric = groupedRubrics.base[0];
    if (firstBaseRubric && !nextValues[firstBaseRubric.id] && entry.baseSalary > 0) {
      nextValues[firstBaseRubric.id] = entry.baseSalary;
    }

    setRubricValues(nextValues);
    setNotes(entry.notes || "");
  }, [activeRubricsOrdered, entry, groupedRubrics.base, isCreateMode, open]);

  const totals = useMemo(() => {
    const baseTotal = groupedRubrics.base.reduce((sum, rubric) => sum + (rubricValues[rubric.id] || 0), 0);
    const earningsTotal = groupedRubrics.proventos.reduce((sum, rubric) => sum + (rubricValues[rubric.id] || 0), 0);
    const deductionTotal = groupedRubrics.descontos.reduce((sum, rubric) => sum + (rubricValues[rubric.id] || 0), 0);
    const gross = baseTotal + earningsTotal;
    return {
      baseTotal,
      earningsTotal,
      deductionTotal,
      gross,
      net: gross - deductionTotal,
    };
  }, [groupedRubrics.base, groupedRubrics.descontos, groupedRubrics.proventos, rubricValues]);

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

    // Persistência transicional: grava por rubric.id (chave estável), mantendo compatibilidade de leitura legado.
    activeRubricsOrdered.forEach((rubric) => {
      const value = rubricValues[rubric.id] || 0;
      if (rubric.type === "desconto") {
        deductionsPayload[rubric.id] = value;
        return;
      }
      if (!isBaseRubric(rubric)) {
        earningsPayload[rubric.id] = value;
      }
    });

    try {
      await onSave(entry.id, {
        baseSalary: totals.baseTotal,
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
        {/* Header reorganizado: metadados ficam no topo e ações logo abaixo para não competir com o botão de fechar. */}
        <SheetHeader className="px-5 pb-3 border-b">
          <div className="min-w-0">
            <SheetTitle className="text-lg">{isCreateMode ? "Novo lançamento" : employee?.name}</SheetTitle>
            <SheetDescription className="text-xs space-y-0.5">
              <div>CPF: {employee?.cpf || "—"}</div>
              <div>Empresa: {companyName || "—"}</div>
              <div>Competência: {competenceLabel || "—"}</div>
            </SheetDescription>
          </div>

          {/* Responsividade: botões quebram para nova linha quando necessário, sem corte e sem encostar no "X" do drawer. */}
          <div className="mt-2 flex w-full flex-wrap justify-end gap-2">
            <Button
              onClick={handleSave}
              size="sm"
              className="h-8 rounded-md px-4"
              disabled={!canEditValues}
            >
              <Save className="mr-1 h-4 w-4" />
              {isCreateMode ? "Criar" : "Salvar"}
            </Button>
            {/* Tooltip explica que recibo é PRD-07, fora do escopo desta sprint. */}
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

        <div className="h-[calc(100vh-170px)] overflow-y-auto px-5 py-4 space-y-4">
          {isCreateMode && (
            <div className="space-y-1 border rounded-lg p-3 bg-card">
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

          <section className="border rounded-lg bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rubricas-base</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupedRubrics.base.length > 0 ? (
                groupedRubrics.base.map((rubric) => (
                  <NumericRubricInput
                    key={rubric.id}
                    rubric={rubric}
                    value={rubricValues[rubric.id] || 0}
                    disabled={!canEditValues}
                    onChange={updateRubricValue}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground col-span-full">Nenhuma rubrica-base identificada para a empresa/competência atual.</p>
              )}
            </div>
          </section>

          <section className="border rounded-lg bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proventos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupedRubrics.proventos.length > 0 ? (
                groupedRubrics.proventos.map((rubric) => (
                  <NumericRubricInput
                    key={rubric.id}
                    rubric={rubric}
                    value={rubricValues[rubric.id] || 0}
                    disabled={!canEditValues}
                    onChange={updateRubricValue}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground col-span-full">Nenhuma rubrica de provento ativa.</p>
              )}
            </div>
          </section>

          <section className="border rounded-lg bg-card p-3 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descontos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupedRubrics.descontos.length > 0 ? (
                groupedRubrics.descontos.map((rubric) => (
                  <NumericRubricInput
                    key={rubric.id}
                    rubric={rubric}
                    value={rubricValues[rubric.id] || 0}
                    disabled={!canEditValues}
                    onChange={updateRubricValue}
                  />
                ))
              ) : (
                <p className="text-xs text-muted-foreground col-span-full">Nenhuma rubrica de desconto ativa.</p>
              )}
            </div>
          </section>

          {/* PRD-01 / PRD-03 §2.1: a prévia local é apenas uma estimativa de digitação.
              Não inclui INSS nem outras rubricas calculadas pelo motor — por isso fica explícito. */}
          <section className="border rounded-lg bg-card p-3 space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia (em edição)</h4>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Proventos</span>
              <span className="font-semibold tabular-nums">{fmt(totals.gross)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Descontos</span>
              <span className="font-semibold tabular-nums text-destructive">{fmt(totals.deductionTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Líquido (prévia, sem encargos)</span>
              <span className="tabular-nums text-success">{fmt(totals.net)}</span>
            </div>
          </section>

          {/* PRD-01: backend é fonte única de verdade. Mostra o último valor persistido após save/recálculo. */}
          {!isCreateMode && entry && (entry.earningsTotal !== undefined || entry.netSalary !== undefined) && (
            <section className="border rounded-lg bg-muted/40 p-3 space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Valores calculados (backend)</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Proventos</span>
                <span className="tabular-nums">{fmt(entry.earningsTotal ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Descontos</span>
                <span className="tabular-nums text-destructive">{fmt(entry.deductionsTotal ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">INSS</span>
                <span className="tabular-nums text-destructive">{fmt(entry.inssAmount ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold">
                <span>Líquido</span>
                <span className="tabular-nums text-success">{fmt(entry.netSalary ?? 0)}</span>
              </div>
            </section>
          )}

          <section className="border rounded-lg bg-card p-3 space-y-2">
            <Label htmlFor="payroll-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observação</Label>
            <Textarea
              id="payroll-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Adicionar observação da folha para este funcionário/competência"
              className="text-sm min-h-24"
              disabled={!canEditValues}
            />
          </section>
        </div>

      </SheetContent>
    </Sheet>
  );
};

export default EmployeeDrawer;
