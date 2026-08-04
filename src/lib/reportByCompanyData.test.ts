import { describe, expect, it } from "vitest";
import { buildConsolidatedReportByCompanyData, buildReportByCompanyData } from "@/lib/reportByCompanyData";
import { buildFinancialSheetData, buildReportByCompanySheetData } from "@/lib/reportByCompanyExcel";
import { buildPayrollPdfDynamicColumns, buildPayrollPdfEmployeeRows } from "@/lib/reportByCompanyPdf";
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
  workerType: "mensalista",
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
  workerType: "mensalista",
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


describe("buildReportByCompanyData - IDs financeiros estruturados", () => {
  it("resolve Salário Fiscal por code técnico explícito e G2/Líquido pelos resolvedores canônicos da Central", () => {
    const rubrics: Rubric[] = [
      { ...rubric, id: "fiscal", code: "SAL_FISCAL", name: "Qualquer label", nature: "calculada", calculationMethod: "formula", classification: null, order: 1 },
      { ...rubric, id: "g2", code: "g2_complemento", name: "Outro label", nature: "calculada", calculationMethod: "formula", classification: null, order: 2 },
      { ...rubric, id: "liq", code: "salario_liquido", name: "Mais um label", nature: "calculada", calculationMethod: "formula", classification: null, order: 3 },
    ];

    const dataset = buildReportByCompanyData({
      company,
      month: { month: 4, year: 2026 },
      batch,
      allBatches: [batch],
      allEmployees: [makeEmployee("e1", "Ana", "111")],
      allEntries: [{ ...makeEntry("e1", 10), earnings: { fiscal: 100, g2: 20, liq: 90 } }],
      rubrics,
    });

    expect(dataset.financialRubricIds).toEqual({ salarioFiscalId: "fiscal", salarioG2Id: "g2", liquidoId: "liq" });
    expect(dataset.rows[0].rubricValues.fiscal).toBe(100);
  });

  it("preserva o Salário Fiscal calculado pela Central nas duas abas, inclusive zero, sem misturar competências", () => {
    const augustBatch = { ...batch, id: "batch-ago-2026", month: 8 } as PayrollBatch;
    const sourceRubric: Rubric = {
      ...rubric,
      id: "base-fiscal",
      code: "BASE_FISCAL",
      name: "Base Fiscal",
      nature: "base",
      calculationMethod: "manual",
      order: 1,
    };
    const fiscalRubric: Rubric = {
      ...rubric,
      id: "fiscal",
      code: "SAL_FISCAL",
      name: "Salário Fiscal",
      nature: "calculada",
      calculationMethod: "formula",
      classification: null,
      formulaItems: [{ id: "formula-fiscal", sourceRubricId: sourceRubric.id, operation: "add", order: 1 }],
      order: 2,
    };
    const augustEntry = (employeeId: string, earnings: Record<string, number>) => ({
      ...makeEntry(employeeId, 0),
      id: `p-ago-${employeeId}`,
      payrollBatchId: augustBatch.id,
      month: 8,
      earnings,
    });
    const positiveEntry = augustEntry("e1", { [sourceRubric.id]: 3284.07 });
    const zeroEntry = augustEntry("e2", { [sourceRubric.id]: 0 });
    const missingEntry = augustEntry("e4", {});
    const julyEntry = { ...augustEntry("e3", { [sourceRubric.id]: 9999 }), id: "p-jul-e3", month: 7 };

    const dataset = buildReportByCompanyData({
      company,
      month: { month: 8, year: 2026 },
      batch: augustBatch,
      allBatches: [augustBatch],
      allEmployees: [
        makeEmployee("e1", "Ana", "111"),
        makeEmployee("e2", "Bia", "222"),
        makeEmployee("e3", "Cris", "333"),
        makeEmployee("e4", "Dora", "444"),
      ],
      allEntries: [positiveEntry, zeroEntry, missingEntry, julyEntry],
      rubrics: [sourceRubric, fiscalRubric],
    });

    // O JSON persiste somente a rubrica manual; Salário Fiscal vem do mapa normalizado da Central.
    expect(positiveEntry.earnings).not.toHaveProperty(fiscalRubric.id);
    expect(dataset.rows.map((row) => row.rubricValues.fiscal)).toEqual([3284.07, 0, 0]);
    expect(dataset.totalsByRubricId.fiscal).toBe(3284.07);

    const generalRows = buildReportByCompanySheetData(dataset);
    const financialRows = buildFinancialSheetData(dataset);
    expect(generalRows[3][9]).toMatchObject({ v: 3284.07, t: "n" });
    expect(generalRows[4][9]).toMatchObject({ v: 0, t: "n" });
    expect(financialRows[3][8]).toMatchObject({ v: 3284.07, t: "n" });
    expect(financialRows[4][8]).toMatchObject({ v: 0, t: "n" });

    const pdfDynamicColumns = buildPayrollPdfDynamicColumns(dataset);
    const fiscalPdfColumnIndex = pdfDynamicColumns.findIndex((column) => column.rubricId === fiscalRubric.id);
    const fiscalPdfCellIndex = 4 + fiscalPdfColumnIndex;
    const pdfRows = buildPayrollPdfEmployeeRows(dataset, pdfDynamicColumns);

    expect(fiscalPdfColumnIndex).toBeGreaterThanOrEqual(0);
    expect(pdfRows[0][fiscalPdfCellIndex]).toBe("R$ 3.284,07");
    expect(pdfRows[1][fiscalPdfCellIndex]).toBe("");
  });

  it("prioriza valor persistido e mantém julho de 2026 sem regressão", () => {
    const julyBatch = { ...batch, id: "batch-jul-2026", month: 7 } as PayrollBatch;
    const sourceRubric: Rubric = { ...rubric, id: "base-jul", code: "BASE_JUL", order: 1 };
    const fiscalRubric: Rubric = {
      ...rubric,
      id: "fiscal-jul",
      code: "SALARIO_FISCAL",
      name: "Salário Fiscal",
      nature: "calculada",
      calculationMethod: "formula",
      classification: null,
      formulaItems: [{ id: "formula-jul", sourceRubricId: sourceRubric.id, operation: "add", order: 1 }],
      order: 2,
    };
    const persistedValue = 2500;
    const dataset = buildReportByCompanyData({
      company,
      month: { month: 7, year: 2026 },
      batch: julyBatch,
      allBatches: [julyBatch],
      allEmployees: [makeEmployee("e1", "Ana", "111")],
      allEntries: [{
        ...makeEntry("e1", 0),
        month: 7,
        payrollBatchId: julyBatch.id,
        // O resultado atual da fórmula seria 3000; julho deve conservar o valor persistido.
        earnings: { [sourceRubric.id]: 3000, [fiscalRubric.id]: persistedValue },
      }],
      rubrics: [sourceRubric, fiscalRubric],
    });

    expect(dataset.rows[0].rubricValues[fiscalRubric.id]).toBe(persistedValue);
    expect(dataset.rows[0].rubricValues[sourceRubric.id]).toBe(3000);
  });

  it("aceita código técnico legado em agosto e ignora batch arquivado", () => {
    const currentBatch = { ...batch, id: "batch-ago-atual", month: 8 } as PayrollBatch;
    const archivedBatch = { ...batch, id: "batch-ago-arquivado", month: 8, isArchived: true } as PayrollBatch;
    const fiscalRubric: Rubric = { ...rubric, id: "fiscal-novo", code: " SAL_FISCAL ", name: "Salário Fiscal", order: 1 };
    const entry = (id: string, payrollBatchId: string, value: number): PayrollEntry => ({
      ...makeEntry("e1", 0), id, month: 8, payrollBatchId, earnings: { SALARIO_FISCAL: value },
    });

    const dataset = buildReportByCompanyData({
      company,
      month: { month: 8, year: 2026 },
      batch: currentBatch,
      allBatches: [currentBatch, archivedBatch],
      allEmployees: [makeEmployee("e1", "Ana", "111")],
      allEntries: [entry("entry-atual", currentBatch.id, 1800), entry("entry-arquivado", archivedBatch.id, 9999)],
      rubrics: [fiscalRubric],
    });

    expect(dataset.rows).toHaveLength(1);
    expect(dataset.rows[0].rubricValues[fiscalRubric.id]).toBe(1800);
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
  workerType: "mensalista",
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
  workerType: "mensalista",
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
