import { Employee, PayrollEntry, Rubric } from "@/types/payroll";

// Comentário: mock mantido apenas para tipagem/testes — runtime usa dados do backend.
// Os campos novos (PRD-02) preenchidos com valores válidos para manter o build verde.
export const mockRubrics: Rubric[] = [
  { id: "r1", name: "Horas Extras", code: "HE", category: "variavel", type: "provento", mode: "manual", nature: "base", calculationMethod: "manual", classification: "horas_extras", order: 1, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r2", name: "Bônus", code: "BON", category: "variavel", type: "provento", mode: "manual", nature: "base", calculationMethod: "manual", classification: "outros_rendimentos", order: 2, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r3", name: "Vale Transporte", code: "VT", category: "beneficio", type: "desconto", mode: "manual", nature: "base", calculationMethod: "manual", classification: "vales", order: 3, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r4", name: "Vale Refeição", code: "VR", category: "beneficio", type: "desconto", mode: "manual", nature: "base", calculationMethod: "manual", classification: "vales", order: 4, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r5", name: "INSS", code: "INSS", category: "obrigatorio", type: "desconto", mode: "manual", nature: "calculada", calculationMethod: "manual", classification: "inss", order: 5, isActive: true, formulaItems: [], allowManualOverride: false },
  { id: "r6", name: "IRRF", code: "IRRF", category: "obrigatorio", type: "desconto", mode: "manual", nature: "calculada", calculationMethod: "manual", classification: null, order: 6, isActive: true, formulaItems: [], allowManualOverride: false },
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
    // Comentário: salário não faz parte do cadastro do funcionário;
    // em geração mock, o lançamento começa em zero e recebe ajustes na folha.
    baseSalary: 0,
    earnings: {
      "Horas Extras": Math.round(Math.random() * 2000),
      "Bônus": Math.random() > 0.7 ? Math.round(Math.random() * 3000) : 0,
    },
    deductions: {
      "Vale Transporte": 0,
      "Vale Refeição": 450,
      "INSS": 0,
      "IRRF": 0,
    },
    notes: "",
  }));
};
