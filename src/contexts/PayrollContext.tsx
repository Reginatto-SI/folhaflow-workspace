import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Company, Employee, PayrollEntry, PayrollMonth } from "@/types/payroll";
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
  payrollEntries: PayrollEntry[];
  isLoading: boolean;
  updatePayrollEntry: (id: string, updates: Partial<PayrollEntry>) => void;
  addCompany: (company: Omit<Company, "id">) => Promise<void>;
  updateCompany: (id: string, updates: Partial<Company>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  addEmployee: (employee: Omit<Employee, "id">) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
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

const mapEmployeeRowToModel = (row: {
  id: string;
  company_id: string;
  name: string;
  cpf: string;
  admission_date: string;
  registration: string | null;
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
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth>({ month: 3, year: 2026 });
  const [entriesCache, setEntriesCache] = useState<Record<string, PayrollEntry[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);

    // Comentário: carregamos empresas e funcionários direto do Supabase para remover dependência de mock no cadastro.
    const [companiesRes, employeesRes] = await Promise.all([
      supabase.from("companies").select("id, name, cnpj, address").order("name", { ascending: true }),
      supabase.from("employees").select("*").order("name", { ascending: true }),
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

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const cacheKey = `${selectedCompany?.id}-${selectedMonth.month}-${selectedMonth.year}`;
  const employees = allEmployees.filter((employee) => employee.companyId === selectedCompany?.id);

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
        payrollEntries,
        isLoading,
        updatePayrollEntry,
        addCompany,
        updateCompany,
        deleteCompany,
        addEmployee,
        updateEmployee,
        deleteEmployee,
      }}
    >
      {children}
    </PayrollContext.Provider>
  );
};
