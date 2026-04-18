import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Company, Department, Employee, JobRole, PayrollEntry, PayrollMonth, Rubric } from "@/types/payroll";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PayrollContextType {
  companies: Company[];
  activeCompanies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  selectedMonth: PayrollMonth;
  setSelectedMonth: (month: PayrollMonth) => void;
  employees: Employee[];
  allEmployees: Employee[];
  departments: Department[];
  allDepartments: Department[];
  jobRoles: JobRole[];
  rubrics: Rubric[];
  allJobRoles: JobRole[];
  payrollEntries: PayrollEntry[];
  payrollCatalogErrors: { departments?: string; jobRoles?: string; payrollEntries?: string };
  isLoading: boolean;
  loadError: string | null;
  reloadData: () => Promise<void>;
  updatePayrollEntry: (id: string, updates: Partial<PayrollEntry>) => Promise<void>;
  addPayrollEntry: (entry: Omit<PayrollEntry, "id">) => Promise<void>;
  addCompany: (company: Omit<Company, "id">) => Promise<void>;
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
  setCompanyActive: (id: string, isActive: boolean) => Promise<void>;
  addEmployee: (employee: Omit<Employee, "id">) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addDepartment: (department: Omit<Department, "id">) => Promise<void>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<void>;
  setDepartmentActive: (id: string, isActive: boolean) => Promise<void>;
  addJobRole: (jobRole: Omit<JobRole, "id">) => Promise<void>;
  updateJobRole: (id: string, updates: Partial<JobRole>) => Promise<void>;
  setJobRoleActive: (id: string, isActive: boolean) => Promise<void>;
  addRubric: (rubric: Omit<Rubric, "id">) => Promise<void>;
  updateRubric: (id: string, updates: Partial<Rubric>) => Promise<void>;
  deleteRubric: (id: string) => Promise<void>;
}

const PayrollContext = createContext<PayrollContextType | null>(null);

const normalizeText = (value?: string) => {
  const normalized = value?.trim().replace(/\s+/g, " ") || "";
  return normalized || null;
};
const normalizeRequiredText = (value: string) => value.trim().replace(/\s+/g, " ");

// Comentário: CPF é identidade global do colaborador no grupo.
// Mantemos somente dígitos para alinhar validação/consulta e regra de unicidade global no banco.
const normalizeCpf = (value: string) => value.replace(/\D/g, "");

const mapCompanyRowToModel = (row: { id: string; name: string; cnpj: string; address: string | null; is_active: boolean }): Company => ({
  id: row.id,
  name: row.name,
  cnpj: row.cnpj,
  address: row.address || "",
  isActive: row.is_active,
});

// Comentário: máscara visual padrão BR para CNPJ usada na exibição.
export const formatCnpj = (digits: string) => {
  const d = (digits || "").replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return d;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
};

// Comentário: validação de dígitos verificadores do CNPJ (algoritmo oficial).
export const isValidCnpj = (value: string): boolean => {
  const cnpj = (value || "").replace(/\D/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (slice: string, weights: number[]) => {
    const sum = slice.split("").reduce((acc, n, i) => acc + Number(n) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), w1);
  const d2 = calc(cnpj.slice(0, 12) + d1, w2);
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
};

const isValidCpf = (value: string) => {
  const cpf = (value || "").replace(/\D/g, "");
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

const isValidCpfOrCnpj = (value: string) => {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
};

const mapDepartmentRowToModel = (row: { id: string; company_id: string; name: string; is_active: boolean }): Department => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  isActive: row.is_active,
});

const mapJobRoleRowToModel = (row: { id: string; company_id: string; name: string; is_active: boolean }): JobRole => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  isActive: row.is_active,
});

const mapEmployeeRowToModel = (row: {
  id: string;
  company_id: string;
  name: string;
  cpf: string;
  admission_date: string;
  registration: string | null;
  work_card_number: string | null;
  notes: string | null;
  department_id: string | null;
  department: string | null;
  job_role_id: string | null;
  role: string | null;
  is_monthly: boolean;
  is_on_leave: boolean;
  is_active: boolean;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account: string | null;
  bank_pix_key: string | null;
}): Employee => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  cpf: row.cpf,
  admissionDate: row.admission_date,
  registration: row.registration || "",
  workCardNumber: row.work_card_number || "",
  notes: row.notes || "",
  departmentId: row.department_id || "",
  department: row.department || "",
  jobRoleId: row.job_role_id || "",
  role: row.role || "",
  isMonthly: row.is_monthly,
  isOnLeave: row.is_on_leave,
  isActive: row.is_active,
  bankName: row.bank_name || "",
  bankBranch: row.bank_branch || "",
  bankAccount: row.bank_account || "",
  bankPixKey: row.bank_pix_key || "",
});

