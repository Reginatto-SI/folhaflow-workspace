import React, { useMemo, useRef, useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Rubric, RubricFormulaItem } from "@/types/payroll";
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
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Calculator, Check, Download, FileSpreadsheet, FileText, MoreHorizontal, NotebookText, Pencil, Plus, Save, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";

type RubricTab = "dados-gerais" | "formula";
type RubricMode = Rubric["mode"];

type RubricFormState = Omit<Rubric, "id">;

type RubricFilterState = {
  search: string;
  status: string;
  type: string;
  mode: string;
};

const categories = [
  "Salário",
  "Horas Extras",
  "Adicionais",
  "Benefícios",
  "INSS",
  "IRRF",
  "FGTS",
  "Outros",
];

const getInitialForm = (): RubricFormState => ({
  name: "",
  code: "",
  category: "",
  type: "earning",
  mode: "manual",
  order: 1,
  isActive: true,
  formulaItems: [],
  allowManualOverride: false,
});

const getInitialFilters = (): RubricFilterState => ({
  search: "",
  status: "",
  type: "",
  mode: "",
});

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

const Rubrics: React.FC = () => {
  const { rubrics, addRubric, updateRubric, deleteRubric, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState<Rubric | null>(null);
  const [form, setForm] = useState<RubricFormState>(getInitialForm());
  const [filters, setFilters] = useState<RubricFilterState>(getInitialFilters());
  const [activeTab, setActiveTab] = useState<RubricTab>("dados-gerais");

  const categoryItems = useMemo(() => {
    const fromData = rubrics.map((rubric) => rubric.category).filter(Boolean);
    const unique = Array.from(new Set([...categories, ...fromData])).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return unique.map((item) => ({ value: item, label: item }));
  }, [rubrics]);

  const rubricItems = useMemo(() => {
    return rubrics.map((rubric) => ({ value: rubric.id, label: `${rubric.code} — ${rubric.name}` }));
  }, [rubrics]);

  const kpis = useMemo(() => {
    const total = rubrics.length;
    const active = rubrics.filter((rubric) => rubric.isActive).length;
    return { total, active, inactive: total - active };
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
      if (filters.mode && rubric.mode !== filters.mode) return false;
      return true;
    });
  }, [filters, rubrics]);

  const openNew = () => {
    setEditing(null);
    setForm(getInitialForm());
    setActiveTab("dados-gerais");
    setOpen(true);
  };

  const openEdit = (rubric: Rubric) => {
    setEditing(rubric);
    setForm({ ...rubric, formulaItems: [...rubric.formulaItems].sort((a, b) => a.order - b.order) });
    setActiveTab("dados-gerais");
    setOpen(true);
  };

  const getCircularError = (draft: RubricFormState, rubricId?: string): string | null => {
    const currentId = rubricId || "__draft__";
    const adjacency = new Map<string, string[]>();

    rubrics.forEach((rubric) => {
      adjacency.set(
        rubric.id,
        rubric.formulaItems.map((item) => item.sourceRubricId)
      );
    });

    adjacency.set(
      currentId,
      draft.mode === "formula" ? draft.formulaItems.map((item) => item.sourceRubricId) : []
    );

    // Comentário: DFS simples para bloquear qualquer dependência circular direta ou indireta.
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

    return walk(currentId) ? "Referência circular detectada na fórmula." : null;
  };

  const validateForm = (draft: RubricFormState) => {
    if (!normalizeText(draft.name)) return "Nome da rubrica é obrigatório.";
    if (!normalizeText(draft.code)) return "Código da rubrica é obrigatório.";
    if (!draft.category) return "Selecione a categoria da rubrica.";
    if (!Number.isFinite(draft.order) || draft.order < 0) return "Ordem deve ser numérica válida.";

    const duplicatedCode = rubrics.some((rubric) => rubric.code.toLowerCase() === draft.code.toLowerCase() && rubric.id !== editing?.id);
    if (duplicatedCode) return "Já existe uma rubrica com este código.";

    if (draft.mode === "formula") {
      if (draft.formulaItems.length === 0) return "Rubrica de fórmula precisa de ao menos um item.";
      const hasEmptyItem = draft.formulaItems.some((item) => !item.sourceRubricId || !Number.isFinite(item.order));
      if (hasEmptyItem) return "Todos os itens da fórmula devem ser preenchidos.";
      if (draft.formulaItems.some((item) => item.sourceRubricId === editing?.id)) {
        return "Rubrica não pode depender dela mesma.";
      }
      const circularError = getCircularError(draft, editing?.id);
      if (circularError) return circularError;
    }

    return null;
  };

  const handleSave = async () => {
    const normalizedForm: RubricFormState = {
      ...form,
      name: normalizeText(form.name),
      code: normalizeText(form.code).toUpperCase(),
      category: normalizeText(form.category),
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
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar a rubrica.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRubric(id);
      toast.success("Rubrica removida.");
    } catch {
      toast.error("Não foi possível remover a rubrica.");
    }
  };

  const addFormulaItem = () => {
    setForm((prev) => ({
      ...prev,
      formulaItems: [...prev.formulaItems, { id: crypto.randomUUID(), operation: "add", sourceRubricId: "", order: prev.formulaItems.length + 1 }],
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
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return prev;
      [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
      return {
        ...prev,
        formulaItems: sorted.map((item, idx) => ({ ...item, order: idx + 1 })),
      };
    });
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    toast.success(`Exportação de rubricas em ${type === "xlsx" ? "Excel (.xlsx)" : "PDF"} iniciada (simulação).`);
  };

  const isSpreadsheetFile = (file: File) => file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");

  const handleImportFileSelection = (file?: File) => {
    if (!file) return;
    if (!isSpreadsheetFile(file)) {
      toast.error("Formato inválido. Selecione um arquivo Excel (.xlsx ou .xls).");
      return;
    }
    setSelectedImportFile(file);
  };

  const resetImportModal = () => {
    setSelectedImportFile(null);
    setImportModalOpen(false);
  };

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.type || filters.mode);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cadastro de Rubricas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Rubricas globais compartilhadas entre todas as empresas — {filteredRubrics.length} de {rubrics.length} rubricas</p>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-1 h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Exportar Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileText className="mr-2 h-4 w-4" /> Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={importModalOpen} onOpenChange={(isOpen) => (!isOpen ? resetImportModal() : setImportModalOpen(true))}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="mr-1 h-4 w-4" /> Importar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl">Importar rubricas</DialogTitle>
                <p className="text-sm text-muted-foreground">Faça upload da planilha no modelo padrão para cadastrar rubricas em lote.</p>
              </DialogHeader>

              <div className="space-y-4">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => toast.info("Download do modelo Excel disponível em breve.")}> 
                  <Download className="mr-1 h-4 w-4" /> Baixar modelo Excel
                </Button>

                <label
                  htmlFor="rubric-import-file"
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center transition-colors hover:bg-muted/30"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleImportFileSelection(event.dataTransfer.files?.[0]);
                  }}
                >
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Arraste e solte o arquivo aqui</p>
                  <p className="text-xs text-muted-foreground">ou use o botão abaixo para selecionar</p>
                </label>

                <Input id="rubric-import-file" type="file" accept=".xlsx,.xls" className="hidden" ref={importInputRef} onChange={(event) => handleImportFileSelection(event.target.files?.[0])} />

                <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()}>
                  Selecionar arquivo
                </Button>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Formato suportado: Excel (.xlsx, .xls).</p>
                  <p>{selectedImportFile ? `Arquivo selecionado: ${selectedImportFile.name}` : "Nenhum arquivo selecionado."}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={resetImportModal}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
                <Button onClick={() => toast.success("Importação de rubricas enviada para processamento (simulação).") || resetImportModal()}>
                  <Upload className="mr-1 h-4 w-4" /> Importar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" /> Nova Rubrica
              </Button>
            </DialogTrigger>

            <DialogContent className="flex h-[90vh] max-h-[90vh] max-w-4xl flex-col overflow-hidden">
              <DialogHeader className="border-b pb-3">
                <DialogTitle className="text-xl">{editing ? "Editar rubrica" : "Nova rubrica"}</DialogTitle>
                <p className="text-sm text-muted-foreground">Cadastro padronizado com abas para dados gerais e composição de fórmula.</p>
              </DialogHeader>

              {/* Comentário: mantém cabeçalho/abas/rodapé fixos e aplica scroll apenas na área de conteúdo. */}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RubricTab)} className="flex min-h-0 flex-1 flex-col overflow-hidden pt-3">
                <TabsList className="mb-3 grid w-full grid-cols-2">
                  <TabsTrigger value="dados-gerais"><FileText className="mr-1 h-4 w-4" />Dados Gerais</TabsTrigger>
                  <TabsTrigger value="formula" disabled={form.mode !== "formula"}><Calculator className="mr-1 h-4 w-4" />Fórmula</TabsTrigger>
                </TabsList>

                <TabsContent value="dados-gerais" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-2">
                  <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                    <h3 className="text-sm font-semibold">Dados principais</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Nome da rubrica *</Label>
                        <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Código *</Label>
                        <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Categoria *</Label>
                        <SearchableCombobox
                          value={form.category}
                          items={categoryItems}
                          placeholder="Selecione a categoria"
                          searchPlaceholder="Buscar categoria"
                          emptyMessage="Nenhuma categoria encontrada"
                          clearLabel="Limpar categoria"
                          onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tipo</Label>
                        <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as Rubric["type"] }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="earning">Provento</SelectItem>
                            <SelectItem value="deduction">Desconto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Modo da rubrica</Label>
                        <Select
                          value={form.mode}
                          onValueChange={(value) => {
                            const nextMode = value as RubricMode;
                            setForm((prev) => ({ ...prev, mode: nextMode, formulaItems: nextMode === "manual" ? [] : prev.formulaItems }));
                            setActiveTab(nextMode === "formula" ? "formula" : "dados-gerais");
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="formula">Fórmula</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ordem de exibição</Label>
                        <Input type="number" min={0} value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: Number(event.target.value || 0) }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select value={form.isActive ? "active" : "inactive"} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value === "active" }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Ativa</SelectItem>
                            <SelectItem value="inactive">Inativa</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </TabsContent>

                <TabsContent value="formula" className="mt-0 min-h-0 flex-1 overflow-y-auto pr-2">
                  <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Composição da fórmula</h3>
                      <Button type="button" size="sm" variant="outline" onClick={addFormulaItem}>
                        <Plus className="mr-1 h-4 w-4" /> Adicionar item
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {[...form.formulaItems].sort((a, b) => a.order - b.order).map((item) => (
                        <div key={item.id} className="grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[110px,1fr,110px,auto]">
                          <div className="space-y-1">
                            <Label className="text-xs">Operação</Label>
                            <Select value={item.operation} onValueChange={(value) => updateFormulaItem(item.id, { operation: value as RubricFormulaItem["operation"] })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
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
                              items={rubricItems.filter((rubricItem) => rubricItem.value !== editing?.id)}
                              placeholder="Selecione a rubrica"
                              searchPlaceholder="Buscar rubrica"
                              emptyMessage="Nenhuma rubrica encontrada"
                              onValueChange={(value) => updateFormulaItem(item.id, { sourceRubricId: value })}
                            />
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Ordem</Label>
                            <Input type="number" min={1} value={item.order} onChange={(event) => updateFormulaItem(item.id, { order: Number(event.target.value || 1) })} />
                          </div>

                          <div className="flex items-end justify-end gap-1">
                            <Button variant="ghost" size="icon" type="button" onClick={() => moveFormulaItem(item.id, "up")}>
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" type="button" onClick={() => moveFormulaItem(item.id, "down")}>
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" type="button" className="text-destructive" onClick={() => removeFormulaItem(item.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {form.formulaItems.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item adicionado. Clique em "Adicionar item" para montar a fórmula.</p>}
                    </div>

                    <div className="rounded-md border bg-background p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Pré-visualização da fórmula</p>
                      <p className="text-sm font-medium">
                        {form.formulaItems.length === 0
                          ? "—"
                          : [...form.formulaItems]
                              .sort((a, b) => a.order - b.order)
                              .map((item, index) => {
                                const sourceLabel = rubricItems.find((rubricItem) => rubricItem.value === item.sourceRubricId)?.label || "Rubrica não selecionada";
                                const op = item.operation === "add" ? "+" : "-";
                                return `${index === 0 ? "" : `${op} `}${sourceLabel}`;
                              })
                              .join(" ")}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox id="allow-manual-override" checked={form.allowManualOverride} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowManualOverride: checked === true }))} />
                      <Label htmlFor="allow-manual-override">Permitir edição manual na folha</Label>
                    </div>
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
            <Input placeholder="Buscar rubrica" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Status
            </Label>
            <Select value={filters.status || "__all__"} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value === "__all__" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">Tipo</Label>
            <Select value={filters.type || "__all__"} onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value === "__all__" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="earning">Proventos</SelectItem>
                <SelectItem value="deduction">Descontos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">Modo</Label>
            <Select value={filters.mode || "__all__"} onValueChange={(value) => setFilters((prev) => ({ ...prev, mode: value === "__all__" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="formula">Fórmula</SelectItem>
              </SelectContent>
            </Select>
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modo</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ordem</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {[...filteredRubrics].sort((a, b) => a.order - b.order).map((rubric) => (
                <tr key={rubric.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{rubric.name}</td>
                  <td className="px-4 py-3">{rubric.code}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rubric.category}</td>
                  <td className="px-4 py-3">{rubric.type === "earning" ? "Provento" : "Desconto"}</td>
                  <td className="px-4 py-3">{rubric.mode === "manual" ? "Manual" : "Fórmula"}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{rubric.order}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={rubric.isActive ? "default" : "secondary"} className={rubric.isActive ? "bg-success text-success-foreground" : ""}>
                      {rubric.isActive ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
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
                          <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(rubric.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRubrics.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    {rubrics.length === 0 ? "Nenhuma rubrica cadastrada." : "Nenhuma rubrica encontrada com os filtros aplicados."}
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
