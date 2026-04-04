import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Company, Department, Employee, JobRole, PayrollEntry, PayrollMonth, Rubric } from "@/types/payroll";
import { generatePayrollEntries } from "@/data/mock";
import { supabase } from "@/integrations/supabase/client";

interface PayrollContextType {
  companies: Company[];
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
  isLoading: boolean;
  updatePayrollEntry: (id: string, updates: Partial<PayrollEntry>) => void;
  addCompany: (company: Omit<Company, "id">) => Promise<void>;
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  addEmployee: (employee: Omit<Employee, "id">) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  addDepartment: (department: Omit<Department, "id">) => Promise<void>;
  updateDepartment: (id: string, updates: Partial<Department>) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  addJobRole: (jobRole: Omit<JobRole, "id">) => Promise<void>;
  updateJobRole: (id: string, updates: Partial<JobRole>) => Promise<void>;
  deleteJobRole: (id: string) => Promise<void>;
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

// Comentário: defesa adicional no contexto para manter CPF limpo mesmo se houver outro ponto de escrita no futuro.
const normalizeCpf = (value: string) => value.replace(/\D/g, "");

const mapCompanyRowToModel = (row: { id: string; name: string; cnpj: string; address: string | null }): Company => ({
  id: row.id,
  name: row.name,
  cnpj: row.cnpj,
  address: row.address || "",
});

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
  base_salary: number;
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
  baseSalary: Number(row.base_salary || 0),
});

const mapEmployeeInsertToRow = (employee: Omit<Employee, "id">) => ({
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
  base_salary: employee.baseSalary,
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
  ...(updates.baseSalary !== undefined ? { base_salary: updates.baseSalary } : {}),
});

const mapRubricRowToModel = (row: {
  id: string;
  name: string;
  code: string;
  rubric_category: string;
  rubric_type: "earning" | "deduction";
  mode: "manual" | "formula";
  order_index: number;
  is_active: boolean;
  formula_items: unknown;
  allow_manual_override: boolean;
}): Rubric => ({
  id: row.id,
  name: row.name,
  code: row.code,
  category: row.rubric_category,
  type: row.rubric_type,
  mode: row.mode,
  order: row.order_index,
  isActive: row.is_active,
  // Comentário: fórmula permanece estruturada em JSON para evitar entrada de texto livre e preservar ordem operacional.
  formulaItems: Array.isArray(row.formula_items) ? (row.formula_items as Rubric["formulaItems"]) : [],
  allowManualOverride: row.allow_manual_override,
});

const mapRubricInsertToRow = (rubric: Omit<Rubric, "id">) => ({
  name: normalizeRequiredText(rubric.name),
  code: normalizeRequiredText(rubric.code),
  rubric_category: normalizeRequiredText(rubric.category),
  rubric_type: rubric.type,
  mode: rubric.mode,
  order_index: rubric.order,
  is_active: rubric.isActive,
  formula_items: rubric.formulaItems,
  allow_manual_override: rubric.allowManualOverride,
});

const mapRubricUpdateToRow = (updates: Partial<Rubric>) => ({
  ...(updates.name !== undefined ? { name: normalizeRequiredText(updates.name) } : {}),
  ...(updates.code !== undefined ? { code: normalizeRequiredText(updates.code) } : {}),
  ...(updates.category !== undefined ? { rubric_category: normalizeRequiredText(updates.category) } : {}),
  ...(updates.type !== undefined ? { rubric_type: updates.type } : {}),
  ...(updates.mode !== undefined ? { mode: updates.mode } : {}),
  ...(updates.order !== undefined ? { order_index: updates.order } : {}),
  ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
  ...(updates.formulaItems !== undefined ? { formula_items: updates.formulaItems } : {}),
  ...(updates.allowManualOverride !== undefined ? { allow_manual_override: updates.allowManualOverride } : {}),
});