const mapEmployeeInsertToRow = (employee: Omit<Employee, "id">) => ({
  // Comentário: cadastro de funcionário armazena apenas dados cadastrais/operacionais.
  // Salário e demais valores mensais pertencem exclusivamente aos lançamentos da folha.
  company_id: employee.companyId,
  name: normalizeRequiredText(employee.name),
  cpf: normalizeCpf(employee.cpf),
  admission_date: employee.admissionDate,
  registration: normalizeText(employee.registration),
  work_card_number: normalizeText(employee.workCardNumber),
  notes: normalizeText(employee.notes),
  department_id: employee.departmentId || null,
  department: normalizeText(employee.department),
  job_role_id: employee.jobRoleId || null,
  role: normalizeText(employee.role),
  is_monthly: employee.isMonthly,
  is_on_leave: employee.isOnLeave,
  is_active: employee.isActive,
  bank_name: normalizeText(employee.bankName),
  bank_branch: normalizeText(employee.bankBranch),
  bank_account: normalizeText(employee.bankAccount),
  bank_pix_key: normalizeText(employee.bankPixKey),
});

const mapEmployeeUpdateToRow = (updates: Partial<Employee>) => ({
  ...(updates.companyId !== undefined ? { company_id: updates.companyId } : {}),
  ...(updates.name !== undefined ? { name: normalizeRequiredText(updates.name) } : {}),
  ...(updates.cpf !== undefined ? { cpf: normalizeCpf(updates.cpf) } : {}),
  ...(updates.admissionDate !== undefined ? { admission_date: updates.admissionDate } : {}),
  ...(updates.registration !== undefined ? { registration: normalizeText(updates.registration) } : {}),
  ...(updates.workCardNumber !== undefined ? { work_card_number: normalizeText(updates.workCardNumber) } : {}),
  ...(updates.notes !== undefined ? { notes: normalizeText(updates.notes) } : {}),
  ...(updates.departmentId !== undefined ? { department_id: updates.departmentId || null } : {}),
  ...(updates.department !== undefined ? { department: normalizeText(updates.department) } : {}),
  ...(updates.jobRoleId !== undefined ? { job_role_id: updates.jobRoleId || null } : {}),
  ...(updates.role !== undefined ? { role: normalizeText(updates.role) } : {}),
  ...(updates.isMonthly !== undefined ? { is_monthly: updates.isMonthly } : {}),
  ...(updates.isOnLeave !== undefined ? { is_on_leave: updates.isOnLeave } : {}),
  ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
  ...(updates.bankName !== undefined ? { bank_name: normalizeText(updates.bankName) } : {}),
  ...(updates.bankBranch !== undefined ? { bank_branch: normalizeText(updates.bankBranch) } : {}),
  ...(updates.bankAccount !== undefined ? { bank_account: normalizeText(updates.bankAccount) } : {}),
  ...(updates.bankPixKey !== undefined ? { bank_pix_key: normalizeText(updates.bankPixKey) } : {}),
});

const mapRubricRowToModel = (row: {
  id: string;
  name: string;
  code: string;
  category: string;
  type: string;
  entry_mode: string;
  display_order: number;
  is_active: boolean;
  allow_manual_override: boolean;
  rubrica_formula_items?: Array<{
    id: string;
    operation: string;
    source_rubrica_id: string;
    item_order: number;
  }>;
}): Rubric => ({
  id: row.id,
  name: row.name,
  code: row.code,
  category: row.category,
  type: row.type as Rubric["type"],
  mode: row.entry_mode as Rubric["mode"],
  order: row.display_order,
  isActive: row.is_active,
  // Comentário: a composição de fórmula agora é persistida em linhas estruturadas para evitar texto livre estilo Excel.
  formulaItems: (row.rubrica_formula_items || [])
    .map((item) => ({
      id: item.id,
      operation: item.operation as "add" | "subtract",
      sourceRubricId: item.source_rubrica_id,
      order: item.item_order,
    }))
    .sort((a, b) => a.order - b.order),
  allowManualOverride: row.allow_manual_override,
});

