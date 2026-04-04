import React, { useMemo, useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BriefcaseBusiness, Landmark, NotebookPen, Pencil, Plus, Save, Trash2, User, X } from "lucide-react";
import { Employee } from "@/types/payroll";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

type EmployeeTab = "dados-funcionario" | "dados-funcionais" | "dados-bancarios" | "observacoes";

type EmployeeFormState = Omit<Employee, "id">;

type EmployeeFormErrors = Partial<Record<"name" | "cpf" | "admissionDate" | "companyId" | "departmentId" | "jobRoleId" | "bankName" | "bankBranch" | "bankAccount", string>>;

const getInitialForm = (companyId = ""): EmployeeFormState => ({
  companyId,
  name: "",
  cpf: "",
  admissionDate: "",
  registration: "",
  workCardNumber: "",
  notes: "",
  departmentId: "",
  department: "",
  jobRoleId: "",
  role: "",
  isMonthly: false,
  isOnLeave: false,
  isActive: true,
  bankName: "",
  bankBranch: "",
  bankAccount: "",
  // Comentário: mantemos esse campo por compatibilidade com a Central de Folha nesta fase.
  baseSalary: 0,
});

// Comentário: CPF sempre é persistido sem máscara para manter consistência e facilitar validação futura no banco.
const sanitizeDigits = (value: string) => value.replace(/\D/g, "");

