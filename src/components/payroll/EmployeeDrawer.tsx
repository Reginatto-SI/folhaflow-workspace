import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PayrollEntry, Employee, Rubric } from "@/types/payroll";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { FileText, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  calculatePayroll,
  diagnoseCanonicalDerivedRubrics,
  getEntryManualValues,
  hasCanonicalRubricInconsistency,
} from "@/lib/payrollSpreadsheet";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Estratégia BRL: texto livre durante digitação (sem travar cursor/teclas) e
// normalização apenas no blur para manter experiência operacional estilo planilha.
const formatCurrencyDisplay = (value: number) => fmt(Number.isFinite(value) ? value : 0);
const formatEditCurrency = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0,00";

const parseCurrency = (value: string): number => {
  const normalized = value.trim();
  if (!normalized) return 0;

  const keepsNumericTokens = normalized.replace(/[^\d,.-]/g, "");
  const withoutThousands = keepsNumericTokens.replace(/\./g, "");
  const decimalNormalized = withoutThousands.replace(/,/g, ".");
  const parsed = Number(decimalNormalized);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

type RubricValueInput = {
  rubricId: string;
  value: number;
};

type RubricQuantityInput = {
  rubricId: string;
  quantity: number;
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
  onDelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
  onPreviewChange?: (entry: PayrollEntry | null) => void;
  // Comentário: drawer apenas dispara a geração; recibo é renderizado fora (PRD-07).
  onGenerateReceipt?: (entry: PayrollEntry) => void;
}

const NumericRubricInput: React.FC<{
  rubric: Rubric;
  value: number;
  quantity?: number;
  disabled?: boolean;
  labelClassName?: string;
  inputClassName?: string;
  onChange: (next: RubricValueInput) => void;
  onQuantityChange?: (next: RubricQuantityInput) => void;
}> = ({ rubric, value, quantity = 0, disabled, labelClassName, inputClassName, onChange, onQuantityChange }) => {
  const [text, setText] = useState(formatCurrencyDisplay(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused) return;
    setText(formatCurrencyDisplay(value));
  }, [isFocused, value]);

  const selectEditableValue = (input: HTMLInputElement) => {
    if (disabled) return;

    // Seleciona todo o conteúdo somente ao focar (TAB ou primeiro clique),
    // permitindo substituir o valor sem impedir cliques posteriores para reposicionar o cursor.
    const select = () => input.select();
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(select);
      return;
    }
    window.setTimeout(select, 0);
  };

  // PRD-07: quantidade complementar é descritiva (ex.: dias). NÃO entra em cálculo.
  const showQuantity = !!rubric.usesComplementaryQuantity;
  const quantityLabel = (rubric.complementaryQuantityLabel || "Qtde").trim() || "Qtde";

  return (
    <div className="space-y-1">
      <Label
        className={`text-[11px] leading-tight text-muted-foreground ${labelClassName || ""}`}
        title={`${rubric.code} — ${rubric.name}`}
      >
        {rubric.code} · {rubric.name}
      </Label>
      <div className="flex items-stretch gap-1">
        <Input
          className={`h-8 text-right tabular-nums text-sm font-medium flex-1 min-w-0 ${inputClassName || ""}`}
          value={text}
          disabled={disabled}
          onChange={(event) => {
            const nextText = event.target.value;
            setText(nextText);
            onChange({ rubricId: rubric.id, value: parseCurrency(nextText) });
          }}
          onFocus={(event) => {
            setIsFocused(true);
            setText(formatEditCurrency(value));
            selectEditableValue(event.currentTarget);
          }}
          onBlur={() => {
            const parsed = parseCurrency(text);
            onChange({ rubricId: rubric.id, value: parsed });
            setIsFocused(false);
            setText(formatCurrencyDisplay(parsed));
          }}
        />
        {showQuantity && onQuantityChange && (
          <Input
            className="h-8 w-16 text-right tabular-nums text-sm"
            type="number"
            min={0}
            step={1}
            disabled={disabled}
            placeholder={quantityLabel}
            title={quantityLabel}
            value={quantity > 0 ? String(quantity) : ""}
            onChange={(event) => {
              const raw = event.target.value;
              const parsed = raw === "" ? 0 : Math.max(0, Math.floor(Number(raw) || 0));
              onQuantityChange({ rubricId: rubric.id, quantity: parsed });
            }}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
      </div>
    </div>
  );
};

// Regra operacional da Central simplificada: rubrica calculada (nature=calculada)
// é tratada como campo derivado readonly na tela estilo planilha.
const isDerivedRubric = (rubric: Rubric) => rubric.nature === "calculada";

const normalizeRubricText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const isBaseSalaryRubric = (rubric: Rubric) => {
  const code = normalizeRubricText(rubric.code);
  const name = normalizeRubricText(rubric.name);

  // Separação apenas visual: mantém a mesma rubrica manual e só tira os salários
  // base do card de Proventos para facilitar digitação no drawer.
  return (
    rubric.classification === "salario_ctps" ||
    rubric.classification === "salario_g" ||
    code.includes("salario_fiscal") ||
    code.includes("sal_fiscal") ||
    name.includes("salario fiscal")
  );
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
  onDelete,
  canDelete = true,
  onPreviewChange,
  onGenerateReceipt,
}) => {
  const isCreateMode = mode === "create";
  const [rubricValues, setRubricValues] = useState<Record<string, number>>({});
  // PRD-07: quantidade complementar (ex.: dias) por rubrica. Apenas descritiva.
  const [rubricQuantities, setRubricQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeRubricsOrdered = useMemo(
    () => [...rubrics].filter((rubric) => rubric.isActive).sort((a, b) => a.order - b.order),
    [rubrics]
  );

  const groupedRubrics = useMemo(() => {
    const editable = activeRubricsOrdered.filter((rubric) => !isDerivedRubric(rubric));

    return {
      // Agrupamento guiado por metadado técnico da rubrica (type/nature), nunca por label.
      // A exceção abaixo é somente de apresentação: salários base ficam em card próprio,
      // sem alterar cálculo, payload salvo ou regra das rubricas.
      salariosBase: editable.filter((rubric) => rubric.type === "provento" && isBaseSalaryRubric(rubric)),
      proventos: editable.filter((rubric) => rubric.type === "provento" && !isBaseSalaryRubric(rubric)),
      descontos: editable.filter((rubric) => rubric.type === "desconto"),
      resultados: activeRubricsOrdered.filter(isDerivedRubric),
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
    () => calculatePayroll({ rubrics: activeRubricsOrdered, manualValues: rubricValues }),
    [activeRubricsOrdered, rubricValues]
  );

  const canonicalDerivedRubricIds = spreadsheetPreview.canonicalDerivedRubricIds;
  const canonicalDiagnosis = useMemo(
    () => diagnoseCanonicalDerivedRubrics(activeRubricsOrdered),
    [activeRubricsOrdered]
  );
  const hasCanonicalInconsistency = useMemo(
    () => hasCanonicalRubricInconsistency(canonicalDiagnosis),
    [canonicalDiagnosis]
  );
  const canonicalDiagnosticMessage = useMemo(() => {
    if (!hasCanonicalInconsistency) return null;
    const statuses = Object.values(canonicalDiagnosis).map((item) => item.status);
    const hasAmbiguity = statuses.includes("ambiguous_code") || statuses.includes("ambiguous_name");
    const hasMissing = statuses.includes("missing");
    const hasLegacyFallback = statuses.includes("resolved_by_legacy_name");

    // Comentário: mensagem vem do diagnóstico estruturado das rubricas canônicas.
    // Objetivo: orientar operação com texto curto, sem expor detalhes técnicos.
    // A correção definitiva continua no cadastro das rubricas (origem dos dados).
    if (hasAmbiguity) {
      return "Configuração canônica incompleta: verifique salario_real, g2_complemento e salario_liquido.";
    }
    if (hasMissing) {
      return "Alguns resultados do sistema precisam ser revisados na configuração de rubricas. Consulte o responsável pelo sistema.";
    }
    if (hasLegacyFallback) {
      return "Resultados do sistema usando configuração legada de rubricas. Consulte o responsável pelo sistema.";
    }
    return "Alguns resultados do sistema precisam ser revisados na configuração de rubricas. Consulte o responsável pelo sistema.";
  }, [canonicalDiagnosis, hasCanonicalInconsistency]);

  const orderedDerivedRubrics = useMemo(() => {
    // Comentário: drawer, tabela e totais precisam consumir a MESMA resolução canônica.
    // A ordem visual do card Resultados é fixa: Salário Real, G2 Complemento e Salário Líquido.
    // Isso altera apenas a apresentação; os valores continuam vindo da prévia calculada.
    const canonicalOrder = [
      canonicalDerivedRubricIds.salarioRealId,
      canonicalDerivedRubricIds.g2ComplementoId,
      canonicalDerivedRubricIds.salarioLiquidoId,
    ].filter((rubricId): rubricId is string => !!rubricId);
    const canonicalSet = new Set(canonicalOrder);

    const canonicalRubrics = canonicalOrder
      .map((rubricId) => groupedRubrics.resultados.find((rubric) => rubric.id === rubricId))
      .filter((rubric): rubric is Rubric => !!rubric);
    const nonCanonicalRubrics = groupedRubrics.resultados
      .filter((rubric) => !canonicalSet.has(rubric.id))
      .sort((a, b) => a.order - b.order);

    return [...canonicalRubrics, ...nonCanonicalRubrics];
  }, [canonicalDerivedRubricIds.g2ComplementoId, canonicalDerivedRubricIds.salarioLiquidoId, canonicalDerivedRubricIds.salarioRealId, groupedRubrics.resultados]);

  const buildPayrollEntryDraft = useCallback((): Partial<PayrollEntry> => {
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

    return {
      baseSalary: spreadsheetPreview.baseSalary,
      earnings: earningsPayload,
      deductions: deductionsPayload,
      notes,
      // Comentário: salario_real, g2_complemento e salario_liquido são rubricas canônicas.
      // Drawer, tabela da Central e totalizadores devem consumir esta mesma prévia/mesma
      // função de cálculo frontend; não deve existir cálculo paralelo para esses campos.
      earningsTotal: spreadsheetPreview.earningsTotal,
      deductionsTotal: spreadsheetPreview.deductionsTotal,
      inssAmount: spreadsheetPreview.inssAmount,
      netSalary: canonicalDerivedRubricIds.salarioLiquidoId ? spreadsheetPreview.salarioLiquido : spreadsheetPreview.netSalary,
    };
  }, [activeRubricsOrdered, canonicalDerivedRubricIds.salarioLiquidoId, notes, rubricValues, spreadsheetPreview]);

  useEffect(() => {
    if (!onPreviewChange) return;
    if (!open || isCreateMode || !entry) {
      onPreviewChange(null);
      return;
    }

    onPreviewChange({
      ...entry,
      ...buildPayrollEntryDraft(),
    });
  }, [buildPayrollEntryDraft, entry, isCreateMode, onPreviewChange, open]);

  const updateRubricValue = ({ rubricId, value }: RubricValueInput) => {
    setRubricValues((prev) => ({ ...prev, [rubricId]: value }));
  };

  const canEditValues = isCreateMode ? !!selectedEmployeeId : true;

  const handleSave = async () => {
    if (!entry) {
      toast.error("Lançamento não encontrado para salvar.");
      return;
    }

    try {
      await onSave(entry.id, buildPayrollEntryDraft());
      toast.success("Valores salvos com sucesso.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível salvar os valores do lançamento.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!entry || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(entry.id);
      toast.success("Lançamento excluído com sucesso.");
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível excluir o lançamento.");
    } finally {
      setIsDeleting(false);
    }
  };

  const showDeleteButton = !isCreateMode && !!entry && !!onDelete;

  if (!isCreateMode && (!entry || !employee)) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl overflow-hidden px-0">
        <SheetHeader className="px-3 pb-2 border-b">
          <div className="min-w-0">
            <SheetTitle className="text-lg">{isCreateMode ? "Novo lançamento" : employee?.name}</SheetTitle>
            <SheetDescription className="text-xs">
              <span className="block">CPF: {employee?.cpf || "—"}</span>
              <span className="block">Empresa: {companyName || "—"}</span>
              <span className="block">Competência: {competenceLabel || "—"}</span>
            </SheetDescription>
          </div>

          <div className="mt-1.5 flex w-full flex-wrap justify-end gap-1.5">
            <Button onClick={handleSave} size="sm" className="h-8 rounded-md px-3" disabled={!canEditValues}>
              <Save className="mr-1 h-4 w-4" />
              {isCreateMode ? "Criar" : "Salvar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-md px-3"
              disabled={isCreateMode || !entry || !onGenerateReceipt}
              onClick={() => {
                if (entry && onGenerateReceipt) onGenerateReceipt(entry);
              }}
            >
              <FileText className="mr-1 h-4 w-4" />
              Gerar recibo
            </Button>
          </div>
        </SheetHeader>

        <div className="h-[calc(100vh-148px)] overflow-y-auto px-3 py-2 space-y-2">
          {/* Layout compactado: max-width/paddings/gaps menores preservam 4 colunas
              em desktop sem ocupar largura excessiva da tela. */}
          {isCreateMode && (
            <div className="space-y-1 border rounded-md p-2 bg-card">
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

          {groupedRubrics.salariosBase.length > 0 && (
            <section className="border rounded-md border-slate-200 bg-slate-50/70 p-2 space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salários Base</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                {groupedRubrics.salariosBase.map((rubric) => (
                  <NumericRubricInput key={rubric.id} rubric={rubric} value={rubricValues[rubric.id] || 0} disabled={!canEditValues} onChange={updateRubricValue} />
                ))}
              </div>
            </section>
          )}

          {groupedRubrics.proventos.length > 0 && (
            <section className="border rounded-md border-slate-200 bg-slate-50/70 p-2 space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proventos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                {groupedRubrics.proventos.map((rubric) => (
                  <NumericRubricInput key={rubric.id} rubric={rubric} value={rubricValues[rubric.id] || 0} disabled={!canEditValues} onChange={updateRubricValue} />
                ))}
              </div>
            </section>
          )}

          {groupedRubrics.descontos.length > 0 && (
            <section className="border rounded-md border-red-100 bg-red-50/30 p-2 space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-destructive">Descontos</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
                {groupedRubrics.descontos.map((rubric) => (
                  <NumericRubricInput
                    key={rubric.id}
                    rubric={rubric}
                    value={rubricValues[rubric.id] || 0}
                    disabled={!canEditValues}
                    labelClassName="text-destructive"
                    onChange={updateRubricValue}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Evita bloco vazio: resultados só aparecem quando há rubricas derivadas ativas carregadas. */}
          {(orderedDerivedRubrics.length > 0 || !!canonicalDiagnosticMessage) && (
            <section className="border rounded-md bg-slate-100/80 p-2 space-y-1.5">
              <div className="space-y-0.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resultados</h4>
                {canonicalDiagnosticMessage && (
                  <p className="text-[11px] text-amber-700">
                    {canonicalDiagnosticMessage}
                  </p>
                )}
              </div>
              {orderedDerivedRubrics.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {orderedDerivedRubrics.map((rubric) => {
                    const isNetSalary = canonicalDerivedRubricIds.salarioLiquidoId === rubric.id;

                    return (
                      <div
                        key={rubric.id}
                        className={`rounded-md border px-2 py-1.5 ${isNetSalary ? "border-emerald-200 bg-emerald-50" : "bg-white"}`}
                      >
                        <p className={`text-[11px] font-semibold uppercase tracking-wide ${isNetSalary ? "text-emerald-800" : "text-muted-foreground"}`}>
                          {rubric.name}
                        </p>
                        <p className={`text-sm tabular-nums ${isNetSalary ? "font-bold text-emerald-900" : "font-semibold"}`}>
                          {fmt(spreadsheetPreview.valuesByRubricId[rubric.id] || 0)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <section className="border rounded-md bg-card p-2 space-y-1.5">
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

          {showDeleteButton && (
            <section className="pt-1">
              <div className="flex items-center justify-between border-t pt-3">
                <p className="text-[11px] text-muted-foreground">
                  Remove apenas os valores deste funcionário nesta competência.
                </p>
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Excluir lançamento
                  </Button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button variant="ghost" size="sm" disabled className="h-8 text-destructive">
                            <Trash2 className="mr-1 h-4 w-4" />
                            Excluir lançamento
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Folha finalizada não permite exclusão de lançamentos.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </section>
          )}
        </div>
      </SheetContent>
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento da folha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá os valores lançados para este funcionário nesta competência. O cadastro do funcionário não será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Excluir lançamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
};

export default EmployeeDrawer;