const mapRubricInsertToRow = (rubric: Omit<Rubric, "id">) => ({
  name: normalizeRequiredText(rubric.name),
  code: normalizeRequiredText(rubric.code),
  category: normalizeRequiredText(rubric.category),
  type: rubric.type,
  entry_mode: rubric.mode,
  display_order: rubric.order,
  is_active: rubric.isActive,
  allow_manual_override: rubric.allowManualOverride,
});

const mapRubricUpdateToRow = (updates: Partial<Rubric>) => ({
  ...(updates.name !== undefined ? { name: normalizeRequiredText(updates.name) } : {}),
  ...(updates.code !== undefined ? { code: normalizeRequiredText(updates.code) } : {}),
  ...(updates.category !== undefined ? { category: normalizeRequiredText(updates.category) } : {}),
  ...(updates.type !== undefined ? { type: updates.type } : {}),
  ...(updates.mode !== undefined ? { entry_mode: updates.mode } : {}),
  ...(updates.order !== undefined ? { display_order: updates.order } : {}),
  ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
  ...(updates.allowManualOverride !== undefined ? { allow_manual_override: updates.allowManualOverride } : {}),
});

const mapFormulaItemInsertToRow = (rubricaId: string, item: Rubric["formulaItems"][number]) => ({
  rubrica_id: rubricaId,
  operation: item.operation,
  source_rubrica_id: item.sourceRubricId,
  item_order: item.order,
});

const mapPayrollEntryRowToModel = (row: {
  id: string;
  employee_id: string;
  company_id: string;
  month: number;
  year: number;
  base_salary: number;
  earnings: Record<string, number> | null;
  deductions: Record<string, number> | null;
  notes: string | null;
}): PayrollEntry => ({
  id: row.id,
  employeeId: row.employee_id,
  companyId: row.company_id,
  month: row.month,
  year: row.year,
  baseSalary: Number(row.base_salary || 0),
  earnings: row.earnings || {},
  deductions: row.deductions || {},
  notes: row.notes || "",
});

const mapPayrollEntryInsertToRow = (entry: Omit<PayrollEntry, "id">) => ({
  employee_id: entry.employeeId,
  company_id: entry.companyId,
  month: entry.month,
  year: entry.year,
  base_salary: entry.baseSalary,
  earnings: entry.earnings,
  deductions: entry.deductions,
  notes: normalizeText(entry.notes),
});

// Comentário: a tabela de itens possui duas FKs para `rubricas`; usamos embed explícito para evitar ambiguidade no PostgREST.
const RUBRICA_SELECT_WITH_ITEMS =
  "id, name, code, category, type, entry_mode, display_order, is_active, allow_manual_override, rubrica_formula_items:rubrica_formula_items!rubrica_formula_items_rubrica_id_fkey(id, operation, source_rubrica_id, item_order)";

