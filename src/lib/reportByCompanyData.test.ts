import { describe, expect, it } from "vitest";
import { buildReportByCompanyData } from "@/lib/reportByCompanyData";
import type { Company, Employee, PayrollBatch, PayrollEntry, Rubric } from "@/types/payroll";

const company = {
  id: "c1",
  name: "Empresa 1",
  cnpj: "00.000.000/0001-00",
  address: "Rua 1",
  isActive: true,
} as Company;

const batch = {
  id: "b1",
  companyId: "c1",
  month: 4,
  year: 2026,
  status: "em_edicao",
  isArchived: false,
} as unknown as PayrollBatch;

const rubric = {
  id: "salario",
  name: "Salário",
  code: "SALARIO",
  type: "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: "salario_ctps",
  order: 1,
  isActive: true,
  formulaItems: [],
  allowManualOverride: false,
} as Rubric;

const makeEmployee = (id: string, name: string, cpf: string): Employee => ({
  id,
  companyId: "c1",
  name,
  cpf,
  admissionDate: "2025-01-01",
  registration: id,
  department: "Adm",
  role: "Analista",
  isMonthly: true,
  isOnLeave: false,
  isActive: true,
});

const makeEntry = (employeeId: string, value: number): PayrollEntry => ({
  id: `p-${employeeId}`,
  companyId: "c1",
  employeeId,
  payrollBatchId: "b1",
  month: 4,
  year: 2026,
  baseSalary: 0,
  earnings: { salario: value },
  deductions: {},
  notes: "",
});

describe("buildReportByCompanyData - ordenação de funcionários", () => {
  it("ordena funcionários A-Z em português, envia nomes ausentes ao final e preserva totais", () => {
    const employees = [
      makeEmployee("e1", "Zoé 10", "333"),
      makeEmployee("e2", "Álvaro", "111"),
      makeEmployee("e3", "Ana", "222"),
      makeEmployee("e4", "", "444"),
      makeEmployee("e5", "Zoé 2", "555"),
    ];

    const dataset = buildReportByCompanyData({
      company,
      month: { month: 4, year: 2026 },
      batch,
      allBatches: [batch],
      allEmployees: employees,
      allEntries: [
        makeEntry("e1", 10),
        makeEntry("e2", 20),
        makeEntry("e3", 30),
        makeEntry("e4", 40),
        makeEntry("e5", 50),
      ],
      rubrics: [rubric],
    });

    expect(dataset.rows.map((row) => row.name)).toEqual(["Álvaro", "Ana", "Zoé 2", "Zoé 10", "Funcionário não encontrado"]);
    expect(dataset.totalsByRubricId.salario).toBe(150);
  });
});
