import React, { useEffect, useMemo, useRef, useState } from "react";
import EmployeeFilters, { EmployeeFilterState, getInitialFilters } from "@/components/employees/EmployeeFilters";
import { usePayroll } from "@/contexts/PayrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BriefcaseBusiness, Download, FileSpreadsheet, FileText, Landmark, NotebookPen, Pencil, Plus, Save, Trash2, Upload, User, Users, X } from "lucide-react";
import { Employee } from "@/types/payroll";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import * as XLSX from "xlsx";

type EmployeeTab = "dados-funcionario" | "dados-funcionais" | "dados-bancarios" | "observacoes";

type EmployeeFormState = Omit<Employee, "id">;

type EmployeeFormErrors = Partial<Record<"name" | "cpf" | "admissionDate" | "companyId" | "workerType" | "departmentId" | "jobRoleId" | "bankName" | "bankBranch" | "bankAccount", string>>;

const getInitialForm = (companyId = ""): EmployeeFormState => ({
  companyId,
  name: "",
  cpf: "",
  admissionDate: "",
  workerType: "contratado",
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
  bankPixKey: "",
});

// Comentário: CPF sempre é persistido sem máscara para manter consistência e facilitar validação futura no banco.
const sanitizeDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const maskCpf = (value?: string | null) => {
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
const formatCpf = (value?: string | null) => maskCpf(value ?? "");
const slugify = (value: string) => normalizeText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const parseWorkerType = (value: string): Employee["workerType"] | null => {
  const normalized = normalizeText(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return "contratado";
  if (normalized === "contratado") return "contratado";
  if (normalized === "diarista") return "diarista";
  if (normalized === "mensalista") return "mensalista";
  return null;
};

const toIsoDate = (value: unknown): string => {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = normalizeText(String(value || ""));
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const matchBr = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (matchBr) return `${matchBr[3]}-${matchBr[2]}-${matchBr[1]}`;
  const fromDate = new Date(text);
  if (Number.isNaN(fromDate.getTime())) return "";
  return `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
};

const Employees: React.FC = () => {
  const {
    companies,
    activeCompanies,
    allEmployees,
    allDepartments,
    allJobRoles,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    payrollCatalogErrors,
    isLoading,
  } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(getInitialForm());
  const [errors, setErrors] = useState<EmployeeFormErrors>({});
  const [activeTab, setActiveTab] = useState<EmployeeTab>("dados-funcionario");
  const [filters, setFilters] = useState<EmployeeFilterState>(getInitialFilters());
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // Comentário: /funcionarios passa a operar como cadastro global.
  // A empresa ativa da folha não restringe mais a listagem por padrão.
  const selectedFilterCompany = useMemo(
    () => companies.find((company) => company.id === filters.companyId) || null,
    [companies, filters.companyId]
  );
  // Filtro local da tela de funcionários; não altera a empresa ativa da folha.
  const hasCompanyFilter = Boolean(filters.companyId);
  const departments = useMemo(
    () => (hasCompanyFilter ? allDepartments.filter((d) => d.companyId === filters.companyId) : []),
    [allDepartments, filters.companyId, hasCompanyFilter]
  );
  const jobRoles = useMemo(
    () => (hasCompanyFilter ? allJobRoles.filter((r) => r.companyId === filters.companyId) : []),
    [allJobRoles, filters.companyId, hasCompanyFilter]
  );

  const filteredEmployees = useMemo(() => {
    return allEmployees.filter((emp) => {
      if (filters.companyId && emp.companyId !== filters.companyId) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const cpfDigits = sanitizeDigits(filters.search);
        const matchName = emp.name.toLowerCase().includes(q);
        const matchCpf = cpfDigits.length > 0 && (emp.cpf ?? "").includes(cpfDigits);
        if (!matchName && !matchCpf) return false;
      }
      if (filters.status === "active" && !emp.isActive) return false;
      if (filters.status === "active" && emp.isOnLeave) return false;
      if (filters.status === "on_leave" && !emp.isOnLeave) return false;
      if (filters.status === "inactive" && emp.isActive) return false;
      if (filters.status === "monthly" && emp.workerType !== "mensalista") return false;
      if (filters.departmentId && emp.departmentId !== filters.departmentId) return false;
      if (filters.jobRoleId && emp.jobRoleId !== filters.jobRoleId) return false;
      return true;
    });
  }, [allEmployees, filters]);

  const { page, pageSize, total, paginatedItems: pagedEmployees, setPage, setPageSize, resetToFirstPage } =
    usePagination(filteredEmployees);

  useEffect(() => {
    resetToFirstPage();
  }, [filters, resetToFirstPage]);

  // Comentário: na transição gradual, filtros usam a empresa registrada do formulário (companyId),
  // garantindo catálogo correto por empresa mesmo que a empresa selecionada na listagem seja outra.
  const { availableDepartments, availableJobRoles } = useMemo(() => {
    const companyId = form.companyId;
    return {
      // Comentário: para cadastro/edição, exibimos todo o catálogo da empresa (ativos e inativos)
      // para evitar dropdown vazio em bases legadas e manter vínculo atual editável.
      availableDepartments: allDepartments.filter((department) => department.companyId === companyId),
      availableJobRoles: allJobRoles.filter((jobRole) => jobRole.companyId === companyId),
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
  const functionalCatalogError = payrollCatalogErrors.departments || payrollCatalogErrors.jobRoles;

  const openNew = () => {
    setEditing(null);
    setErrors({});
    setActiveTab("dados-funcionario");
    setForm(getInitialForm(filters.companyId || ""));
    setOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setErrors({});
    setActiveTab("dados-funcionario");
    setForm({ ...employee, cpf: maskCpf(employee.cpf) });
    setOpen(true);
  };

  useEffect(() => {
    // Comentário: em listagem global, novo cadastro herda a empresa do filtro manual quando houver.
    // Em "Todas as empresas", mantém vazio para o usuário escolher explicitamente a empresa registrante.
    if (!open || editing) return;
    if (form.companyId || !filters.companyId) return;
    setForm((prev) => ({ ...prev, companyId: filters.companyId }));
  }, [open, editing, form.companyId, filters.companyId]);

  useEffect(() => {
    if (!open || !functionalCatalogError) return;
    toast.error(functionalCatalogError);
  }, [open, functionalCatalogError]);

  const validateForm = (draft: EmployeeFormState) => {
    const nextErrors: EmployeeFormErrors = {};

    if (!normalizeText(draft.name)) nextErrors.name = "Informe o nome completo.";
    if (!draft.companyId) nextErrors.companyId = "Selecione a empresa registrada.";

    if (sanitizeDigits(draft.cpf).length > 0 && !isValidCpf(draft.cpf)) {
      nextErrors.cpf = "CPF inválido. Verifique os 11 dígitos.";
    }

    if (draft.departmentId) {
      const validDepartment = allDepartments.some((department) => department.id === draft.departmentId && department.companyId === draft.companyId);
      if (!validDepartment) {
        nextErrors.departmentId = "Selecione um setor válido da empresa registrada.";
      }
    }

    if (draft.jobRoleId) {
      const validJobRole = allJobRoles.some((jobRole) => jobRole.id === draft.jobRoleId && jobRole.companyId === draft.companyId);
      if (!validJobRole) {
        nextErrors.jobRoleId = "Selecione uma função/cargo válida da empresa registrada.";
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
      companyId: form.companyId || filters.companyId || "",
      name: normalizedName,
      cpf: sanitizeDigits(form.cpf),
      admissionDate: form.admissionDate || "",
      workerType: form.workerType,
      registration: normalizedRegistration,
      departmentId: form.departmentId || "",
      department: normalizedDepartment,
      jobRoleId: form.jobRoleId || "",
      role: normalizedRole,
      notes: normalizedNotes,
      bankName: normalizeBankField(form.bankName),
      bankBranch: normalizeBankField(form.bankBranch),
      bankAccount: normalizeBankField(form.bankAccount),
      bankPixKey: normalizeText(form.bankPixKey),
    };
  };

  const handleSave = async () => {
    if (!form.companyId && !filters.companyId) {
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
      toast.success("Funcionário inativado.");
    } catch {
      toast.error("Não foi possível inativar o funcionário.");
    }
  };

  // Comentário: exporta os dados já filtrados/listados na tela para manter aderência ao contexto visível do usuário.
  const handleExport = (type: "xlsx" | "pdf") => {
    if (type === "pdf") {
      toast.info("Exportação PDF ainda não implementada para Funcionários.");
      return;
    }
    const rows = filteredEmployees.map((employee) => {
      const company = companies.find((item) => item.id === employee.companyId);
      const department = allDepartments.find((item) => item.id === employee.departmentId);
      const jobRole = allJobRoles.find((item) => item.id === employee.jobRoleId);
      return {
        "Nome": employee.name,
        "CPF": formatCpf(employee.cpf),
        "Empresa Registrada": company?.name || "",
        "Setor": department?.name || employee.department || "",
        "Função/Cargo": jobRole?.name || employee.role || "",
        "Modalidade": getWorkerTypeLabel(employee.workerType),
        "Data de Admissão": formatAdmissionDate(employee.admissionDate),
        "Status": employee.isOnLeave ? "Afastado" : employee.isActive ? "Ativo" : "Inativo",
      };
    });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Funcionarios");
    // Comentário: nome do arquivo acompanha o contexto visível da tela (global ou empresa filtrada).
    const scopeLabel = selectedFilterCompany ? slugify(selectedFilterCompany.name) || "empresa" : "todas-empresas";
    XLSX.writeFile(workbook, `funcionarios-${scopeLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Exportação Excel concluída.");
  };

  // Comentário: aceitamos somente planilhas nesta fase para reforçar o padrão de importação por modelo.
  const isSpreadsheetFile = (file: File) => {
    const acceptedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const lowerFileName = file.name.toLowerCase();
    return acceptedMimeTypes.includes(file.type) || lowerFileName.endsWith(".xlsx") || lowerFileName.endsWith(".xls");
  };

  // Comentário: validação local para deixar o modal pronto para backend, sem acoplar com upload real agora.
  const handleImportFileSelection = (file?: File) => {
    if (!file) return;
    if (!isSpreadsheetFile(file)) {
      toast.error("Formato inválido. Selecione um arquivo Excel (.xlsx ou .xls).");
      return;
    }
    setSelectedImportFile(file);
    setImportSummary([]);
  };

  const resetImportModal = () => {
    setSelectedImportFile(null);
    setImportSummary([]);
    setImportModalOpen(false);
  };

  const handleDownloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const employeesTemplate = XLSX.utils.aoa_to_sheet([
      ["Nome", "CPF", "Empresa ID", "Empresa", "Setor ID", "Setor", "Função ID", "Função/Cargo", "Modalidade", "Data de Admissão", "Status"],
    ]);
    const instructionsSheet = XLSX.utils.aoa_to_sheet([
      ["Instruções de preenchimento"],
      ["Preencha somente a aba Funcionarios."],
      ["Use preferencialmente os IDs das abas auxiliares (Empresa ID, Setor ID, Função ID)."],
      ["Não altere os nomes das colunas da aba Funcionarios."],
      ["Modalidade é opcional: use Contratado, Diarista ou Mensalista. Em branco será tratado como Contratado."],
      ["Data de Admissão é obrigatória apenas para modalidade Contratado."],
      ["Empresas, setores e funções/cargos devem existir previamente no sistema."],
      ["A importação não cria empresas, setores ou funções/cargos automaticamente."],
      ["CPF repetido é permitido quando representar outro vínculo funcional."],
      ["Registros idênticos (CPF + empresa + setor + função + modalidade + admissão) podem ser bloqueados por duplicidade."],
    ]);
    const companiesSheet = XLSX.utils.json_to_sheet(companies.map((company) => ({ "ID": company.id, "Nome/Razão social": company.name, "CNPJ": company.cnpj })));
    const departmentsSheet = XLSX.utils.json_to_sheet(allDepartments.map((department) => {
      const company = companies.find((item) => item.id === department.companyId);
      return { "ID": department.id, "Setor": department.name, "Empresa ID": department.companyId, "Empresa": company?.name || "" };
    }));
    const jobRolesSheet = XLSX.utils.json_to_sheet(allJobRoles.map((jobRole) => {
      const company = companies.find((item) => item.id === jobRole.companyId);
      return { "ID": jobRole.id, "Função/Cargo": jobRole.name, "Empresa ID": jobRole.companyId, "Empresa": company?.name || "" };
    }));
    XLSX.utils.book_append_sheet(workbook, employeesTemplate, "Funcionarios");
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instrucoes");
    XLSX.utils.book_append_sheet(workbook, companiesSheet, "Empresas");
    XLSX.utils.book_append_sheet(workbook, departmentsSheet, "Setores");
    XLSX.utils.book_append_sheet(workbook, jobRolesSheet, "Funcoes");
    XLSX.writeFile(workbook, "modelo-importacao-funcionarios.xlsx");
    toast.success("Modelo Excel gerado.");
  };

  const handleImportSubmit = async () => {
    if (isImporting) return;
    if (!selectedImportFile) {
      toast.error("Selecione um arquivo para importar.");
      return;
    }
    setIsImporting(true);
    try {
      const normalizeLookup = (value: string) => normalizeText(value).toLowerCase();
      const buffer = await selectedImportFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets["Funcionarios"] || workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        toast.error("Planilha sem aba de funcionários.");
        return;
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      let imported = 0;
      let ignored = 0;
      const errorsList: string[] = [];
      const warningsList: string[] = [];
      const seenImportKeys = new Set<string>();

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const line = index + 2;
        const name = normalizeText(String(row["Nome"] || ""));
        const cpf = sanitizeDigits(String(row["CPF"] || ""));
        const companyIdRaw = normalizeText(String(row["Empresa ID"] || ""));
        const companyNameRaw = normalizeText(String(row["Empresa"] || ""));
        const departmentIdRaw = normalizeText(String(row["Setor ID"] || ""));
        const departmentNameRaw = normalizeText(String(row["Setor"] || ""));
        const jobRoleIdRaw = normalizeText(String(row["Função ID"] || ""));
        const jobRoleNameRaw = normalizeText(String(row["Função/Cargo"] || ""));
        const workerType = parseWorkerType(String(row["Modalidade"] || ""));
        const admissionRaw = normalizeText(String(row["Data de Admissão"] || ""));
        const admissionDate = toIsoDate(row["Data de Admissão"]);
        const statusRaw = normalizeText(String(row["Status"] || "Ativo")).toLowerCase();
        if (!name && !cpf && !companyIdRaw && !companyNameRaw) { ignored += 1; continue; }
        if (!name) { errorsList.push(`Linha ${line}: nome obrigatório.`); continue; }
        if (!isValidCpf(cpf)) { errorsList.push(`Linha ${line}: CPF inválido.`); continue; }
        if (!workerType) { errorsList.push(`Linha ${line}: modalidade inválida. Use Contratado, Diarista ou Mensalista.`); continue; }

        // Comentário: vínculo por ID é prioridade; por nome usamos comparação normalizada (trim + espaços + minúsculas), sem aproximação.
        const company = companyIdRaw
          ? companies.find((item) => item.id === companyIdRaw)
          : companies.find((item) => normalizeLookup(item.name) === normalizeLookup(companyNameRaw));
        if (!company) { errorsList.push(`Linha ${line}: empresa não encontrada.`); continue; }
        const department = departmentIdRaw
          ? allDepartments.find((item) => item.id === departmentIdRaw && item.companyId === company.id)
          : allDepartments.find((item) => normalizeLookup(item.name) === normalizeLookup(departmentNameRaw) && item.companyId === company.id);
        if (!department) { errorsList.push(`Linha ${line}: setor não encontrado para a empresa informada.`); continue; }
        const jobRole = jobRoleIdRaw
          ? allJobRoles.find((item) => item.id === jobRoleIdRaw && item.companyId === company.id)
          : allJobRoles.find((item) => normalizeLookup(item.name) === normalizeLookup(jobRoleNameRaw) && item.companyId === company.id);
        if (!jobRole) { errorsList.push(`Linha ${line}: função/cargo não encontrada para a empresa informada.`); continue; }
        if (workerType === "contratado" && !admissionDate) { errorsList.push(`Linha ${line}: data de admissão obrigatória para contratado.`); continue; }
        if (workerType !== "contratado" && admissionRaw && !admissionDate) { errorsList.push(`Linha ${line}: data de admissão inválida.`); continue; }
        if (!["ativo", "inativo", "afastado"].includes(statusRaw)) { errorsList.push(`Linha ${line}: status inválido.`); continue; }

        // Comentário: bloqueamos somente duplicidade idêntica (CPF+empresa+setor+função+modalidade+admissão), não CPF repetido isolado.
        const fullKey = `${cpf}|${company.id}|${department.id}|${jobRole.id}|${workerType}|${admissionDate}`;
        if (seenImportKeys.has(fullKey)) {
          errorsList.push(`Linha ${line}: registro duplicado dentro da própria planilha com mesmo CPF, empresa, setor, função, modalidade e data de admissão.`);
          continue;
        }
        seenImportKeys.add(fullKey);

        const duplicateExact = allEmployees.some((item) =>
          item.cpf === cpf
          && item.companyId === company.id
          && item.departmentId === department.id
          && item.jobRoleId === jobRole.id
          && item.workerType === workerType
          && item.admissionDate === admissionDate
        );
        if (duplicateExact) {
          errorsList.push(`Linha ${line}: possível duplicidade idêntica já cadastrada para CPF, empresa, setor, função, modalidade e admissão.`);
          continue;
        }

        const cpfInOtherBond = allEmployees.some((item) => item.cpf === cpf);
        if (cpfInOtherBond) {
          warningsList.push(`Linha ${line}: CPF já existe em outro vínculo. Registro importado como novo vínculo funcional.`);
        }

        const statusMap = statusRaw === "afastado" ? { isOnLeave: true, isActive: true } : statusRaw === "inativo" ? { isOnLeave: false, isActive: false } : { isOnLeave: false, isActive: true };
        await addEmployee({ companyId: company.id, name, cpf, admissionDate, workerType, registration: "", workCardNumber: "", notes: "", departmentId: department.id, department: department.name, jobRoleId: jobRole.id, role: jobRole.name, isMonthly: workerType === "mensalista", isOnLeave: statusMap.isOnLeave, isActive: statusMap.isActive, bankName: "", bankBranch: "", bankAccount: "", bankPixKey: "" });
        imported += 1;
      }

      const summary = [
        `Total de linhas lidas: ${rows.length}.`,
        `Total importado: ${imported}.`,
        `Total ignorado: ${ignored}.`,
        `Total com erro: ${errorsList.length}.`,
        `Total com aviso: ${warningsList.length}.`,
        ...errorsList.slice(0, 20).map((item) => `Erro: ${item}`),
        ...warningsList.slice(0, 20).map((item) => `Aviso: ${item}`),
      ];
      setImportSummary(summary);
      toast.success(`Importação finalizada. ${imported} funcionário(s) importado(s).`);
    } finally {
      setIsImporting(false);
    }
  };

  const getWorkerTypeLabel = (value: Employee["workerType"]) => value === "diarista" ? "Diarista" : value === "mensalista" ? "Mensalista" : "Contratado";
  const formatAdmissionDate = (value?: string) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR") : "Não informado";

  const fieldClass = (field: keyof EmployeeFormErrors) => cn(errors[field] && "border-destructive focus-visible:ring-destructive/40");

  const kpis = useMemo(() => {
    const total = filteredEmployees.length;
    const active = filteredEmployees.filter((e) => e.isActive && !e.isOnLeave).length;
    const onLeave = filteredEmployees.filter((e) => e.isOnLeave).length;
    const monthly = filteredEmployees.filter((e) => e.workerType === "mensalista").length;
    return { total, active, onLeave, monthly };
  }, [filteredEmployees]);

  return (
    <div>
      {/* Comentário: cabeçalho reposicionado para seguir o padrão visual da tela de Setores. */}
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Funcionários</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedFilterCompany
              ? `${selectedFilterCompany.name} — ${filteredEmployees.length} funcionários`
              : `Todas as empresas — ${filteredEmployees.length} funcionários`}
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
                <DialogTitle className="text-xl">Importar funcionários</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Faça upload da planilha no modelo padrão para cadastrar novos vínculos de funcionários em lote.
                </p>
              </DialogHeader>

              <div className="space-y-4">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={handleDownloadTemplate}>
                  <Download className="mr-1 h-4 w-4" /> Baixar modelo Excel
                </Button>

                <label
                  htmlFor="employee-import-file"
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

                <Input
                  id="employee-import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  ref={importInputRef}
                  onChange={(event) => handleImportFileSelection(event.target.files?.[0])}
                />

                <Button type="button" variant="outline" onClick={() => importInputRef.current?.click()} disabled={isImporting}>
                  Selecionar arquivo
                </Button>

                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Formato suportado: Excel (.xlsx, .xls).</p>
                  <p>{selectedImportFile ? `Arquivo selecionado: ${selectedImportFile.name}` : "Nenhum arquivo selecionado."}</p>
                </div>
                {importSummary.length > 0 && (
                  <div className="max-h-40 overflow-auto rounded border bg-muted/20 p-3 text-xs">
                    {importSummary.map((item) => <p key={item}>{item}</p>)}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={resetImportModal} disabled={isImporting}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
                <Button onClick={handleImportSubmit} disabled={isImporting}>
                  <Upload className="mr-1 h-4 w-4" /> {isImporting ? "Importando..." : "Importar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
                      <Label>CPF</Label>
                      <Input
                        className={fieldClass("cpf")}
                        inputMode="numeric"
                        maxLength={14}
                        placeholder="000.000.000-00"
                        value={form.cpf}
                        onChange={(event) => setForm((prev) => ({ ...prev, cpf: maskCpf(event.target.value) }))}
                      />
                      {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
                      <p className="text-xs text-muted-foreground">Pode ser preenchido posteriormente.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de admissão</Label>
                      <Input
                        className={fieldClass("admissionDate")}
                        type="date"
                        value={form.admissionDate}
                        onChange={(event) => setForm((prev) => ({ ...prev, admissionDate: event.target.value }))}
                      />
                      {errors.admissionDate && <p className="text-xs text-destructive">{errors.admissionDate}</p>}
                      <p className="text-xs text-muted-foreground">Pode ser preenchido posteriormente.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Modalidade operacional *</Label>
                      <Select
                        value={form.workerType}
                        onValueChange={(value) => setForm((prev) => ({ ...prev, workerType: value as Employee["workerType"] }))}
                      >
                        <SelectTrigger className={fieldClass("workerType")}>
                          <SelectValue placeholder="Selecione a modalidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contratado">Contratado</SelectItem>
                          <SelectItem value="diarista">Diarista</SelectItem>
                          <SelectItem value="mensalista">Mensalista</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">A modalidade é apenas cadastral e não cria valores automáticos de folha.</p>
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
                          {/* PRD-05 §5.4: novos vínculos só com empresas ativas. */}
                          {activeCompanies.map((company) => (
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
                      {!form.companyId && (
                        <p className="text-xs text-muted-foreground">Selecione a empresa registrada para carregar setores.</p>
                      )}
                      {payrollCatalogErrors.departments && (
                        <p className="text-xs text-destructive">{payrollCatalogErrors.departments}</p>
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
                      {!form.companyId && (
                        <p className="text-xs text-muted-foreground">Selecione a empresa registrada para carregar funções/cargos.</p>
                      )}
                      {payrollCatalogErrors.jobRoles && (
                        <p className="text-xs text-destructive">{payrollCatalogErrors.jobRoles}</p>
                      )}
                      {errors.jobRoleId && <p className="text-xs text-destructive">{errors.jobRoleId}</p>}
                    </div>
                  </div>
                  {/* Comentário: salário não pertence ao cadastro de funcionário; remuneração é tratada apenas na Central de Folha. */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="flex min-h-14 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                      <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))} />
                      Ativo
                    </label>
                    <label className="flex min-h-14 items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
                      <Checkbox checked={form.isOnLeave} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isOnLeave: checked === true }))} />
                      Afastado
                    </label>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="dados-bancarios" className="mt-3 min-h-0 flex-1 overflow-y-auto pr-2">
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <h3 className="text-sm font-semibold">Dados bancários</h3>
                  <p className="text-xs text-muted-foreground">Preencha banco, agência e conta juntos para evitar dados incompletos.</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
                    <div className="space-y-1.5">
                      <Label>Chave Pix</Label>
                      <Input
                        placeholder="CPF, e-mail, telefone ou chave aleatória"
                        value={form.bankPixKey || ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, bankPixKey: event.target.value }))}
                      />
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
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold tabular-nums">{kpis.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <User className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-xl font-bold tabular-nums">{kpis.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/10">
            <Users className="h-4 w-4 text-warning" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Afastados</p>
            <p className="text-xl font-bold tabular-nums">{kpis.onLeave}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Mensalistas</p>
            <p className="text-xl font-bold tabular-nums">{kpis.monthly}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <EmployeeFilters
          filters={filters}
          onFiltersChange={setFilters}
          companies={activeCompanies}
          departments={departments.filter((d) => d.isActive)}
          jobRoles={jobRoles.filter((r) => r.isActive)}
          disableFunctionalFilters={!hasCompanyFilter}
        />
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando funcionários...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Nome</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">CPF</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Setor</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Função</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Empresa registrada</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Modalidade</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Admissão</th>
                <th className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground leading-tight whitespace-nowrap">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {pagedEmployees.map((employee) => (
                <tr key={employee.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2 leading-tight whitespace-nowrap font-medium">{employee.name}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground">{maskCpf(employee.cpf ?? "")}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground">{employee.department || "-"}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground">{employee.role || "-"}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground">{companies.find((company) => company.id === employee.companyId)?.name || "-"}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground">{getWorkerTypeLabel(employee.workerType)}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-muted-foreground">{formatAdmissionDate(employee.admissionDate)}</td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap text-center">
                    <Badge
                      variant={employee.isOnLeave ? "secondary" : employee.isActive ? "default" : "secondary"}
                      className={employee.isOnLeave ? "bg-warning/20 text-warning-foreground" : employee.isActive ? "bg-success text-success-foreground" : ""}
                    >
                      {employee.isOnLeave ? "Afastado" : employee.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 leading-tight whitespace-nowrap">
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
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    {allEmployees.length === 0
                      ? "Nenhum funcionário cadastrado."
                      : hasCompanyFilter && !filters.search && !filters.status && !filters.departmentId && !filters.jobRoleId
                        ? "Nenhum funcionário encontrado para esta empresa."
                        : "Nenhum funcionário encontrado com os filtros aplicados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filteredEmployees.length > 0 && (
            <TablePagination
              total={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              itemLabel="funcionários"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Employees;
