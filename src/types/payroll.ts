export interface Company {
  id: string;
  name: string;
  cnpj: string;
  address?: string;
}

export interface Department {
  id: string;
  // Comentário: departamento é vinculado por empresa para preservar autonomia multiempresa e evitar mistura indevida entre estruturas.
  companyId: string;
  name: string;
  isActive: boolean;
}

export interface JobRole {
  id: string;
  // Comentário: função/cargo também é por empresa, mantendo consistência com cenários de grupos empresariais com nomenclaturas distintas.
  companyId: string;
  name: string;
  isActive: boolean;
}

export interface Employee {
  id: string;
  // Comentário: nesta fase, companyId representa a empresa formal de registro (empresa registrada), não o vínculo completo de folha multiempresa.
  companyId: string;
  name: string;
  cpf: string;
  admissionDate: string;
  registration?: string;
  // Comentário: campo novo para carteira de trabalho no cadastro-base de RH.
  workCardNumber?: string;
  notes?: string;
  // Comentário: vínculo estruturado por ID em transição gradual; ainda convivendo com campo legado de texto.
  departmentId?: string;
  department?: string;
  // Comentário: vínculo estruturado por ID em transição gradual; ainda convivendo com campo legado de texto.
  jobRoleId?: string;
  role?: string;
  isMonthly: boolean;
  isOnLeave: boolean;
  isActive: boolean;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  bankPixKey?: string;
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
