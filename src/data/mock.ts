import { Employee, PayrollEntry, Rubric } from "@/types/payroll";

export const mockRubrics: Rubric[] = [
  { id: "r1", companyId: "c1", name: "Horas Extras", type: "earning", behavior: "manual", isFrequent: true },
  { id: "r2", companyId: "c1", name: "Bônus", type: "earning", behavior: "manual", isFrequent: false },
  { id: "r3", companyId: "c1", name: "Vale Transporte", type: "deduction", behavior: "percentage", defaultValue: 6, isFrequent: true },
  { id: "r4", companyId: "c1", name: "Vale Refeição", type: "deduction", behavior: "fixed", defaultValue: 450, isFrequent: true },
  { id: "r5", companyId: "c1", name: "INSS", type: "deduction", behavior: "percentage", defaultValue: 14, isFrequent: true },
  { id: "r6", companyId: "c1", name: "IRRF", type: "deduction", behavior: "percentage", defaultValue: 27.5, isFrequent: true },
];

// Comentário: geração mantida em memória, separada do cadastro oficial para não misturar com persistência de RH.
export const generatePayrollEntries = (
  employees: Employee[],
  companyId: string,
  month: number,
  year: number
): PayrollEntry[] => {
  const activeEmployees = employees.filter((e) => e.companyId === companyId && e.isActive);
  return activeEmployees.map((emp) => ({
    id: `p-${emp.id}-${month}-${year}`,
    employeeId: emp.id,
    companyId,
    month,
    year,
    baseSalary: emp.baseSalary,
    earnings: {
      "Horas Extras": Math.round(Math.random() * 2000),
      "Bônus": Math.random() > 0.7 ? Math.round(Math.random() * 3000) : 0,
    },
    deductions: {
      "Vale Transporte": Math.round(emp.baseSalary * 0.06),
      "Vale Refeição": 450,
      "INSS": Math.round(emp.baseSalary * 0.14),
      "IRRF": Math.round(emp.baseSalary * 0.275 * 0.5),
    },
    notes: "",
  }));
};
