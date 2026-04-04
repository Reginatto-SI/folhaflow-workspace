import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Company, Department, Employee, JobRole, PayrollEntry, PayrollMonth } from "@/types/payroll";
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
  jobRoles: JobRole[];
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
  department: string | null;
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
  department: row.department || "",
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
  department: normalizeText(employee.department),
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
  ...(updates.department !== undefined ? { department: normalizeText(updates.department) } : {}),
  ...(updates.role !== undefined ? { role: normalizeText(updates.role) } : {}),
  ...(updates.isMonthly !== undefined ? { is_monthly: updates.isMonthly } : {}),
  ...(updates.isOnLeave !== undefined ? { is_on_leave: updates.isOnLeave } : {}),
  ...(updates.isActive !== undefined ? { is_active: updates.isActive } : {}),
  ...(updates.bankName !== undefined ? { bank_name: normalizeText(updates.bankName) } : {}),
  ...(updates.bankBranch !== undefined ? { bank_branch: normalizeText(updates.bankBranch) } : {}),
  ...(updates.bankAccount !== undefined ? { bank_account: normalizeText(updates.bankAccount) } : {}),
  ...(updates.baseSalary !== undefined ? { base_salary: updates.baseSalary } : {}),
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
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth>({ month: 3, year: 2026 });
  const [entriesCache, setEntriesCache] = useState<Record<string, PayrollEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    // Comentário: carregamos cadastros administrativos da mesma origem para manter o padrão piloto consistente e reaproveitável.
    const [companiesRes, employeesRes, departmentsRes, rolesRes] = await Promise.all([
      supabase.from("companies").select("id, name, cnpj, address").order("name", { ascending: true }),
      supabase.from("employees").select("*").order("name", { ascending: true }),
      supabase.from("departments").select("id, company_id, name, is_active").order("name", { ascending: true }),
      supabase.from("job_roles").select("id, company_id, name, is_active").order("name", { ascending: true }),
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
        jobRoles,
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
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};
