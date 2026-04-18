// ──────────────────────────────────────────────────────────────────────────────
// /rubricas — Cadastro de Rubricas (PRD-02)
//
// Regras críticas (não violar):
//  • Rubricas BASE (operacionais): inputs da folha. Classificação técnica
//    OBRIGATÓRIA ao salvar quando ATIVA (catálogo canônico do PRD-02).
//  • Rubricas CALCULADAS (derivadas): SAÍDAS do motor de cálculo (PRD-01).
//    NÃO recebem classificação. NÃO admitem edição manual. NÃO aparecem como
//    input na Central de Folha. O cálculo real será implementado quando o motor
//    for ativado em sprint futura — hoje existem apenas como cadastro.
//  • Nome/código/categoria NUNCA definem comportamento — use `nature`/`classification`.
//  • Backend reforça permissão via RLS `has_permission('rubricas.manage')` e
//    CHECK constraints (`rubricas_active_base_requires_classification`,
//    `rubricas_calculada_no_classification`). Não confiar só em ocultação de UI.
//  • Campos `category` e `entry_mode` continuam gravados só para compat de coluna
//    legada — serão removidos em sprint futura. Não consumir em lógica nova.
// ──────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Rubric, RubricClassification, RubricFormulaItem, RubricMethod, RubricNature } from "@/types/payroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calculator,
  Check,
  Download,
  Eye,
  FileText,
  Info,
  ListChecks,
  Lock,
  MoreHorizontal,
  NotebookText,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";

// ── Catálogo canônico do PRD-02 (não derivar comportamento por nome). ─────────
const CLASSIFICATION_LABELS: Record<RubricClassification, string> = {
  salario_ctps: "Salário CTPS",
  salario_g: "Salário G",
  outros_rendimentos: "Outros rendimentos",
  horas_extras: "Horas extras",
  salario_familia: "Salário-família",
  ferias_terco: "Férias 1/3",
  insalubridade: "Insalubridade",
  inss: "INSS",
  emprestimos: "Empréstimos",
  adiantamentos: "Adiantamentos",
  vales: "Vales",
  faltas: "Faltas",
};

const PROVENTO_CLASSIFICATIONS: RubricClassification[] = [
  "salario_ctps",
  "salario_g",
  "outros_rendimentos",
  "horas_extras",
  "salario_familia",
  "ferias_terco",
  "insalubridade",
];
const DESCONTO_CLASSIFICATIONS: RubricClassification[] = [
  "inss",
  "emprestimos",
  "adiantamentos",
  "vales",
  "faltas",
];

type RubricTab = "dados" | "calculo" | "classificacao";
type RubricFormState = Omit<Rubric, "id">;

type RubricFilterState = {
  search: string;
  status: string;
  type: string;
  method: string;
  classification: string;
};

const getInitialForm = (): RubricFormState => ({
  name: "",
  code: "",
  type: "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: null,
  order: 1,
  isActive: true,
  fixedValue: null,
  percentageValue: null,
  percentageBaseRubricId: null,
  formulaItems: [],
  allowManualOverride: false,
});

const getInitialFilters = (): RubricFilterState => ({
  search: "",
  status: "",
  type: "",
  method: "",
  classification: "",
});

const getStatusBadgeProps = (isActive: boolean) =>
  isActive
    ? { variant: "default" as const, className: "bg-success text-success-foreground", label: "Ativa" }
    : { variant: "outline" as const, className: "bg-muted text-muted-foreground", label: "Inativa" };

const METHOD_LABELS: Record<RubricMethod, string> = {
  manual: "Manual",
  valor_fixo: "Valor fixo",
  percentual: "Percentual",
  formula: "Fórmula",
};

const getMethodBadgeProps = (method: RubricMethod) => {
  const label = METHOD_LABELS[method];
  if (method === "formula") return { variant: "secondary" as const, className: "", label };
  if (method === "valor_fixo") return { variant: "outline" as const, className: "border-primary/30 bg-primary/10 text-primary", label };
  if (method === "percentual") return { variant: "outline" as const, className: "border-primary/30 bg-primary/10 text-primary", label };
  return { variant: "outline" as const, className: "bg-muted/60 text-muted-foreground", label };
};