export const usePayroll = () => {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error("usePayroll must be used within PayrollProvider");
  return ctx;
};

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allJobRoles, setAllJobRoles] = useState<JobRole[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth>({ month: 3, year: 2026 });
  const [entriesCache, setEntriesCache] = useState<Record<string, PayrollEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    // Comentário: carregamos cadastros administrativos da mesma origem para manter o padrão piloto consistente e reaproveitável.
    const [companiesRes, employeesRes, departmentsRes, rolesRes, rubricsRes] = await Promise.all([
      supabase.from("companies").select("id, name, cnpj, address").order("name", { ascending: true }),
      supabase.from("employees").select("*").order("name", { ascending: true }),
      supabase.from("departments").select("id, company_id, name, is_active").order("name", { ascending: true }),
      supabase.from("job_roles").select("id, company_id, name, is_active").order("name", { ascending: true }),
      supabase
        .from("rubrics")
        .select("id, name, code, rubric_category, rubric_type, mode, order_index, is_active, formula_items, allow_manual_override")
        .order("order_index", { ascending: true }),
    ]);

    if (!companiesRes.error && companiesRes.data) {
      const loadedCompanies = companiesRes.data.map(mapCompanyRowToModel);
      setCompanies(loadedCompanies);
      setSelectedCompany((prev) => {
        if (prev && loadedCompanies.some((company) => company.id === prev.id)) return prev;
        return loadedCompanies[0] ?? null;
      });
    }

    if (!employeesRes.error && employeesRes.data) {
      setAllEmployees(employeesRes.data.map(mapEmployeeRowToModel));
    }

    if (!departmentsRes.error && departmentsRes.data) {
      setAllDepartments(departmentsRes.data.map(mapDepartmentRowToModel));
    }

    if (!rolesRes.error && rolesRes.data) {
      setAllJobRoles(rolesRes.data.map(mapJobRoleRowToModel));
    }

    if (!rubricsRes.error && rubricsRes.data) {
      setRubrics(rubricsRes.data.map(mapRubricRowToModel));
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const cacheKey = `${selectedCompany?.id}-${selectedMonth.month}-${selectedMonth.year}`;
  // Comentário: nesta fase, a listagem de /funcionarios usa companyId como empresa registrada.
  // A participação em folha por múltiplas empresas do grupo será modelada em camada própria futura.
  const employees = allEmployees.filter((employee) => employee.companyId === selectedCompany?.id);
  const departments = allDepartments.filter((department) => department.companyId === selectedCompany?.id);
  const jobRoles = allJobRoles.filter((jobRole) => jobRole.companyId === selectedCompany?.id);

  const payrollEntries = React.useMemo(() => {
    if (!selectedCompany) return [];
    if (entriesCache[cacheKey]) return entriesCache[cacheKey];

    // Comentário: folha continua em memória; apenas substituímos a origem dos funcionários para dados persistidos.
    const entries = generatePayrollEntries(allEmployees, selectedCompany.id, selectedMonth.month, selectedMonth.year);
    setEntriesCache((prev) => ({ ...prev, [cacheKey]: entries }));
    return entries;
  }, [selectedCompany, selectedMonth, cacheKey, entriesCache, allEmployees]);

  const updatePayrollEntry = useCallback(
    (id: string, updates: Partial<PayrollEntry>) => {
      setEntriesCache((prev) => ({
        ...prev,
        [cacheKey]: (prev[cacheKey] || []).map((entry) => (entry.id === id ? { ...entry, ...updates } : entry)),
      }));
    },
    [cacheKey]
  );

  const addCompany = useCallback(async (company: Omit<Company, "id">) => {
    const { data, error } = await supabase
      .from("companies")
      .insert({ name: company.name, cnpj: company.cnpj, address: company.address || null })
      .select("id, name, cnpj, address")
      .single();
    if (error || !data) throw error;
    const mapped = mapCompanyRowToModel(data);
    setCompanies((prev) => [...prev, mapped]);
    setSelectedCompany((prev) => prev ?? mapped);
  }, []);

  const updateCompany = useCallback(async (id: string, updates: Partial<Company>) => {
    const payload = {
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.cnpj !== undefined ? { cnpj: updates.cnpj } : {}),
      ...(updates.address !== undefined ? { address: updates.address || null } : {}),
    };

    const { data, error } = await supabase
      .from("companies")
      .update(payload)
      .eq("id", id)
      .select("id, name, cnpj, address")
      .single();
    if (error || !data) throw error;

    const mapped = mapCompanyRowToModel(data);
    setCompanies((prev) => prev.map((company) => (company.id === id ? mapped : company)));
    setSelectedCompany((prev) => (prev?.id === id ? mapped : prev));
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) throw error;

    setCompanies((prev) => {
      const next = prev.filter((company) => company.id !== id);
      setSelectedCompany((selected) => {
        if (selected?.id !== id) return selected;
        return next[0] ?? null;
      });
      return next;
    });
    setAllEmployees((prev) => prev.filter((employee) => employee.companyId !== id));
    setAllDepartments((prev) => prev.filter((department) => department.companyId !== id));
    setAllJobRoles((prev) => prev.filter((jobRole) => jobRole.companyId !== id));
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
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;

    setAllEmployees((prev) => prev.filter((employee) => employee.id !== id));
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
    const payload = {
      ...(updates.companyId !== undefined ? { company_id: updates.companyId } : {}),
      ...(updates.name !== undefined ? { name: normalizeRequiredText(updates.name) } : {}),
      ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
    };

    const { data, error } = await supabase.from("departments").update(payload).eq("id", id).select("id, company_id, name, is_active").single();
    if (error || !data) throw error;

    setAllDepartments((prev) => prev.map((department) => (department.id === id ? mapDepartmentRowToModel(data) : department)));
  }, []);

  const deleteDepartment = useCallback(async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw error;

    setAllDepartments((prev) => prev.filter((department) => department.id !== id));
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
    const payload = {
      ...(updates.companyId !== undefined ? { company_id: updates.companyId } : {}),
      ...(updates.name !== undefined ? { name: normalizeRequiredText(updates.name) } : {}),
      ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
    };

    const { data, error } = await supabase.from("job_roles").update(payload).eq("id", id).select("id, company_id, name, is_active").single();
    if (error || !data) throw error;

    setAllJobRoles((prev) => prev.map((jobRole) => (jobRole.id === id ? mapJobRoleRowToModel(data) : jobRole)));
  }, []);

  const deleteJobRole = useCallback(async (id: string) => {
    const { error } = await supabase.from("job_roles").delete().eq("id", id);
    if (error) throw error;

    setAllJobRoles((prev) => prev.filter((jobRole) => jobRole.id !== id));
  }, []);

  const addRubric = useCallback(async (rubric: Omit<Rubric, "id">) => {
    const { data, error } = await supabase
      .from("rubrics")
      .insert(mapRubricInsertToRow(rubric))
      .select("id, name, code, rubric_category, rubric_type, mode, order_index, is_active, formula_items, allow_manual_override")
      .single();
    if (error || !data) throw error;

    setRubrics((prev) => [...prev, mapRubricRowToModel(data)]);
  }, []);

  const updateRubric = useCallback(async (id: string, updates: Partial<Rubric>) => {
    const { data, error } = await supabase
      .from("rubrics")
      .update(mapRubricUpdateToRow(updates))
      .eq("id", id)
      .select("id, name, code, rubric_category, rubric_type, mode, order_index, is_active, formula_items, allow_manual_override")
      .single();
    if (error || !data) throw error;

    setRubrics((prev) => prev.map((rubric) => (rubric.id === id ? mapRubricRowToModel(data) : rubric)));
  }, []);

  const deleteRubric = useCallback(async (id: string) => {
    const { error } = await supabase.from("rubrics").delete().eq("id", id);
    if (error) throw error;

    setRubrics((prev) => prev.filter((rubric) => rubric.id !== id));
  }, []);

  return (
    <PayrollContext.Provider
      value={{
        companies,
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
        isLoading,
        updatePayrollEntry,
        addCompany,
        updateCompany,
        deleteCompany,
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addDepartment,
        updateDepartment,
        deleteDepartment,
        addJobRole,
        updateJobRole,
        deleteJobRole,
        addRubric,
        updateRubric,
        deleteRubric,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};
