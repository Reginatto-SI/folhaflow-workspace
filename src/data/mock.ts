import { Employee, PayrollEntry, Rubric } from "@/types/payroll";

export const mockRubrics: Rubric[] = [
  { id: "r1", name: "Horas Extras", code: "HE", category: "variavel", type: "provento", mode: "manual", order: 1, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r2", name: "Bônus", code: "BON", category: "variavel", type: "provento", mode: "manual", order: 2, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r3", name: "Vale Transporte", code: "VT", category: "beneficio", type: "desconto", mode: "manual", order: 3, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r4", name: "Vale Refeição", code: "VR", category: "beneficio", type: "desconto", mode: "manual", order: 4, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r5", name: "INSS", code: "INSS", category: "obrigatorio", type: "desconto", mode: "manual", order: 5, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r6", name: "IRRF", code: "IRRF", category: "obrigatorio", type: "desconto", mode: "manual", order: 6, isActive: true, formulaItems: [], allowManualOverride: false },
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
