import React, { useMemo, useRef, useState } from "react";
import { usePayroll, formatCnpj, isValidCnpj } from "@/contexts/PayrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  FileText,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { Company } from "@/types/payroll";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

type FormState = {
  name: string;
  cnpj: string;
  address: string;
  isActive: boolean;
};

type FilterState = {
  search: string;
  // Comentário: padrão "active" — PRD-05 §5.4 (operacional vê ativas por padrão).
  status: "active" | "inactive" | "all";
  address: string;
};

const getInitialFilters = (): FilterState => ({ search: "", status: "active", address: "" });

const Companies: React.FC = () => {
  const {
    companies,
    addCompany,
    updateCompany,
    setCompanyActive,
    isLoading,
    loadError,
    reloadData,
  } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<FormState>({ name: "", cnpj: "", address: "", isActive: true });
  const [filters, setFilters] = useState<FilterState>(getInitialFilters());
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ company: Company; nextActive: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const kpis = useMemo(() => {
    const active = companies.filter((c) => c.isActive).length;
    const inactive = companies.length - active;
    return { total: companies.length, active, inactive };
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      if (filters.status === "active" && !company.isActive) return false;
      if (filters.status === "inactive" && company.isActive) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const cnpjDigits = company.cnpj.replace(/\D/g, "");
        const matchesName = company.name.toLowerCase().includes(q);
        const matchesCnpj = cnpjDigits.includes(q.replace(/\D/g, "")) || formatCnpj(cnpjDigits).toLowerCase().includes(q);
        if (!matchesName && !matchesCnpj) return false;
      }
      if (filters.address && !(company.address || "").toLowerCase().includes(filters.address.toLowerCase())) return false;
      return true;
    });
  }, [companies, filters]);

  const hasActiveFilters = Boolean(filters.search || filters.status !== "active" || filters.address);

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", address: "", isActive: true });
    setOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditing(company);
    setForm({
      name: company.name,
      cnpj: formatCnpj(company.cnpj),
      address: company.address || "",
      isActive: company.isActive,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const cnpjDigits = form.cnpj.replace(/\D/g, "");
    const name = normalizeText(form.name);
    const address = normalizeText(form.address);

    if (!name) {
      toast.error("Informe o nome da empresa.");
      return;
    }
    if (!cnpjDigits) {
      toast.error("Informe o CNPJ.");
      return;
    }
    if (!isValidCnpj(cnpjDigits)) {
      toast.error("CNPJ inválido. Verifique os dígitos.");
      return;
    }
    if (!address) {
      toast.error("Informe o endereço da empresa.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCompany(editing.id, { name, cnpj: cnpjDigits, address, isActive: form.isActive });
        toast.success("Empresa atualizada.");
      } else {
        await addCompany({ name, cnpj: cnpjDigits, address, isActive: true });
        toast.success("Empresa cadastrada.");
      }
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar a empresa.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!confirmAction) return;
    try {
      await setCompanyActive(confirmAction.company.id, confirmAction.nextActive);
      toast.success(confirmAction.nextActive ? "Empresa reativada." : "Empresa inativada.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível alterar o status.";
      toast.error(message);
    } finally {
      setConfirmAction(null);
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

  // Estados especiais: erro, carregando, vazio
  if (loadError) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h2 className="text-lg font-semibold">Não foi possível carregar as empresas</h2>
        <p className="max-w-md text-sm text-muted-foreground">{loadError}</p>
        <Button onClick={() => void reloadData()} variant="outline" size="sm">
          <RefreshCw className="mr-1 h-4 w-4" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Empresas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro corporativo central — {filteredCompanies.length} de {companies.length} empresas
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
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
              <DialogHeader className="border-b pb-3">
                <DialogTitle className="text-xl">{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle>
                <p className="text-sm text-muted-foreground">Cadastro administrativo central conforme PRD-05.</p>
              </DialogHeader>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Dados da empresa</h3>
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CNPJ *</Label>
                    <Input
                      value={form.cnpj}
                      placeholder="00.000.000/0000-00"
                      onChange={(event) => {
                        const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
                        setForm((prev) => ({ ...prev, cnpj: digits.length === 14 ? formatCnpj(digits) : digits }));
                      }}
                      onBlur={() => {
                        const digits = form.cnpj.replace(/\D/g, "");
                        if (digits.length === 14) setForm((prev) => ({ ...prev, cnpj: formatCnpj(digits) }));
                      }}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Endereço *</Label>
                    <Input
                      value={form.address}
                      onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                      maxLength={255}
                    />
                  </div>
                  {editing && (
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select
                        value={form.isActive ? "active" : "inactive"}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value === "active" }))}
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
                  )}
                </section>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-3">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
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
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value as FilterState["status"] }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
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
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border bg-card py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-base font-semibold">Nenhuma empresa cadastrada</h3>
          <p className="max-w-sm text-sm text-muted-foreground">Comece cadastrando a primeira empresa do grupo para liberar os demais módulos.</p>
          <Button onClick={openNew} size="sm" className="mt-2">
            <Plus className="mr-1 h-4 w-4" /> Nova empresa
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Empresa</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">CNPJ</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Endereço</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => (
                <tr key={company.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2 leading-tight whitespace-nowrap font-medium">{company.name}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground tabular-nums">{formatCnpj(company.cnpj)}</td>
                  <td className="px-4 py-2 leading-tight text-muted-foreground">{company.address || "-"}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-center">
                    {company.isActive ? (
                      <Badge className="bg-success text-success-foreground hover:bg-success/90">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary">Inativa</Badge>
                    )}
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
                          <DropdownMenuItem onClick={() => openEdit(company)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          {company.isActive ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setConfirmAction({ company, nextActive: false })}
                            >
                              <PowerOff className="mr-2 h-4 w-4" /> Inativar
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setConfirmAction({ company, nextActive: true })}>
                              <Power className="mr-2 h-4 w-4" /> Reativar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma empresa encontrada com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.nextActive ? "Reativar empresa?" : "Inativar empresa?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.nextActive
                ? `A empresa "${confirmAction?.company.name}" voltará a aparecer nos lançamentos operacionais.`
                : `A empresa "${confirmAction?.company.name}" deixará de aparecer em novos lançamentos. O histórico é preservado e você poderá reativá-la a qualquer momento.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmToggle()}>
              {confirmAction?.nextActive ? "Reativar" : "Inativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Companies;
