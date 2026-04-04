import React, { useMemo, useRef, useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BriefcaseBusiness, Building2, Check, ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, MoreHorizontal, Pencil, Plus, Save, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { JobRole } from "@/types/payroll";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

type FormState = {
  name: string;
  companyId: string;
  isActive: boolean;
};

type FilterState = {
  search: string;
  status: string;
  companyId: string;
};

const getInitialForm = (companyId = ""): FormState => ({ name: "", companyId, isActive: true });
const getInitialFilters = (): FilterState => ({ search: "", status: "", companyId: "" });

const JobRoles: React.FC = () => {
  const { companies, selectedCompany, jobRoles, addJobRole, updateJobRole, deleteJobRole, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobRole | null>(null);
  const [form, setForm] = useState<FormState>(getInitialForm());
  const [filters, setFilters] = useState<FilterState>(getInitialFilters());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const companyNameMap = useMemo(() => Object.fromEntries(companies.map((company) => [company.id, company.name])), [companies]);

  const filteredJobRoles = useMemo(() => {
    return jobRoles.filter((jobRole) => {
      if (filters.search && !jobRole.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      if (filters.status === "active" && !jobRole.isActive) return false;
      if (filters.status === "inactive" && jobRole.isActive) return false;
      if (filters.companyId && jobRole.companyId !== filters.companyId) return false;
      return true;
    });
  }, [jobRoles, filters]);

  const kpis = useMemo(() => {
    const total = jobRoles.length;
    const active = jobRoles.filter((jobRole) => jobRole.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [jobRoles]);

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.companyId);

  const openNew = () => {
    setEditing(null);
    setForm(getInitialForm(selectedCompany?.id || ""));
    setOpen(true);
  };

  const openEdit = (jobRole: JobRole) => {
    setEditing(jobRole);
    setForm({ name: jobRole.name, companyId: jobRole.companyId, isActive: jobRole.isActive });
    setOpen(true);
  };

  const handleSave = async () => {
    const normalizedName = normalizeText(form.name);

    if (!normalizedName) {
      toast.error("Informe o nome da função/cargo.");
      return;
    }

    if (!form.companyId) {
      toast.error("Selecione a empresa vinculada.");
      return;
    }

    try {
      if (editing) {
        await updateJobRole(editing.id, { name: normalizedName, companyId: form.companyId, isActive: form.isActive });
        toast.success("Função/cargo atualizada.");
      } else {
        await addJobRole({ name: normalizedName, companyId: form.companyId, isActive: form.isActive });
        toast.success("Função/cargo criada.");
      }
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar a função/cargo.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJobRole(id);
      toast.success("Função/cargo removida.");
    } catch {
      toast.error("Não foi possível remover a função/cargo.");
    }
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    toast.success(`Exportação de funções/cargos em ${type === "xlsx" ? "Excel (.xlsx)" : "PDF"} iniciada (simulação).`);
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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Funções/Cargos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedCompany?.name || "Selecione uma empresa"} — {filteredJobRoles.length} de {jobRoles.length} funções/cargos
          </p>
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
                <DialogTitle className="text-xl">Importar funções/cargos</DialogTitle>
                <p className="text-sm text-muted-foreground">Faça upload da planilha no modelo padrão para cadastrar funções/cargos em lote.</p>
              </DialogHeader>

              <div className="space-y-4">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => toast.info("Download do modelo Excel disponível em breve.")}>
                  <Download className="mr-1 h-4 w-4" /> Baixar modelo Excel
                </Button>

                <label
                  htmlFor="job-role-import-file"
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

                <Input id="job-role-import-file" type="file" accept=".xlsx,.xls" className="hidden" ref={importInputRef} onChange={(event) => handleImportFileSelection(event.target.files?.[0])} />

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
                <Button onClick={() => toast.success("Importação de funções/cargos enviada para processamento (simulação).") || resetImportModal()}>
                  <Upload className="mr-1 h-4 w-4" /> Importar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" /> Nova Função/Cargo
              </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[65vh] max-h-[65vh] max-w-2xl flex-col overflow-hidden">
              <DialogHeader className="border-b pb-3">
                <DialogTitle className="text-xl">{editing ? "Editar função/cargo" : "Nova função/cargo"}</DialogTitle>
                <p className="text-sm text-muted-foreground">Cadastro administrativo padronizado conforme a tela piloto de funcionários.</p>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Dados da função/cargo</h3>
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Empresa vinculada *</Label>
                    <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.isActive ? "ativo" : "inativo"} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value === "ativo" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </section>
              </div>

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
            <BriefcaseBusiness className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold tabular-nums">{kpis.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
            <Check className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-xl font-bold tabular-nums">{kpis.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inativos</p>
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

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5" /> Nome da função/cargo
            </Label>
            <Input placeholder="Buscar por nome" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Status
            </Label>
            <Select value={filters.status || "__all__"} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value === "__all__" ? "" : value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3">
          <Button variant="ghost" size="sm" className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowAdvancedFilters((prev) => !prev)}>
            {showAdvancedFilters ? <><ChevronUp className="mr-1 h-3.5 w-3.5" /> Ver menos filtros</> : <><ChevronDown className="mr-1 h-3.5 w-3.5" /> Ver mais filtros</>}
          </Button>
        </div>

        <div aria-hidden={!showAdvancedFilters} className={`overflow-hidden transition-all duration-200 ease-out ${showAdvancedFilters ? "mt-4 max-h-48 opacity-100" : "max-h-0 opacity-0"}`}>
          <div className={`grid gap-4 ${showAdvancedFilters ? "pointer-events-auto" : "pointer-events-none"}`} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> Empresa vinculada
              </Label>
              <Select value={filters.companyId || "__all__"} onValueChange={(value) => setFilters((prev) => ({ ...prev, companyId: value === "__all__" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as empresas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando funções/cargos...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Função/Cargo</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Empresa vinculada</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filteredJobRoles.map((jobRole) => (
                <tr key={jobRole.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2 leading-tight whitespace-nowrap font-medium">{jobRole.name}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground">{companyNameMap[jobRole.companyId] || "-"}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-center">
                    <Badge variant={jobRole.isActive ? "default" : "secondary"} className={jobRole.isActive ? "bg-success text-success-foreground" : ""}>
                      {jobRole.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(jobRole)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(jobRole.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredJobRoles.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    {jobRoles.length === 0 ? "Nenhuma função/cargo cadastrada para esta empresa." : "Nenhuma função/cargo encontrada com os filtros aplicados."}
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

export default JobRoles;