const getTypeBadgeProps = (type: Rubric["type"]) =>
  type === "provento"
    ? { variant: "outline" as const, className: "border-success/30 bg-success/10 text-success", label: "Provento" }
    : { variant: "outline" as const, className: "border-destructive/30 bg-destructive/10 text-destructive", label: "Desconto" };

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");
const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const Rubrics: React.FC = () => {
  const { rubrics, addRubric, updateRubric, deleteRubric, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rubric | null>(null);
  const [form, setForm] = useState<RubricFormState>(getInitialForm());
  const [filters, setFilters] = useState<RubricFilterState>(getInitialFilters());
  const [activeTab, setActiveTab] = useState<RubricTab>("dados");

  // Comentário: seletor de rubrica de origem (fórmula/percentual) — exclui a própria rubrica em edição.
  const rubricItems = useMemo(
    () => rubrics.map((rubric) => ({ value: rubric.id, label: `${rubric.code} — ${rubric.name}` })),
    [rubrics]
  );

  // PRD-02: rubricas seguras para serem referenciadas em fórmula/percentual.
  // Exclui: a própria em edição (auto-referência), inativas (ambiguidade operacional)
  // e derivadas/calculadas (saídas do motor — não devem alimentar inputs até motor existir).
  const referenceableRubricItems = useMemo(
    () =>
      rubrics
        .filter((r) => r.id !== editing?.id && r.isActive && r.nature !== "calculada")
        .map((rubric) => ({ value: rubric.id, label: `${rubric.code} — ${rubric.name}` })),
    [rubrics, editing?.id]
  );

  const classificationItems = useMemo(() => {
    const allowed = form.type === "provento" ? PROVENTO_CLASSIFICATIONS : DESCONTO_CLASSIFICATIONS;
    return allowed.map((value) => ({ value, label: CLASSIFICATION_LABELS[value] }));
  }, [form.type]);

  const filterClassificationItems = useMemo(
    () => Object.entries(CLASSIFICATION_LABELS).map(([value, label]) => ({ value, label })),
    []
  );

  const kpis = useMemo(() => {
    const total = rubrics.length;
    const active = rubrics.filter((rubric) => rubric.isActive).length;
    // PRD-02: pendência real = rubrica BASE ativa sem classificação. Calculadas (derivadas)
    // não têm classificação por design — não devem entrar na contagem de pendentes.
    const semClassificacao = rubrics.filter(
      (rubric) => rubric.isActive && rubric.nature === "base" && !rubric.classification
    ).length;
    return { total, active, inactive: total - active, semClassificacao };
  }, [rubrics]);

  const filteredRubrics = useMemo(() => {
    return rubrics.filter((rubric) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!rubric.name.toLowerCase().includes(q) && !rubric.code.toLowerCase().includes(q)) return false;
      }
      if (filters.status === "active" && !rubric.isActive) return false;
      if (filters.status === "inactive" && rubric.isActive) return false;
      if (filters.type && rubric.type !== filters.type) return false;
      if (filters.method && rubric.calculationMethod !== filters.method) return false;
      if (filters.classification && rubric.classification !== filters.classification) return false;
      return true;
    });
  }, [filters, rubrics]);

  const openNew = () => {
    setEditing(null);
    setForm(getInitialForm());
    setActiveTab("dados");
    setOpen(true);
  };

  const openEdit = (rubric: Rubric) => {
    setEditing(rubric);
    setForm({
      ...rubric,
      formulaItems: [...rubric.formulaItems].sort((a, b) => a.order - b.order),
    });
    setActiveTab("dados");
    setOpen(true);
  };

  // PRD-02: detecta ciclo tanto em método `formula` (multi-dependência) quanto
  // `percentual` (dependência única em `percentageBaseRubricId`).
  const getCircularError = (draft: RubricFormState, rubricId?: string): string | null => {
    if (draft.calculationMethod !== "formula" && draft.calculationMethod !== "percentual") return null;
    const currentId = rubricId || "__draft__";
    const adjacency = new Map<string, string[]>();
    rubrics.forEach((rubric) => {
      if (rubric.calculationMethod === "formula") {
        adjacency.set(rubric.id, rubric.formulaItems.map((item) => item.sourceRubricId));
      } else if (rubric.calculationMethod === "percentual" && rubric.percentageBaseRubricId) {
        adjacency.set(rubric.id, [rubric.percentageBaseRubricId]);
      } else {
        adjacency.set(rubric.id, []);
      }
    });
    const draftDeps =
      draft.calculationMethod === "formula"
        ? draft.formulaItems.map((item) => item.sourceRubricId)
        : draft.percentageBaseRubricId
          ? [draft.percentageBaseRubricId]
          : [];
    adjacency.set(currentId, draftDeps);

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const walk = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      const deps = adjacency.get(node) || [];
      for (const dep of deps) {
        if (dep === currentId) return true;
        if (walk(dep)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };
    return walk(currentId)
      ? draft.calculationMethod === "percentual"
        ? "Referência circular detectada no percentual."
        : "Referência circular detectada na fórmula."
      : null;
  };

  const validateForm = (draft: RubricFormState): string | null => {
    if (!normalizeText(draft.name)) return "Nome da rubrica é obrigatório.";
    if (!normalizeText(draft.code)) return "Código da rubrica é obrigatório.";
    if (!Number.isFinite(draft.order) || draft.order < 0) return "Ordem deve ser numérica válida.";

    // PRD-02: classificação só é obrigatória para rubricas BASE ativas.
    // Calculadas (derivadas) NÃO recebem classificação — bloqueio se vier preenchida.
    if (draft.nature === "calculada") {
      if (draft.classification) return "Rubricas calculadas (derivadas) não recebem classificação técnica.";
      if (draft.allowManualOverride) return "Rubricas calculadas (derivadas) não admitem edição manual.";
    } else if (draft.isActive && !draft.classification) {
      return "Classificação é obrigatória para rubricas base ativas (PRD-02).";
    }

    const duplicatedCode = rubrics.some(
      (rubric) => rubric.code.toLowerCase() === draft.code.toLowerCase() && rubric.id !== editing?.id
    );
    if (duplicatedCode) return "Já existe uma rubrica com este código.";

    if (draft.calculationMethod === "valor_fixo") {
      if (draft.fixedValue === null || draft.fixedValue === undefined || Number(draft.fixedValue) < 0)
        return "Valor fixo deve ser numérico e não-negativo.";
    }
    if (draft.calculationMethod === "percentual") {
      if (!draft.percentageValue || Number(draft.percentageValue) <= 0)
        return "Percentual deve ser maior que zero.";
      if (!draft.percentageBaseRubricId) return "Selecione a rubrica de referência para o percentual.";
      // Defesa explícita (além do filtro de UI): rubrica não pode referenciar a si mesma.
      if (editing && draft.percentageBaseRubricId === editing.id)
        return "Rubrica não pode referenciar ela mesma no percentual.";
      const circular = getCircularError(draft, editing?.id);
      if (circular) return circular;
    }
    if (draft.calculationMethod === "formula") {
      if (draft.formulaItems.length === 0) return "Rubrica de fórmula precisa de ao menos um item.";
      const hasEmptyItem = draft.formulaItems.some((item) => !item.sourceRubricId || !Number.isFinite(item.order));
      if (hasEmptyItem) return "Todos os itens da fórmula devem ser preenchidos.";
      if (draft.formulaItems.some((item) => item.sourceRubricId === editing?.id))
        return "Rubrica não pode depender dela mesma.";
      const circular = getCircularError(draft, editing?.id);
      if (circular) return circular;
    }
    return null;
  };

  const handleSave = async () => {
    const normalizedForm: RubricFormState = {
      ...form,
      name: normalizeText(form.name),
      code: normalizeText(form.code).toUpperCase(),
      order: Number(form.order),
      formulaItems: [...form.formulaItems].sort((a, b) => a.order - b.order),
    };

    const errorMessage = validateForm(normalizedForm);
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }

    try {
      if (editing) {
        await updateRubric(editing.id, normalizedForm);
        toast.success("Rubrica atualizada.");
      } else {
        await addRubric(normalizedForm);
        toast.success("Rubrica criada.");
      }
      // PRD-02: ordem duplicada não bloqueia (tiebreak por id na listagem),
      // mas avisa o admin para evitar ambiguidade silenciosa em motor futuro.
      const collides = rubrics.some(
        (r) => r.isActive && r.id !== editing?.id && r.order === normalizedForm.order
      );
      if (collides && normalizedForm.isActive) {
        toast.warning(
          `Outra rubrica ativa já usa a ordem ${normalizedForm.order}. Empate resolvido por id — revise se precisar de sequência única.`
        );
      }
      setOpen(false);
    } catch (error) {
      console.error("[Rubrics] Falha ao salvar rubrica", { error, payload: normalizedForm, editingId: editing?.id });
      toast.error(getErrorMessage(error, "Não foi possível salvar a rubrica."));
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const current = rubrics.find((rubric) => rubric.id === id);
      await deleteRubric(id);
      toast.success(current?.isActive ? "Rubrica inativada." : "Rubrica ativada.");
    } catch (error) {
      console.error("[Rubrics] Falha ao atualizar status da rubrica", { error, rubricId: id });
      toast.error(getErrorMessage(error, "Não foi possível atualizar o status da rubrica."));
    }
  };

  const addFormulaItem = () => {
    setForm((prev) => ({
      ...prev,
      formulaItems: [
        ...prev.formulaItems,
        { id: crypto.randomUUID(), operation: "add", sourceRubricId: "", order: prev.formulaItems.length + 1 },
      ],
    }));
  };
  const updateFormulaItem = (itemId: string, updates: Partial<RubricFormulaItem>) => {
    setForm((prev) => ({
      ...prev,
      formulaItems: prev.formulaItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    }));
  };
  const removeFormulaItem = (itemId: string) => {
    setForm((prev) => ({
      ...prev,
      formulaItems: prev.formulaItems
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index + 1 })),
    }));
  };
  const moveFormulaItem = (itemId: string, direction: "up" | "down") => {
    setForm((prev) => {
      const sorted = [...prev.formulaItems].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((item) => item.id === itemId);
      const swap = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swap < 0 || swap >= sorted.length) return prev;
      [sorted[index], sorted[swap]] = [sorted[swap], sorted[index]];
      return { ...prev, formulaItems: sorted.map((item, idx) => ({ ...item, order: idx + 1 })) };
    });
  };

  // Comentário: importar/exportar foram retirados de "simulação operacional".
  // Mantemos o botão por consistência de layout, mas com badge "em desenvolvimento" + toast informativo.
  const handleImportExportComingSoon = () =>
    toast.info("Importação/Exportação de rubricas em desenvolvimento. Será liberada em fase futura.");

  const hasActiveFilters = Boolean(
    filters.search || filters.status || filters.type || filters.method || filters.classification
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cadastro de Rubricas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rubricas globais compartilhadas entre todas as empresas — {filteredRubrics.length} de {rubrics.length} rubricas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImportExportComingSoon} className="relative">
            <Download className="mr-1 h-4 w-4" /> Exportar
            <Badge variant="outline" className="ml-2 border-muted-foreground/30 bg-muted/50 px-1.5 py-0 text-[10px] font-normal">
              em desenvolvimento
            </Badge>
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportExportComingSoon} className="relative">
            <Upload className="mr-1 h-4 w-4" /> Importar
            <Badge variant="outline" className="ml-2 border-muted-foreground/30 bg-muted/50 px-1.5 py-0 text-[10px] font-normal">
              em desenvolvimento
            </Badge>
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" /> Nova Rubrica
              </Button>
            </DialogTrigger>

            <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-4xl flex-col overflow-hidden">
              <DialogHeader className="border-b pb-3">
                <DialogTitle className="text-xl">
                  {editing
                    ? editing.nature === "calculada"
                      ? "Visualizar rubrica derivada"
                      : "Editar rubrica"
                    : "Nova rubrica"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Cadastro estruturado conforme PRD-02 — dados, método de cálculo e classificação técnica.
                </p>
              </DialogHeader>

              {/* PRD-02: aviso visual sempre que estamos lidando com rubrica derivada (criação ou edição). */}
              {form.nature === "calculada" && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">Rubrica derivada (saída do sistema)</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Esta rubrica é gerada pelo sistema (saída do motor de cálculo, PRD-01) e{" "}
                      <strong>não deve ser usada como entrada manual</strong>. Não recebe classificação técnica nem aparece
                      como input na Central de Folha.
                    </p>
                  </div>
                </div>
              )}

              <Tabs
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as RubricTab)}
                className="flex min-h-0 flex-1 flex-col overflow-hidden pt-3"
              >
                <TabsList className="mb-3 grid w-full grid-cols-3">
                  <TabsTrigger value="dados">
                    <FileText className="mr-1 h-4 w-4" />
                    Dados
                  </TabsTrigger>
                  <TabsTrigger value="calculo">
                    <Calculator className="mr-1 h-4 w-4" />
                    Cálculo
                  </TabsTrigger>
                  <TabsTrigger value="classificacao">
                    <ListChecks className="mr-1 h-4 w-4" />
                    Classificação
                  </TabsTrigger>
                </TabsList>

                {/* ─── Aba Dados ─── */}
                <TabsContent value="dados" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-2">
                  <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                    <h3 className="text-sm font-semibold">Dados principais</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Nome da rubrica *</Label>
                        <Input
                          value={form.name}
                          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Código *</Label>
                        <Input
                          value={form.code}
                          onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tipo *</Label>
                        <Select
                          value={form.type}
                          onValueChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              type: value as Rubric["type"],
                              // Comentário: ao trocar o tipo, limpamos a classificação para evitar valor inválido.
                              classification: null,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="provento">Provento</SelectItem>
                            <SelectItem value="desconto">Desconto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Natureza *</Label>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Select
                                  value={form.nature}
                                  disabled={editing !== null}
                                  onValueChange={(value) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      nature: value as RubricNature,
                                      // PRD-02: ao virar calculada (derivada), classification e override
                                      // devem ser limpos — derivadas não têm classificação nem edição manual.
                                      classification: value === "calculada" ? null : prev.classification,
                                      allowManualOverride: value === "calculada" ? false : prev.allowManualOverride,
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="base">Base (entrada na folha)</SelectItem>
                                    <SelectItem value="calculada">Calculada (derivada)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </TooltipTrigger>
                            {editing && (
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs">
                                  A natureza não pode ser alterada após a criação — mudaria o contrato técnico da rubrica
                                  (input vs. saída). Crie uma nova rubrica se precisar mudar.
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ordem de cálculo *</Label>
                        <Input
                          type="number"
                          min={0}
                          value={form.order}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, order: Number(event.target.value || 0) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select
                          value={form.isActive ? "active" : "inactive"}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, isActive: value === "active" }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativa</SelectItem>
                            <SelectItem value="inactive">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </TabsContent>

                {/* ─── Aba Cálculo ─── */}
                <TabsContent value="calculo" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-2">
                  <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Método de cálculo *</Label>
                        <Select
                          value={form.calculationMethod}
                          onValueChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              calculationMethod: value as RubricMethod,
                              // Limpa campos condicionais incompatíveis ao trocar de método.
                              fixedValue: value === "valor_fixo" ? prev.fixedValue ?? 0 : null,
                              percentageValue: value === "percentual" ? prev.percentageValue ?? 0 : null,
                              percentageBaseRubricId:
                                value === "percentual" ? prev.percentageBaseRubricId ?? null : null,
                              formulaItems: value === "formula" ? prev.formulaItems : [],
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual (informado na folha)</SelectItem>
                            <SelectItem value="valor_fixo">Valor fixo</SelectItem>
                            <SelectItem value="percentual">Percentual sobre rubrica</SelectItem>
                            <SelectItem value="formula">Fórmula (composição)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Campos dinâmicos por método */}
                    {form.calculationMethod === "valor_fixo" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Valor base (R$) *</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={form.fixedValue ?? 0}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, fixedValue: Number(event.target.value || 0) }))
                            }
                          />
                        </div>
                      </div>
                    )}

                    {form.calculationMethod === "percentual" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label>Percentual (%) *</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={form.percentageValue ?? 0}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, percentageValue: Number(event.target.value || 0) }))
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Rubrica de referência *</Label>
                          <SearchableCombobox
                            value={form.percentageBaseRubricId ?? ""}
                            items={referenceableRubricItems}
                            placeholder="Selecione a rubrica base"
                            searchPlaceholder="Buscar rubrica"
                            emptyMessage="Nenhuma rubrica disponível (apenas base ativas — derivadas/inativas não podem ser usadas)."
                            onValueChange={(value) =>
                              setForm((prev) => ({ ...prev, percentageBaseRubricId: value || null }))
                            }
                          />
                        </div>
                      </div>
                    )}

                    {form.calculationMethod === "formula" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Composição da fórmula</h4>
                          <Button type="button" size="sm" variant="outline" onClick={addFormulaItem}>
                            <Plus className="mr-1 h-4 w-4" /> Adicionar item
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {[...form.formulaItems]
                            .sort((a, b) => a.order - b.order)
                            .map((item) => (
                              <div
                                key={item.id}
                                className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[110px,1fr,110px,auto]"
                              >
                                <div className="space-y-1">
                                  <Label className="text-xs">Operação</Label>
                                  <Select
                                    value={item.operation}
                                    onValueChange={(value) =>
                                      updateFormulaItem(item.id, {
                                        operation: value as RubricFormulaItem["operation"],
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="add">Somar (+)</SelectItem>
                                      <SelectItem value="subtract">Subtrair (-)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Rubrica de origem</Label>
                                  <SearchableCombobox
                                    value={item.sourceRubricId}
                                    items={referenceableRubricItems}
                                    placeholder="Selecione a rubrica"
                                    searchPlaceholder="Buscar rubrica"
                                    emptyMessage="Nenhuma rubrica disponível (apenas base ativas — derivadas/inativas não podem compor fórmula)."
                                    onValueChange={(value) => updateFormulaItem(item.id, { sourceRubricId: value })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Ordem</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={item.order}
                                    onChange={(event) =>
                                      updateFormulaItem(item.id, { order: Number(event.target.value || 1) })
                                    }
                                  />
                                </div>
                                <div className="flex items-end justify-end gap-1">
                                  <Button variant="ghost" size="icon" type="button" onClick={() => moveFormulaItem(item.id, "up")}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" type="button" onClick={() => moveFormulaItem(item.id, "down")}>
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    type="button"
                                    className="text-destructive"
                                    onClick={() => removeFormulaItem(item.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          {form.formulaItems.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              Nenhum item adicionado. Clique em "Adicionar item" para montar a fórmula.
                            </p>
                          )}
                        </div>

                        <div className="rounded-md border bg-background p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Pré-visualização da fórmula</p>
                          <p className="text-sm font-medium">
                            {form.formulaItems.length === 0
                              ? "—"
                              : [...form.formulaItems]
                                  .sort((a, b) => a.order - b.order)
                                  .map((item, index) => {
                                    const sourceLabel =
                                      rubricItems.find((r) => r.value === item.sourceRubricId)?.label ||
                                      "Rubrica não selecionada";
                                    const op = item.operation === "add" ? "+" : "-";
                                    return `${index === 0 ? "" : `${op} `}${sourceLabel}`;
                                  })
                                  .join(" ")}
                          </p>
                        </div>
                      </div>
                    )}

                    {form.calculationMethod !== "manual" && form.nature !== "calculada" && (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="allow-manual-override"
                          checked={form.allowManualOverride}
                          onCheckedChange={(checked) =>
                            setForm((prev) => ({ ...prev, allowManualOverride: checked === true }))
                          }
                        />
                        <Label htmlFor="allow-manual-override">Permitir edição manual na folha</Label>
                      </div>
                    )}
                  </section>
                </TabsContent>

                {/* ─── Aba Classificação ─── */}
                <TabsContent value="classificacao" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-2">
                  <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                    {form.nature === "calculada" ? (
                      // PRD-02: derivadas são saídas do motor — sem classificação técnica.
                      <div className="rounded-md border border-dashed bg-background p-4 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Rubrica derivada</p>
                        <p className="mt-1">
                          Rubricas com natureza <strong>Calculada</strong> são saídas do sistema (PRD-01) e
                          <strong> não recebem classificação técnica</strong>. O agrupamento em recibos e relatórios usa
                          apenas as rubricas <strong>base</strong> classificadas.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Label>Classificação técnica *</Label>
                        <SearchableCombobox
                          value={form.classification ?? ""}
                          items={classificationItems}
                          placeholder="Selecione a classificação"
                          searchPlaceholder="Buscar classificação"
                          emptyMessage="Nenhuma classificação disponível para este tipo"
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, classification: (value || null) as RubricClassification | null }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          Define agrupamento canônico em recibos e relatórios. <strong>Não depende do nome</strong> da
                          rubrica — escolha pela função técnica.
                        </p>
                      </div>
                    )}
                  </section>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
                <Button onClick={() => void handleSave()}>
                  <Save className="mr-1 h-4 w-4" /> Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {kpis.semClassificacao > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
          <ListChecks className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {kpis.semClassificacao} {kpis.semClassificacao === 1 ? "rubrica base ativa sem" : "rubricas base ativas sem"} classificação canônica
            </p>
            <p className="text-xs text-muted-foreground">
              Bloqueia evolução de Recibos e Relatórios (PRD-02). Edite cada rubrica marcada como{" "}
              <span className="font-medium text-destructive">Pendente</span> e defina a classificação técnica.
              Rubricas <strong>derivadas</strong> (calculadas) não entram nesta contagem — são saídas do sistema.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <NotebookText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total de rubricas</p>
            <p className="text-xl font-bold tabular-nums">{kpis.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
            <Check className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativas</p>
            <p className="text-xl font-bold tabular-nums">{kpis.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inativas</p>
            <p className="text-xl font-bold tabular-nums">{kpis.inactive}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
            <ListChecks className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sem classificação</p>
            <p className="text-xl font-bold tabular-nums">{kpis.semClassificacao}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-card px-8 pb-8 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Filtrar por:</p>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFilters(getInitialFilters())}>
              <X className="mr-1 h-3 w-3" /> Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5" /> Nome ou código
            </Label>
            <Input
              placeholder="Buscar rubrica"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Status
            </Label>
            <Select
              value={filters.status || "__all__"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value === "__all__" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">Tipo</Label>
            <Select
              value={filters.type || "__all__"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, type: value === "__all__" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="provento">Proventos</SelectItem>
                <SelectItem value="desconto">Descontos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">Método</Label>
            <Select
              value={filters.method || "__all__"}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, method: value === "__all__" ? "" : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="valor_fixo">Valor fixo</SelectItem>
                <SelectItem value="percentual">Percentual</SelectItem>
                <SelectItem value="formula">Fórmula</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">Classificação</Label>
            <SearchableCombobox
              value={filters.classification}
              items={filterClassificationItems}
              placeholder="Todas"
              searchPlaceholder="Buscar classificação"
              emptyMessage="Nenhuma classificação"
              clearLabel="Limpar"
              onValueChange={(value) => setFilters((prev) => ({ ...prev, classification: value }))}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando rubricas...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Nome</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Código</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Classificação</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Tipo</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Método</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Ordem</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {[...filteredRubrics]
                .sort((a, b) => a.order - b.order)
                .map((rubric) => {
                  const typeBadge = getTypeBadgeProps(rubric.type);
                  const methodBadge = getMethodBadgeProps(rubric.calculationMethod);
                  const statusBadge = getStatusBadgeProps(rubric.isActive);
                  return (
                    <tr key={rubric.id} className="border-b transition-colors hover:bg-muted/30">
                      <td className="px-4 py-2 leading-tight whitespace-nowrap font-medium">{rubric.name}</td>
                      <td className="px-4 py-2 leading-tight whitespace-nowrap">{rubric.code}</td>
                      <td className="px-4 py-2 leading-tight whitespace-nowrap">
                        {rubric.classification ? (
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                            {CLASSIFICATION_LABELS[rubric.classification]}
                          </Badge>
                        ) : rubric.nature === "calculada" ? (
                          // PRD-02: derivada não recebe classificação por design — não é pendência.
                          <Badge variant="outline" className="border-muted-foreground/30 bg-muted text-muted-foreground">
                            Derivada
                          </Badge>
                        ) : (
                          // PRD-02: rubrica BASE sem classificação canônica — bloqueia evolução para Recibos/Relatórios.
                          <Badge variant="outline" className="border-destructive/40 bg-destructive/15 font-semibold text-destructive">
                            Pendente
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 leading-tight whitespace-nowrap">
                        <Badge variant={typeBadge.variant} className={typeBadge.className}>
                          {typeBadge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 leading-tight whitespace-nowrap">
                        <Badge variant={methodBadge.variant} className={methodBadge.className}>
                          {methodBadge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 leading-tight whitespace-nowrap text-center tabular-nums">{rubric.order}</td>
                      <td className="px-4 py-2 leading-tight whitespace-nowrap text-center">
                        <Badge variant={statusBadge.variant} className={statusBadge.className}>
                          {statusBadge.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 leading-tight whitespace-nowrap">
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(rubric)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => void handleToggleActive(rubric.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> {rubric.isActive ? "Inativar" : "Ativar"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {filteredRubrics.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {rubrics.length === 0
                      ? "Nenhuma rubrica cadastrada."
                      : "Nenhuma rubrica encontrada com os filtros aplicados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Rubrics;
