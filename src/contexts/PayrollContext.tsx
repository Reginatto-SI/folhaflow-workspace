import React, { createContext, useContext, useState, useCallback } from "react";
import { Company, Employee, PayrollEntry, PayrollMonth } from "@/types/payroll";
import { mockCompanies, mockEmployees, generatePayrollEntries } from "@/data/mock";

interface PayrollContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  selectedMonth: PayrollMonth;
  setSelectedMonth: (month: PayrollMonth) => void;
  employees: Employee[];
  payrollEntries: PayrollEntry[];
  updatePayrollEntry: (id: string, updates: Partial<PayrollEntry>) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  deleteCompany: (id: string) => void;
  addEmployee: (employee: Employee) => void;
  updateEmployee: (id: string, updates: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
}

const PayrollContext = createContext<PayrollContextType | null>(null);

export const usePayroll = () => {
  const ctx = useContext(PayrollContext);
  if (!ctx) throw new Error("usePayroll must be used within PayrollProvider");
  return ctx;
};

export const PayrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [companies, setCompanies] = useState<Company[]>(mockCompanies);
  const [allEmployees, setAllEmployees] = useState<Employee[]>(mockEmployees);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(mockCompanies[0]);
  const [selectedMonth, setSelectedMonth] = useState<PayrollMonth>({ month: 3, year: 2026 });
  const [entriesCache, setEntriesCache] = useState<Record<string, PayrollEntry[]>>({});

  const cacheKey = `${selectedCompany?.id}-${selectedMonth.month}-${selectedMonth.year}`;

  const employees = allEmployees.filter((e) => e.companyId === selectedCompany?.id);

  const payrollEntries = React.useMemo(() => {
    if (!selectedCompany) return [];
    if (entriesCache[cacheKey]) return entriesCache[cacheKey];
    const entries = generatePayrollEntries(selectedCompany.id, selectedMonth.month, selectedMonth.year);
    setEntriesCache((prev) => ({ ...prev, [cacheKey]: entries }));
    return entries;
  }, [selectedCompany, selectedMonth, cacheKey, entriesCache]);

  const updatePayrollEntry = useCallback(
    (id: string, updates: Partial<PayrollEntry>) => {
      setEntriesCache((prev) => ({
        ...prev,
        [cacheKey]: (prev[cacheKey] || []).map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }));
    },
    [cacheKey]
  );

  const addCompany = useCallback((company: Company) => {
    setCompanies((prev) => [...prev, company]);
  }, []);

  const updateCompany = useCallback((id: string, updates: Partial<Company>) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  const deleteCompany = useCallback((id: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addEmployee = useCallback((employee: Employee) => {
    setAllEmployees((prev) => [...prev, employee]);
  }, []);

  const updateEmployee = useCallback((id: string, updates: Partial<Employee>) => {
    setAllEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, []);

  const deleteEmployee = useCallback((id: string) => {
    setAllEmployees((prev) => prev.filter((e) => e.id !== id));
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
        payrollEntries,
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
