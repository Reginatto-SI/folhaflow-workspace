import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PayrollTable from "@/components/payroll/PayrollTable";
import TotalsBar from "@/components/payroll/TotalsBar";
import { Employee, PayrollEntry, Rubric } from "@/types/payroll";

let payrollContext: { payrollEntries: PayrollEntry[]; rubrics: Rubric[] };

vi.mock("@/contexts/PayrollContext", () => ({
  usePayroll: () => payrollContext,
}));

const makeBaseRubric = (overrides: Partial<Rubric>): Rubric => ({
  id: overrides.id || "base",
  name: overrides.name || "Salário Base",
  code: overrides.code || "salario_base",
  type: overrides.type || "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: overrides.classification ?? "salario_ctps",
  order: overrides.order ?? 1,
  isActive: overrides.isActive ?? true,
  formulaItems: [],
  allowManualOverride: true,
});

const makeDerivedRubric = (overrides: Partial<Rubric>): Rubric => ({
  id: overrides.id || "derived",
  name: overrides.name || "Resultado",
  code: overrides.code || "resultado",
  type: overrides.type || "provento",
  nature: "calculada",
  calculationMethod: overrides.calculationMethod || "formula",
  classification: overrides.classification ?? null,
  fixedValue: overrides.fixedValue ?? null,
  percentageValue: overrides.percentageValue ?? null,
  percentageBaseRubricId: overrides.percentageBaseRubricId ?? null,
  order: overrides.order ?? 2,
  isActive: overrides.isActive ?? true,
  formulaItems: overrides.formulaItems ?? [],
  allowManualOverride: false,
});

const employee: Employee = {
  id: "emp-1",
  companyId: "comp-1",
  workerType: "mensalista",
  name: "Ana Silva",
  cpf: "12345678901",
  admissionDate: "2026-01-01",
  departmentId: "dept-1",
  jobRoleId: "role-1",
  isMonthly: true,
  isOnLeave: false,
  isActive: true,
};

const entry = (earnings: Record<string, number>): PayrollEntry => ({
  id: "entry-1",
  employeeId: employee.id,
  companyId: "comp-1",
  workerType: "mensalista",
  month: 4,
  year: 2026,
  baseSalary: 0,
  earnings,
  deductions: {},
  notes: "",
});

const buildRubrics = () => [
  makeBaseRubric({ id: "base", code: "SAL_BASE", order: 1 }),
  makeDerivedRubric({
    id: "sal-real",
    code: "salario_real",
    name: "Salário Real",
    order: 2,
    formulaItems: [{ id: "sr-1", operation: "add", sourceRubricId: "base", order: 1 }],
  }),
  makeDerivedRubric({
    id: "g2",
    // Code técnico legado encontrado na operação; continua sendo resolvido pelo helper canônico compartilhado.
    code: "salario_g2_complemento",
    name: "Salário G2 Complemento",
    order: 3,
    formulaItems: [
      { id: "g2-1", operation: "add", sourceRubricId: "sal-real", order: 1 },
      { id: "g2-2", operation: "subtract", sourceRubricId: "base", order: 2 },
      { id: "g2-3", operation: "add", sourceRubricId: "bonus", order: 3 },
    ],
  }),
  makeBaseRubric({ id: "bonus", code: "BONUS", name: "Bônus", order: 4 }),
  makeDerivedRubric({
    id: "liq",
    code: "salario_liquido",
    name: "Salário Líquido",
    order: 5,
    formulaItems: [
      { id: "liq-1", operation: "add", sourceRubricId: "sal-real", order: 1 },
      { id: "liq-2", operation: "add", sourceRubricId: "g2", order: 2 },
    ],
  }),
];

const renderTable = (entries: PayrollEntry[], rubrics: Rubric[]) =>
  render(
    <PayrollTable
      entries={entries}
      rubrics={rubrics}
      allEmployees={[employee]}
      allDepartments={[{ id: "dept-1", companyId: "comp-1", name: "Operação", isActive: true }]}
      allJobRoles={[{ id: "role-1", companyId: "comp-1", name: "Motorista", isActive: true }]}
      onRowClick={vi.fn()}
      onToggleConferido={vi.fn()}
      sortKey="employee"
      sortDirection="asc"
      onSortChange={vi.fn()}
    />

  );

const expectMoney = (container: HTMLElement, value: string) => {
  expect(container.textContent?.replace(/\s/g, " ")).toContain(value);
};

describe("Central de Folha — rubricas canônicas", () => {
  beforeEach(() => {
    payrollContext = { payrollEntries: [], rubrics: [] };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("PayrollTable exibe G2 Complemento pela resolução canônica compartilhada", () => {
    const rubrics = buildRubrics();
    const { container } = renderTable([entry({ base: 1000, bonus: 200 })], rubrics);

    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expectMoney(container, "R$ 1.000,00");
    expectMoney(container, "R$ 200,00");
    expectMoney(container, "R$ 1.200,00");
  });

  it("TotalsBar soma G2 Complemento pela mesma origem da tabela", () => {
    const rubrics = buildRubrics();
    const entries = [entry({ base: 1000, bonus: 200 }), { ...entry({ base: 500, bonus: 150 }), id: "entry-2" }];
    payrollContext = { payrollEntries: entries, rubrics };

    const { container } = render(<TotalsBar />);

    expect(screen.getByText("G2 Complemento")).toBeInTheDocument();
    expectMoney(container, "R$ 350,00");
  });

  it("livePreviewEntry reflete G2 na tabela e no resumo antes de salvar", () => {
    const rubrics = buildRubrics();
    const persisted = entry({ base: 1000, bonus: 0 });
    const livePreviewEntry = { ...persisted, earnings: { base: 1000, bonus: 400 } };

    const table = renderTable([livePreviewEntry], rubrics);
    payrollContext = { payrollEntries: [persisted], rubrics };
    const totals = render(<TotalsBar entriesOverride={[livePreviewEntry]} />);

    expectMoney(table.container, "R$ 400,00");
    expectMoney(totals.container, "R$ 400,00");
  });
});
