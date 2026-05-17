import { describe, expect, it } from "vitest";
import { buildReceiptData } from "./receiptData";
import { PayrollEntry, Rubric } from "@/types/payroll";

const makeRubric = (overrides: Partial<Rubric>): Rubric => ({
  id: "rubric",
  name: "Rubrica",
  code: "RUB",
  type: "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: "outros_rendimentos",
  order: 1,
  isActive: true,
  fixedValue: null,
  percentageValue: null,
  percentageBaseRubricId: null,
  formulaItems: [],
  allowManualOverride: true,
  ...overrides,
});

const entry: PayrollEntry = {
  id: "entry-1",
  employeeId: "employee-1",
  companyId: "company-1",
  month: 3,
  year: 2026,
  baseSalary: 0,
  earnings: { provento: 1200 },
  deductions: {},
  notes: "observação digitada no drawer",
};

describe("buildReceiptData", () => {
  it("lista rubricas ativas na ordem cadastrada e mantém rubrica sem valor", () => {
    const rubrics = [
      makeRubric({ id: "inativa", name: "Inativa", order: 1, isActive: false }),
      makeRubric({ id: "sem-valor", name: "Sem valor", order: 3 }),
      makeRubric({ id: "provento", name: "Provento lançado", order: 2 }),
    ];

    const data = buildReceiptData(entry, rubrics);

    expect(data.lines.map((line) => line.label)).toEqual([
      "Provento lançado",
      "Sem valor",
      "Líquido a receber",
    ]);
    expect(data.lines[0].value).toBe(1200);
    expect(data.lines[1].value).toBe(0);
    expect(data.lines.at(-1)).toMatchObject({ label: "Líquido a receber", prefix: "(=)", value: 1200, highlight: true });
  });
});