export const usePayroll = () => {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error("usePayroll must be used within PayrollProvider");
  return ctx;
};

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading: authLoading, hasPermission } = useAuth();
  const canViewStructure = hasPermission("estrutura.view");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allJobRoles, setAllJobRoles] = useState<JobRole[]>([]);
  const [allPayrollEntries, setAllPayrollEntries] = useState<PayrollEntry[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [payrollCatalogErrors, setPayrollCatalogErrors] = useState<{ departments?: string; jobRoles?: string; payrollEntries?: string }>({});
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth>({ month: 3, year: 2026 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const validateRubricPayload = useCallback((rubric: Omit<Rubric, "id"> | Partial<Rubric>) => {
    if (rubric.name !== undefined && !normalizeRequiredText(rubric.name)) throw new Error("Nome da rubrica é obrigatório.");
    if (rubric.code !== undefined && !normalizeRequiredText(rubric.code)) throw new Error("Código da rubrica é obrigatório.");
    if (rubric.category !== undefined && !normalizeRequiredText(rubric.category)) throw new Error("Categoria da rubrica é obrigatória.");
    if (rubric.order !== undefined && (!Number.isFinite(rubric.order) || rubric.order < 0)) throw new Error("Ordem deve ser numérica válida.");
    if (rubric.mode === "formula" && (!rubric.formulaItems || rubric.formulaItems.length === 0)) {
      throw new Error("Rubrica de fórmula precisa de ao menos um item.");
    }
  }, []);

  const validateCircularRubricDependency = useCallback(
    async (rubricId: string, mode: Rubric["mode"], formulaItems: Rubric["formulaItems"]) => {
      if (mode !== "formula") return;
      if (formulaItems.some((item) => item.sourceRubricId === rubricId)) {
        throw new Error("Rubrica não pode depender dela mesma.");
      }

      const { data, error } = await supabase
        .from("rubrica_formula_items")
        .select("rubrica_id, source_rubrica_id");
      if (error) throw error;

      const adjacency = new Map<string, string[]>();
      for (const row of data || []) {
        const deps = adjacency.get(row.rubrica_id) || [];
        deps.push(row.source_rubrica_id);
        adjacency.set(row.rubrica_id, deps);
      }
      adjacency.set(
        rubricId,
        formulaItems.map((item) => item.sourceRubricId)
      );

      // Comentário: validação no backend para bloquear circularidade indireta antes de persistir.
      const visiting = new Set<string>();
      const visited = new Set<string>();
      const walk = (node: string): boolean => {
        if (visiting.has(node)) return true;
        if (visited.has(node)) return false;
        visiting.add(node);
        const deps = adjacency.get(node) || [];
        for (const dep of deps) {
          if (dep === rubricId || walk(dep)) return true;
        }
        visiting.delete(node);
        visited.add(node);
        return false;
      };

      if (walk(rubricId)) {
        throw new Error("Referência circular detectada na fórmula.");
      }
    },
    []
  );

  const loadData = useCallback(async () => {
    if (authLoading) return;
    setIsLoading(true);
    setLoadError(null);

    // Comentário: carregamos catálogo de estrutura somente quando a permissão existe.
    // Isso evita requisição desnecessária de /departments e /job_roles para perfis sem acesso.
    const departmentsRequest = canViewStructure
      ? supabase.from("departments").select("id, company_id, name, is_active").order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null });
    const jobRolesRequest = canViewStructure
      ? supabase.from("job_roles").select("id, company_id, name, is_active").order("name", { ascending: true })
      : Promise.resolve({ data: [], error: null });

    // Comentário: mantemos os demais cadastros na mesma origem para preservar o padrão já existente no provider.
    const [companiesRes, employeesRes, departmentsRes, rolesRes, rubricsRes, payrollEntriesRes] = await Promise.all([
      supabase.from("companies").select("id, name, cnpj, address, is_active").order("name", { ascending: true }),
      supabase.from("employees").select("*").order("name", { ascending: true }),
      departmentsRequest,
      jobRolesRequest,
      supabase
        .from("rubricas")
        .select(RUBRICA_SELECT_WITH_ITEMS)
        .order("display_order", { ascending: true }),
      supabase
        .from("payroll_entries")
        .select("id, employee_id, company_id, month, year, base_salary, earnings, deductions, notes")
        .order("created_at", { ascending: false }),
    ]);
    const nextCatalogErrors: { departments?: string; jobRoles?: string; payrollEntries?: string } = {};

    if (!companiesRes.error && companiesRes.data) {
      const loadedCompanies = companiesRes.data.map(mapCompanyRowToModel);
      setCompanies(loadedCompanies);
      // Comentário: default selecionada deve ser uma empresa ATIVA (PRD-05 §5.4).
      setSelectedCompany((prev) => {
        if (prev && loadedCompanies.some((company) => company.id === prev.id && company.isActive)) return prev;
        return loadedCompanies.find((c) => c.isActive) ?? null;
      });
    } else if (companiesRes.error) {
      setLoadError(`Falha ao carregar empresas: ${companiesRes.error.message}`);
    }

    if (!employeesRes.error && employeesRes.data) {
      setAllEmployees(employeesRes.data.map(mapEmployeeRowToModel));
    }

    if (!departmentsRes.error && departmentsRes.data) {
      setAllDepartments(departmentsRes.data.map(mapDepartmentRowToModel));
    } else if (departmentsRes.error) {
      nextCatalogErrors.departments = `Falha ao carregar setores: ${departmentsRes.error.message}`;
    }

    if (!rolesRes.error && rolesRes.data) {
      setAllJobRoles(rolesRes.data.map(mapJobRoleRowToModel));
    } else if (rolesRes.error) {
      nextCatalogErrors.jobRoles = `Falha ao carregar funções/cargos: ${rolesRes.error.message}`;
    }

    if (!rubricsRes.error && rubricsRes.data) {
      setRubrics(rubricsRes.data.map(mapRubricRowToModel));
    }

    if (!payrollEntriesRes.error && payrollEntriesRes.data) {
      setAllPayrollEntries(payrollEntriesRes.data.map(mapPayrollEntryRowToModel));
    } else if (payrollEntriesRes.error) {
      nextCatalogErrors.payrollEntries = `Falha ao carregar lançamentos de folha: ${payrollEntriesRes.error.message}`;
    }

    setPayrollCatalogErrors(nextCatalogErrors);

    setIsLoading(false);
  }, [authLoading, canViewStructure]);

  useEffect(() => {
    if (authLoading) return;
    void loadData();
  }, [authLoading, loadData]);

  // Comentário: nesta fase, a listagem de /funcionarios usa companyId como empresa registrada.
  // A participação em folha por múltiplas empresas do grupo será modelada em camada própria futura.
  const employees = allEmployees.filter((employee) => employee.companyId === selectedCompany?.id);
  const departments = allDepartments.filter((department) => department.companyId === selectedCompany?.id);
  const jobRoles = allJobRoles.filter((jobRole) => jobRole.companyId === selectedCompany?.id);

  const payrollEntries = React.useMemo(() => {
    if (!selectedCompany) return [];
    return allPayrollEntries.filter(
      (entry) =>
        entry.companyId === selectedCompany.id &&
        entry.month === selectedMonth.month &&
        entry.year === selectedMonth.year
    );
  }, [allPayrollEntries, selectedCompany, selectedMonth]);

  const updatePayrollEntry = useCallback(
    async (id: string, updates: Partial<PayrollEntry>) => {
      const payload = {
        ...(updates.baseSalary !== undefined ? { base_salary: updates.baseSalary } : {}),
        ...(updates.earnings !== undefined ? { earnings: updates.earnings } : {}),
        ...(updates.deductions !== undefined ? { deductions: updates.deductions } : {}),
        ...(updates.notes !== undefined ? { notes: normalizeText(updates.notes) } : {}),
      };
      const { data, error } = await supabase
        .from("payroll_entries")
        .update(payload)
        .eq("id", id)
        .select("id, employee_id, company_id, month, year, base_salary, earnings, deductions, notes")
        .single();
      if (error || !data) throw error;

      const mapped = mapPayrollEntryRowToModel(data as any);
      setAllPayrollEntries((prev) => prev.map((entry) => (entry.id === id ? mapped : entry)));
    },
    []
  );

  const addPayrollEntry = useCallback(
    async (entry: Omit<PayrollEntry, "id">) => {
      const { data, error } = await supabase
        .from("payroll_entries")
        .insert(mapPayrollEntryInsertToRow(entry))
        .select("id, employee_id, company_id, month, year, base_salary, earnings, deductions, notes")
        .single();
      if (error || !data) throw error;

      setAllPayrollEntries((prev) => [mapPayrollEntryRowToModel(data as any), ...prev]);
    },
    []
  );


  const addCompany = useCallback(async (company: Omit<Company, "id">) => {
    // Comentário: o campo "cnpj" mantém compatibilidade histórica, mas agora aceita CPF ou CNPJ no cadastro.
    const cnpjDigits = (company.cnpj || "").replace(/\D/g, "");
    const address = (company.address || "").trim();
    if (!address) throw new Error("Endereço é obrigatório.");
    // Comentário: persistência continua normalizada (somente dígitos), sem pontuação de máscara.
    if (!isValidCpfOrCnpj(cnpjDigits)) throw new Error("CPF/CNPJ inválido.");

    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: normalizeRequiredText(company.name),
        cnpj: cnpjDigits,
        address,
        is_active: company.isActive ?? true,
      })
      .select("id, name, cnpj, address, is_active")
      .single();
    if (error || !data) {
      // Comentário: 23505 = unique_violation (CPF/CNPJ duplicado no campo legado cnpj).
      if ((error as { code?: string } | null)?.code === "23505") {
        throw new Error("CPF/CNPJ já cadastrado.");
      }
      throw error;
    }
    const mapped = mapCompanyRowToModel(data);
    setCompanies((prev) => [...prev, mapped]);
    setSelectedCompany((prev) => prev ?? (mapped.isActive ? mapped : prev));
  }, []);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = normalizeRequiredText(updates.name);
    if (updates.cnpj !== undefined) {
      const cnpjDigits = updates.cnpj.replace(/\D/g, "");
      if (!isValidCpfOrCnpj(cnpjDigits)) throw new Error("CPF/CNPJ inválido.");
      payload.cnpj = cnpjDigits;
    }
    if (updates.address !== undefined) {
      const address = updates.address.trim();
      if (!address) throw new Error("Endereço é obrigatório.");
      payload.address = address;
    }
    if (updates.isActive !== undefined) payload.is_active = updates.isActive;

    const { data, error } = await supabase
      .from("companies")
      .update(payload)
      .eq("id", id)
      .select("id, name, cnpj, address, is_active")
      .single();
    if (error || !data) {
      if ((error as { code?: string } | null)?.code === "23505") {
        throw new Error("CPF/CNPJ já cadastrado.");
      }
      throw error;
    }

    const mapped = mapCompanyRowToModel(data);
    setCompanies((prev) => prev.map((company) => (company.id === id ? mapped : company)));
    setSelectedCompany((prev) => (prev?.id === id ? mapped : prev));
  }, []);

  // Comentário: substitui a antiga deleteCompany — PRD-05 §5.5 proíbe exclusão física.
  const setCompanyActive = useCallback(async (id: string, isActive: boolean) => {
    const { data, error } = await supabase
      .from("companies")
      .update({ is_active: isActive })
      .eq("id", id)
      .select("id, name, cnpj, address, is_active")
      .single();
    if (error || !data) throw error;

    const mapped = mapCompanyRowToModel(data);
    setCompanies((prev) => prev.map((company) => (company.id === id ? mapped : company)));
    setSelectedCompany((selected) => {
      // Se a empresa selecionada foi inativada, troca para a próxima ativa.
      if (selected?.id === id && !isActive) {
        return null;
      }
      return selected?.id === id ? mapped : selected;
    });
  }, []);

  const addEmployee = useCallback(async (employee: Omit<Employee, "id">) => {
    const payload = mapEmployeeInsertToRow(employee);
    const { data, error } = await supabase.from("employees").insert(payload).select("*").single();
    if (error || !data) throw error;

    setAllEmployees((prev) => [...prev, mapEmployeeRowToModel(data)]);
  }, []);

  const updateEmployee = useCallback(async (id: string, updates: Partial<Employee>) => {
    const payload = mapEmployeeUpdateToRow(updates);
    const { data, error } = await supabase.from("employees").update(payload).eq("id", id).select("*").single();
    if (error || !data) throw error;

    setAllEmployees((prev) => prev.map((employee) => (employee.id === id ? mapEmployeeRowToModel(data) : employee)));
  }, []);

  const deleteEmployee = useCallback(async (id: string) => {
    // Comentário: funcionário não pode ser excluído fisicamente para preservar histórico.
    // A regra operacional é inativação (soft-disable) mantendo vínculos e trilha.
    const { data, error } = await supabase.from("employees").update({ is_active: false }).eq("id", id).select("*").single();
    if (error || !data) throw error;

    setAllEmployees((prev) => prev.map((employee) => (employee.id === id ? mapEmployeeRowToModel(data) : employee)));
  }, []);

  const addDepartment = useCallback(async (department: Omit<Department, "id">) => {
    const { data, error } = await supabase
      .from("departments")
      .insert({ company_id: department.companyId, name: normalizeRequiredText(department.name), is_active: department.isActive })
      .select("id, company_id, name, is_active")
      .single();
    if (error || !data) throw error;

    setAllDepartments((prev) => [...prev, mapDepartmentRowToModel(data)]);
  }, []);

  const updateDepartment = useCallback(async (id: string, updates: Partial<Department>) => {
    if (updates.companyId !== undefined) {
      const current = allDepartments.find((department) => department.id === id);
      const isCompanyChanging = !!current && current.companyId !== updates.companyId;
      if (isCompanyChanging) {
        // Comentário: evitamos inconsistência cross-company quando já existem funcionários vinculados ao setor.
        const { count, error: linksError } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("department_id", id);
        if (linksError) throw linksError;
        if ((count ?? 0) > 0) {
          throw new Error("Não é permitido alterar a empresa de um setor que possui funcionários vinculados.");
        }
      }
    }

    const payload = {
      ...(updates.companyId !== undefined ? { company_id: updates.companyId } : {}),
      ...(updates.name !== undefined ? { name: normalizeRequiredText(updates.name) } : {}),
      ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
    };

    const { data, error } = await supabase.from("departments").update(payload).eq("id", id).select("id, company_id, name, is_active").single();
    if (error || !data) throw error;

    setAllDepartments((prev) => prev.map((department) => (department.id === id ? mapDepartmentRowToModel(data) : department)));
  }, [allDepartments]);

  const setDepartmentActive = useCallback(async (id: string, isActive: boolean) => {
    // Comentário: PRD-06 exige inativação/reativação em vez de exclusão física.
    const { data, error } = await supabase
      .from("departments")
      .update({ is_active: isActive })
      .eq("id", id)
      .select("id, company_id, name, is_active")
      .single();
    if (error || !data) throw error;

    setAllDepartments((prev) => prev.map((department) => (department.id === id ? mapDepartmentRowToModel(data) : department)));
  }, []);

  const addJobRole = useCallback(async (jobRole: Omit<JobRole, "id">) => {
    const { data, error } = await supabase
      .from("job_roles")
      .insert({ company_id: jobRole.companyId, name: normalizeRequiredText(jobRole.name), is_active: jobRole.isActive })
      .select("id, company_id, name, is_active")
      .single();
    if (error || !data) throw error;

    setAllJobRoles((prev) => [...prev, mapJobRoleRowToModel(data)]);
  }, []);

  const updateJobRole = useCallback(async (id: string, updates: Partial<JobRole>) => {
    if (updates.companyId !== undefined) {
      const current = allJobRoles.find((jobRole) => jobRole.id === id);
      const isCompanyChanging = !!current && current.companyId !== updates.companyId;
      if (isCompanyChanging) {
        // Comentário: evitamos inconsistência cross-company quando já existem funcionários vinculados ao cargo.
        const { count, error: linksError } = await supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("job_role_id", id);
        if (linksError) throw linksError;
        if ((count ?? 0) > 0) {
          throw new Error("Não é permitido alterar a empresa de uma função/cargo que possui funcionários vinculados.");
        }
      }
    }

    const payload = {
      ...(updates.companyId !== undefined ? { company_id: updates.companyId } : {}),
      ...(updates.name !== undefined ? { name: normalizeRequiredText(updates.name) } : {}),
      ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
    };

    const { data, error } = await supabase.from("job_roles").update(payload).eq("id", id).select("id, company_id, name, is_active").single();
    if (error || !data) throw error;

    setAllJobRoles((prev) => prev.map((jobRole) => (jobRole.id === id ? mapJobRoleRowToModel(data) : jobRole)));
  }, [allJobRoles]);

  const setJobRoleActive = useCallback(async (id: string, isActive: boolean) => {
    // Comentário: PRD-06 exige inativação/reativação em vez de exclusão física.
    const { data, error } = await supabase
      .from("job_roles")
      .update({ is_active: isActive })
      .eq("id", id)
      .select("id, company_id, name, is_active")
      .single();
    if (error || !data) throw error;

    setAllJobRoles((prev) => prev.map((jobRole) => (jobRole.id === id ? mapJobRoleRowToModel(data) : jobRole)));
  }, []);

  const addRubric = useCallback(async (rubric: Omit<Rubric, "id">) => {
    validateRubricPayload(rubric);
    const { data, error } = await supabase
      .from("rubricas")
      .insert(mapRubricInsertToRow(rubric))
      .select("id, name, code, category, type, entry_mode, display_order, is_active, allow_manual_override")
      .single();
    if (error || !data) throw error;

    await validateCircularRubricDependency(data.id, rubric.mode, rubric.formulaItems);
    if (rubric.mode === "formula") {
      // Comentário: persistimos os itens da fórmula em tabela dedicada para garantir estrutura por linha e ordem.
      const { error: formulaError } = await supabase
        .from("rubrica_formula_items")
        .insert(rubric.formulaItems.map((item) => mapFormulaItemInsertToRow(data.id, item)));
      if (formulaError) {
        await supabase.from("rubricas").delete().eq("id", data.id);
        throw formulaError;
      }
    }

    const { data: fullRubric, error: fullRubricError } = await supabase
      .from("rubricas")
      .select(RUBRICA_SELECT_WITH_ITEMS)
      .eq("id", data.id)
      .single();
    if (fullRubricError || !fullRubric) throw fullRubricError;

    setRubrics((prev) => [...prev, mapRubricRowToModel(fullRubric)]);
  }, [validateCircularRubricDependency, validateRubricPayload]);

  const updateRubric = useCallback(async (id: string, updates: Partial<Rubric>) => {
    validateRubricPayload(updates);
    const modeToValidate = updates.mode ?? rubrics.find((rubric) => rubric.id === id)?.mode ?? "manual";
    const itemsToValidate = updates.formulaItems ?? rubrics.find((rubric) => rubric.id === id)?.formulaItems ?? [];
    await validateCircularRubricDependency(id, modeToValidate, itemsToValidate);

    const { data, error } = await supabase
      .from("rubricas")
      .update(mapRubricUpdateToRow(updates))
      .eq("id", id)
      .select("id, name, code, category, type, entry_mode, display_order, is_active, allow_manual_override")
      .single();
    if (error || !data) throw error;

    if (updates.formulaItems !== undefined || updates.mode === "manual") {
      const { error: deleteItemsError } = await supabase.from("rubrica_formula_items").delete().eq("rubrica_id", id);
      if (deleteItemsError) throw deleteItemsError;
    }
    if (modeToValidate === "formula" && itemsToValidate.length > 0) {
      const { error: insertItemsError } = await supabase
        .from("rubrica_formula_items")
        .insert(itemsToValidate.map((item) => mapFormulaItemInsertToRow(id, item)));
      if (insertItemsError) throw insertItemsError;
    }

    const { data: fullRubric, error: fullRubricError } = await supabase
      .from("rubricas")
      .select(RUBRICA_SELECT_WITH_ITEMS)
      .eq("id", id)
      .single();
    if (fullRubricError || !fullRubric) throw fullRubricError;

    setRubrics((prev) => prev.map((rubric) => (rubric.id === id ? mapRubricRowToModel(fullRubric) : rubric)));
  }, [rubrics, validateCircularRubricDependency, validateRubricPayload]);

  const deleteRubric = useCallback(async (id: string) => {
    const rubric = rubrics.find((item) => item.id === id);
    const nextStatus = !(rubric?.isActive ?? true);
    const { data, error } = await supabase
      .from("rubricas")
      .update({ is_active: nextStatus })
      .eq("id", id)
      .select(RUBRICA_SELECT_WITH_ITEMS)
      .single();
    if (error) throw error;

    setRubrics((prev) => prev.map((item) => (item.id === id ? mapRubricRowToModel(data) : item)));
  }, [rubrics]);

  // Comentário: empresas ativas para uso em filtros operacionais (Funcionários, Central de Folha) — PRD-05 §5.4.
  const activeCompanies = React.useMemo(() => companies.filter((c) => c.isActive), [companies]);

  return (
    <PayrollContext.Provider
      value={{
        companies,
        activeCompanies,
        selectedCompany,
        setSelectedCompany,
        selectedMonth,
        setSelectedMonth,
        employees,
        allEmployees,
        departments,
        allDepartments,
        jobRoles,
        allJobRoles,
        rubrics,
        payrollEntries,
        payrollCatalogErrors,
        isLoading,
        loadError,
        reloadData: loadData,
        addPayrollEntry,
        updatePayrollEntry,
        addCompany,
        updateCompany,
        setCompanyActive,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addDepartment,
        updateDepartment,
        setDepartmentActive,
        addJobRole,
        updateJobRole,
        setJobRoleActive,
        addRubric,
        updateRubric,
        deleteRubric,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};