const maskCpf = (value: string) => {
  const digits = sanitizeDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const isValidCpf = (value: string) => {
  const cpf = sanitizeDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (slice: string, factor: number) => {
    const total = slice
      .split("")
      .reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const result = 11 - (total % 11);
    return result > 9 ? 0 : result;
  };

  const firstDigit = calcDigit(cpf.slice(0, 9), 10);
  const secondDigit = calcDigit(cpf.slice(0, 10), 11);
  return firstDigit === Number(cpf[9]) && secondDigit === Number(cpf[10]);
};

const normalizeText = (value?: string) => value?.trim().replace(/\s+/g, " ") || "";

const normalizeBankField = (value?: string) => {
  const normalized = normalizeText(value);
  return normalized.length >= 2 ? normalized : "";
};

const Employees: React.FC = () => {
  const { companies, employees, allDepartments, allJobRoles, selectedCompany, addEmployee, updateEmployee, deleteEmployee, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(getInitialForm());
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [activeTab, setActiveTab] = useState<EmployeeTab>("dados-funcionario");

  // Comentário: na transição gradual, filtros usam a empresa registrada do formulário (companyId),
  // garantindo catálogo correto por empresa mesmo que a empresa selecionada na listagem seja outra.
  const { availableDepartments, availableJobRoles } = useMemo(() => {
    const companyId = form.companyId;
    return {
      availableDepartments: allDepartments.filter((department) => department.companyId === companyId && department.isActive),
      availableJobRoles: allJobRoles.filter((jobRole) => jobRole.companyId === companyId && jobRole.isActive),
    };
  }, [allDepartments, allJobRoles, form.companyId]);

  const departmentItems = useMemo(
    () => availableDepartments.map((department) => ({ value: department.id, label: department.name })),
    [availableDepartments]
  );

  const jobRoleItems = useMemo(
    () => availableJobRoles.map((jobRole) => ({ value: jobRole.id, label: jobRole.name })),
    [availableJobRoles]
  );

  const openNew = () => {
    setEditing(null);
    setErrors({});
    setActiveTab("dados-funcionario");
    setForm(getInitialForm(selectedCompany?.id || ""));
    setOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setErrors({});
    setActiveTab("dados-funcionario");
    setForm({ ...employee, cpf: maskCpf(employee.cpf) });
    setOpen(true);
  };

  const validateForm = (draft: EmployeeFormState) => {
    const nextErrors: EmployeeFormErrors = {};

    if (!normalizeText(draft.name)) nextErrors.name = "Informe o nome completo.";
    if (!draft.admissionDate) nextErrors.admissionDate = "Informe a data de admissão.";
    if (!draft.companyId) nextErrors.companyId = "Selecione a empresa registrada.";

    if (!isValidCpf(draft.cpf)) {
      nextErrors.cpf = "CPF inválido. Verifique os 11 dígitos.";
    }

    if (draft.departmentId) {
      const validDepartment = allDepartments.some((department) => department.id === draft.departmentId && department.companyId === draft.companyId && department.isActive);
      if (!validDepartment) {
        nextErrors.departmentId = "Selecione um setor ativo válido da empresa registrada.";
      }
    }

    if (draft.jobRoleId) {
      const validJobRole = allJobRoles.some((jobRole) => jobRole.id === draft.jobRoleId && jobRole.companyId === draft.companyId && jobRole.isActive);
      if (!validJobRole) {
        nextErrors.jobRoleId = "Selecione uma função/cargo ativa válida da empresa registrada.";
      }
    }

    const bankName = normalizeText(draft.bankName);
    const bankBranch = normalizeText(draft.bankBranch);
    const bankAccount = normalizeText(draft.bankAccount);

    if (bankName && bankName.length < 2) {
      nextErrors.bankName = "Banco deve ter ao menos 2 caracteres.";
    }
    if (bankBranch && bankBranch.length < 2) {
      nextErrors.bankBranch = "Agência deve ter ao menos 2 caracteres.";
    }
    if (bankAccount && bankAccount.length < 3) {
      nextErrors.bankAccount = "Conta deve ter ao menos 3 caracteres.";
    }

    const hasAnyBankField = Boolean(bankName || bankBranch || bankAccount);
    if (hasAnyBankField && (!bankName || !bankBranch || !bankAccount)) {
      if (!bankName) nextErrors.bankName = "Preencha banco, agência e conta juntos.";
      if (!bankBranch) nextErrors.bankBranch = "Preencha banco, agência e conta juntos.";
      if (!bankAccount) nextErrors.bankAccount = "Preencha banco, agência e conta juntos.";
    }

    return nextErrors;
  };

  const buildPayload = (): Omit<Employee, "id"> => {
    const normalizedName = normalizeText(form.name);
    const normalizedRegistration = normalizeText(form.registration);
    const normalizedDepartment = normalizeText(form.department);
    const normalizedRole = normalizeText(form.role);
    const normalizedNotes = normalizeText(form.notes);

    return {
      ...form,
      companyId: form.companyId || selectedCompany?.id || "",
      name: normalizedName,
      cpf: sanitizeDigits(form.cpf),
      registration: normalizedRegistration,
      departmentId: form.departmentId || "",
      department: normalizedDepartment,
      jobRoleId: form.jobRoleId || "",
      role: normalizedRole,
      notes: normalizedNotes,
      bankName: normalizeBankField(form.bankName),
      bankBranch: normalizeBankField(form.bankBranch),
      bankAccount: normalizeBankField(form.bankAccount),
    };
  };

  const handleSave = async () => {
    if (!selectedCompany?.id && !form.companyId) {
      toast.error("Selecione uma empresa antes de cadastrar funcionário.");
      return;
    }

    const nextErrors = validateForm(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Revise os campos destacados antes de salvar.");
      return;
    }

    const payload = buildPayload();

    try {
      if (editing) {
        await updateEmployee(editing.id, payload);
        toast.success("Funcionário atualizado.");
      } else {
        await addEmployee(payload);
        toast.success("Funcionário adicionado.");
      }
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar o funcionário.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEmployee(id);
      toast.success("Funcionário removido.");
    } catch {
      toast.error("Não foi possível remover o funcionário.");
    }
  };

  const fieldClass = (field: keyof EmployeeFormErrors) => cn(errors[field] && "border-destructive focus-visible:ring-destructive/40");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Funcionários</h2>
          <p className="text-sm text-muted-foreground">
            {selectedCompany?.name || "Selecione uma empresa"} — {employees.length} funcionários registrados
          </p>
          <p className="text-xs text-muted-foreground">
            Cadastro-base por empresa registrada. Participação em folhas multiempresa é uma camada operacional separada.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) setErrors({});
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm">
              <Plus className="mr-1 h-4 w-4" /> Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="flex h-[85vh] max-h-[85vh] max-w-4xl flex-col overflow-hidden">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-xl">{editing ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Tela piloto oficial de cadastro administrativo: dados base, sem valores de folha.
              </p>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as EmployeeTab)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 gap-1 rounded-lg bg-muted p-1 lg:grid-cols-4">
                <TabsTrigger value="dados-funcionario"><User className="mr-1 h-4 w-4" />Dados do funcionário</TabsTrigger>
                <TabsTrigger value="dados-funcionais"><BriefcaseBusiness className="mr-1 h-4 w-4" />Dados funcionais</TabsTrigger>
                <TabsTrigger value="dados-bancarios"><Landmark className="mr-1 h-4 w-4" />Dados bancários</TabsTrigger>
                <TabsTrigger value="observacoes"><NotebookPen className="mr-1 h-4 w-4" />Observações</TabsTrigger>
              </TabsList>

              <TabsContent value="dados-funcionario" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Dados principais</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Nome completo *</Label>
                      <Input
                        className={fieldClass("name")}
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>CPF *</Label>
                      <Input
                        className={fieldClass("cpf")}
                        inputMode="numeric"
                        maxLength={14}
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={(event) => setForm((prev) => ({ ...prev, cpf: maskCpf(event.target.value) }))}
                      />
                      {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de admissão *</Label>
                      <Input
                        className={fieldClass("admissionDate")}
                        type="date"
                        value={form.admissionDate}
                        onChange={(event) => setForm((prev) => ({ ...prev, admissionDate: event.target.value }))}
                      />
                      {errors.admissionDate && <p className="text-xs text-destructive">{errors.admissionDate}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Nº da carteira de trabalho (CTPS)</Label>
                      <Input
                        // Comentário: campo incluído por regra de negócio do cadastro-base e persistido como work_card_number.
                        placeholder="Ex.: 1234567"
                        value={form.workCardNumber || ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, workCardNumber: event.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Empresa registrada *</Label>
                      {/* Comentário: companyId passa a ser tratado explicitamente como empresa registrada. */}
                      <Select
                        value={form.companyId}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            companyId: value,
                            // Comentário: ao trocar empresa registrada, removemos vínculos por ID incompatíveis.
                            departmentId: "",
                            jobRoleId: "",
                          }))
                        }
                      >
                        <SelectTrigger className={fieldClass("companyId")}>
                          <SelectValue placeholder="Selecione a empresa formal de registro" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Esta seleção define apenas a empresa de registro formal. A participação em folhas de outras empresas do grupo será tratada em fluxo específico.
                      </p>
                      {errors.companyId && <p className="text-xs text-destructive">{errors.companyId}</p>}
                    </div>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="dados-funcionais" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Dados funcionais</h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Setor</Label>
                      <SearchableCombobox
                        className={fieldClass("departmentId")}
                        value={form.departmentId || ""}
                        items={departmentItems}
                        disabled={!form.companyId}
                        placeholder={form.companyId ? "Selecionar setor..." : "Selecione a empresa registrada primeiro"}
                        searchPlaceholder="Buscar setor..."
                        emptyMessage="Nenhum resultado encontrado"
                        clearLabel="Não vincular setor agora"
                        createActionLabel="+ Criar novo setor"
                        onCreateActionClick={() => toast.info("Use a aba de Setores para criar novos registros.")}
                        onValueChange={(value) => {
                          if (!value) {
                            setForm((prev) => ({ ...prev, departmentId: "", department: prev.department || "" }));
                            return;
                          }
                          const selectedDepartment = availableDepartments.find((department) => department.id === value);
                          setForm((prev) => ({ ...prev, departmentId: value, department: selectedDepartment?.name || prev.department || "" }));
                        }}
                      />
                      {!!form.department && !form.departmentId && (
                        <p className="text-xs text-muted-foreground">
                          Legado: este funcionário mantém setor em texto livre ({form.department}) até associação por ID.
                        </p>
                      )}
                      {errors.departmentId && <p className="text-xs text-destructive">{errors.departmentId}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Função / Cargo</Label>
                      <SearchableCombobox
                        className={fieldClass("jobRoleId")}
                        value={form.jobRoleId || ""}
                        items={jobRoleItems}
                        disabled={!form.companyId}
                        placeholder={form.companyId ? "Selecionar função/cargo..." : "Selecione a empresa registrada primeiro"}
                        searchPlaceholder="Buscar função/cargo..."
                        emptyMessage="Nenhum resultado encontrado"
                        clearLabel="Não vincular função/cargo agora"
                        createActionLabel="+ Criar nova função"
                        onCreateActionClick={() => toast.info("Use a aba de Funções/Cargos para criar novos registros.")}
                        onValueChange={(value) => {
                          if (!value) {
                            setForm((prev) => ({ ...prev, jobRoleId: "", role: prev.role || "" }));
                            return;
                          }
                          const selectedJobRole = availableJobRoles.find((jobRole) => jobRole.id === value);
                          setForm((prev) => ({ ...prev, jobRoleId: value, role: selectedJobRole?.name || prev.role || "" }));
                        }}
                      />
                      {!!form.role && !form.jobRoleId && (
                        <p className="text-xs text-muted-foreground">
                          Legado: esta função/cargo segue em texto livre ({form.role}) até associação por ID.
                        </p>
                      )}
                      {errors.jobRoleId && <p className="text-xs text-destructive">{errors.jobRoleId}</p>}
                    </div>
                  </div>
                  {/* Comentário: o salário base permanece no modelo por compatibilidade de folha, mas foi removido desta UI de cadastro-base. */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="flex min-h-14 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                      <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))} />
                      Ativo
                    </label>
                    <label className="flex min-h-14 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                      <Checkbox checked={form.isOnLeave} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isOnLeave: checked === true }))} />
                      Afastado
                    </label>
                    <label className="flex min-h-14 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                      <Checkbox checked={form.isMonthly} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isMonthly: checked === true }))} />
                      Mensalista
                    </label>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="dados-bancarios" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Dados bancários</h3>
                  <p className="text-xs text-muted-foreground">Preencha banco, agência e conta juntos para evitar dados incompletos.</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Banco (nome)</Label>
                      <Input
                        className={fieldClass("bankName")}
                        value={form.bankName || ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, bankName: event.target.value }))}
                      />
                      {errors.bankName && <p className="text-xs text-destructive">{errors.bankName}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Agência</Label>
                      <Input
                        className={fieldClass("bankBranch")}
                        value={form.bankBranch || ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, bankBranch: event.target.value }))}
                      />
                      {errors.bankBranch && <p className="text-xs text-destructive">{errors.bankBranch}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Conta</Label>
                      <Input
                        className={fieldClass("bankAccount")}
                        value={form.bankAccount || ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, bankAccount: event.target.value }))}
                      />
                      {errors.bankAccount && <p className="text-xs text-destructive">{errors.bankAccount}</p>}
                    </div>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="observacoes" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Observações e informações complementares</h3>
                  <Textarea
                    className="min-h-40"
                    placeholder="Anotações operacionais do RH/Financeiro"
                    value={form.notes || ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </section>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <p className="mr-auto text-xs text-muted-foreground">Salário e composição mensal são tratados na Central de Folha.</p>
              <Button variant="outline" onClick={() => setOpen(false)}>
                <X className="mr-1 h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={() => void handleSave()}><Save className="mr-1 h-4 w-4" />Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando funcionários...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">CPF</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Função</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa registrada</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admissão</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{employee.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{maskCpf(employee.cpf)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{employee.department || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{employee.role || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{companies.find((company) => company.id === employee.companyId)?.name || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(employee.admissionDate).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={employee.isActive ? "default" : "secondary"} className={employee.isActive ? "bg-success text-success-foreground" : ""}>
                      {employee.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(employee)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(employee.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Nenhum funcionário cadastrado para esta empresa.
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

export default Employees;
