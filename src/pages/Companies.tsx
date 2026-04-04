import React, { useMemo, useRef, useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Check, ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, MapPin, MoreHorizontal, Pencil, Plus, Save, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { Company } from "@/types/payroll";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

type FormState = {
  name: string;
  cnpj: string;
  address: string;
};

type FilterState = {
  search: string;
  status: string;
  address: string;
};

const getInitialFilters = (): FilterState => ({ search: "", status: "", address: "" });

const Companies: React.FC = () => {
  const { companies, addCompany, updateCompany, deleteCompany, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", cnpj: "", address: "" });
  const [filters, setFilters] = useState<FilterState>(getInitialFilters());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Comentário: no modelo atual todas as empresas cadastradas são operacionais (status ativo implícito).
  const activeCompanies = companies;

  const filteredCompanies = useMemo(() => {
    return activeCompanies.filter((company) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchesName = company.name.toLowerCase().includes(q);
        const matchesCnpj = company.cnpj.toLowerCase().includes(q);
        if (!matchesName && !matchesCnpj) return false;
      }
      if (filters.address && !(company.address || "").toLowerCase().includes(filters.address.toLowerCase())) return false;
      if (filters.status === "inactive") return false;
      return true;
    });
  }, [activeCompanies, filters]);

  const kpis = useMemo(() => ({ total: activeCompanies.length, active: activeCompanies.length, inactive: 0 }), [activeCompanies]);

  const hasActiveFilters = Boolean(filters.search || filters.status || filters.address);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", address: "" });
    setOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditing(company);
    setForm({ name: company.name, cnpj: company.cnpj, address: company.address || "" });
    setOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      name: normalizeText(form.name),
      cnpj: normalizeText(form.cnpj),
      address: normalizeText(form.address),
    };

    if (!payload.name || !payload.cnpj) {
      toast.error("Preencha nome e CNPJ.");
      return;
    }

    try {
      if (editing) {
        await updateCompany(editing.id, payload);
        toast.success("Empresa atualizada.");
      } else {
        await addCompany(payload);
        toast.success("Empresa criada.");
      }
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar a empresa.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCompany(id);
      toast.success("Empresa removida.");
    } catch {
      toast.error("Não foi possível remover a empresa.");
    }
  };

  const handleExport = (type: "xlsx" | "pdf") => {
    toast.success(`Exportação de empresas em ${type === "xlsx" ? "Excel (.xlsx)" : "PDF"} iniciada (simulação).`);
  };

  const handleImportFileSelection = (file?: File) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
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
          <h2 className="text-2xl font-bold tracking-tight">Empresas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro corporativo central — {filteredCompanies.length} de {activeCompanies.length} empresas
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
                <DialogTitle className="text-xl">Importar empresas</DialogTitle>
                <p className="text-sm text-muted-foreground">Faça upload da planilha no modelo padrão para cadastrar empresas em lote.</p>
              </DialogHeader>

              <div className="space-y-4">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => toast.info("Download do modelo Excel disponível em breve.")}>
                  <Download className="mr-1 h-4 w-4" /> Baixar modelo Excel
                </Button>

                <label
                  htmlFor="company-import-file"
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

                <Input id="company-import-file" type="file" accept=".xlsx,.xls" className="hidden" ref={importInputRef} onChange={(event) => handleImportFileSelection(event.target.files?.[0])} />

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
                <Button onClick={() => toast.success("Importação de empresas enviada para processamento (simulação).") || resetImportModal()}>
                  <Upload className="mr-1 h-4 w-4" /> Importar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} size="sm">
                <Plus className="mr-1 h-4 w-4" /> Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="flex h-[65vh] max-h-[65vh] max-w-2xl flex-col overflow-hidden">
              <DialogHeader className="border-b pb-3">
                <DialogTitle className="text-xl">{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
                <p className="text-sm text-muted-foreground">Cadastro administrativo padronizado conforme a tela piloto de funcionários.</p>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Dados da empresa</h3>
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CNPJ *</Label>
                    <Input value={form.cnpj} onChange={(event) => setForm((prev) => ({ ...prev, cnpj: event.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Endereço</Label>
                    <Input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
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
            <Building2 className="h-4 w-4 text-primary" />
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

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Search className="h-3.5 w-3.5" /> Nome ou CNPJ
            </Label>
            <Input placeholder="Buscar por nome ou CNPJ" value={filters.search} onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))} />
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
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
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
                <MapPin className="h-3.5 w-3.5" /> Endereço
              </Label>
              <Input placeholder="Filtrar por endereço" value={filters.address} onChange={(event) => setFilters((prev) => ({ ...prev, address: event.target.value }))} />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando empresas...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">CNPJ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{company.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{company.cnpj}</td>
                  <td className="px-4 py-3 text-muted-foreground">{company.address || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-success text-success-foreground">Ativa</Badge>
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
                          <DropdownMenuItem onClick={() => openEdit(company)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => void handleDelete(company.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    {activeCompanies.length === 0 ? "Nenhuma empresa cadastrada." : "Nenhuma empresa encontrada com os filtros aplicados."}
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

export default Companies;
