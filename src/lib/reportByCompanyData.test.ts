import { describe, expect, it } from "vitest";
import { buildConsolidatedReportByCompanyData, buildReportByCompanyData } from "@/lib/reportByCompanyData";
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


const makeCompany = (id: string, name: string): Company => ({
  id,
  name,
  cnpj: `00.000.000/0001-${id}`,
  address: `Rua ${id}`,
  isActive: true,
});

const makeBatch = (id: string, companyId: string): PayrollBatch => ({
  id,
  companyId,
  month: 4,
  year: 2026,
  status: "em_edicao",
  isArchived: false,
} as unknown as PayrollBatch);

const makeRubric = (id: string, order: number): Rubric => ({
  id,
  name: `Rubrica ${id.toUpperCase()}`,
  code: id.toUpperCase(),
  type: "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: "outros_rendimentos",
  order,
  isActive: true,
  formulaItems: [],
  allowManualOverride: false,
} as Rubric);

const makeCompanyEmployee = (id: string, companyId: string, name: string): Employee => ({
  id,
  companyId,
  name,
  cpf: id,
  admissionDate: "2025-01-01",
  registration: id,
  department: "Adm",
  role: "Analista",
  isMonthly: true,
  isOnLeave: false,
  isActive: true,
});

const makeCompanyEntry = (
  id: string,
  companyId: string,
  employeeId: string,
  payrollBatchId: string,
  earnings: Record<string, number>,
): PayrollEntry => ({
  id,
  companyId,
  employeeId,
  payrollBatchId,
  month: 4,
  year: 2026,
  baseSalary: 0,
  earnings,
  deductions: {},
  notes: "",
});

describe("buildConsolidatedReportByCompanyData", () => {
  it("une rubricas de todas as empresas e soma total geral sem recalcular valores", () => {
    const companyA = makeCompany("c1", "Empresa 1");
    const companyB = makeCompany("c2", "Empresa 2");
    const batchA = makeBatch("b1", companyA.id);
    const batchB = makeBatch("b2", companyB.id);
    const rubricsA = [makeRubric("a", 1), makeRubric("b", 2), makeRubric("c", 3)];
    const rubricsB = [makeRubric("a", 1), makeRubric("b", 2), makeRubric("d", 4)];
    const employees = [
      makeCompanyEmployee("e1", companyA.id, "Ana"),
      makeCompanyEmployee("e2", companyB.id, "Bruno"),
    ];
    const entries = [
      makeCompanyEntry("p1", companyA.id, "e1", batchA.id, { a: 10, b: 20, c: 30 }),
      makeCompanyEntry("p2", companyB.id, "e2", batchB.id, { a: 1, b: 2, d: 4 }),
    ];

    const datasetA = buildReportByCompanyData({
      company: companyA,
      month: { month: 4, year: 2026 },
      batch: batchA,
      allBatches: [batchA, batchB],
      allEmployees: employees,
      allEntries: entries,
      rubrics: rubricsA,
    });
    const datasetB = buildReportByCompanyData({
      company: companyB,
      month: { month: 4, year: 2026 },
      batch: batchB,
      allBatches: [batchA, batchB],
      allEmployees: employees,
      allEntries: entries,
      rubrics: rubricsB,
    });

    const consolidated = buildConsolidatedReportByCompanyData([datasetB, datasetA]);

    expect(consolidated?.dynamicColumns.map((column) => column.rubricId)).toEqual(["a", "b", "c", "d"]);
    expect(consolidated?.companySections?.map((section) => section.companyName)).toEqual(["Empresa 1", "Empresa 2"]);
    expect(consolidated?.totalsByRubricId).toMatchObject({ a: 11, b: 22, c: 30, d: 4 });
    expect(consolidated?.companySections?.[0].totalsByRubricId.d ?? 0).toBe(0);
    expect(consolidated?.companySections?.[1].totalsByRubricId.c ?? 0).toBe(0);
  });
});
