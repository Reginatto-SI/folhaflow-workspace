export interface Company {
  id: string;
  name: string;
  cnpj: string;
  address?: string;
}

export interface Employee {
  id: string;
  companyId: string;
  name: string;
  cpf: string;
  admissionDate: string;
  registration?: string;
  notes?: string;
  department?: string;
  role?: string;
  isMonthly: boolean;
  isOnLeave: boolean;
  isActive: boolean;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  // Comentário: baseSalary foi preservado por compatibilidade com a Central de Folha.
  baseSalary: number;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  companyId: string;
  month: number;
  year: number;
  baseSalary: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  notes: string;
}

export interface Rubric {
  id: string;
  companyId: string;
  name: string;
  type: "earning" | "deduction";
  behavior: "manual" | "fixed" | "percentage";
  defaultValue?: number;
  isFrequent: boolean;
}

export type PayrollMonth = {
  month: number;
  year: number;
};
