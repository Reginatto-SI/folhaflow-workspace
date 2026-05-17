import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Receipt from "./Receipt";
import { Company, Employee, PayrollEntry, Rubric } from "@/types/payroll";

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

const employee: Employee = {
  id: "employee-1",
  companyId: "company-1",
  name: "Funcionário Teste",
  cpf: "000.000.000-00",
  admissionDate: "2026-01-01",
  isMonthly: true,
  isOnLeave: false,
  isActive: true,
};

const company: Company = {
  id: "company-1",
  name: "Empresa Teste",
  cnpj: "00.000.000/0001-00",
  address: "Rua Teste",
  isActive: true,
};

const entry: PayrollEntry = {
  id: "entry-1",
  employeeId: employee.id,
  companyId: company.id,
  month: 4,
  year: 2026,
  baseSalary: 0,
  earnings: { provento: 1200 },
  deductions: {},
  notes: "observação não deve aparecer no recibo",
};

describe("Receipt", () => {
  it("mantém rubricas ativas sem valor em branco e preserva rodapé correto", () => {
    const rubrics = [
      makeRubric({ id: "sem-valor", name: "Rubrica sem valor", order: 1 }),
      makeRubric({ id: "provento", name: "Provento lançado", order: 2 }),
    ];

    render(<Receipt entry={entry} employee={employee} company={company} rubrics={rubrics} isLast />);

    const semValorRow = screen.getByText("(+) Rubrica sem valor").closest("tr");
    expect(semValorRow).not.toBeNull();
    expect(within(semValorRow as HTMLTableRowElement).getAllByRole("cell")[1]).toHaveTextContent(/^$/);
    expect(semValorRow).not.toHaveTextContent("R$ 0,00");

    const verbasTable = screen.getByText("DISCRIMINAÇÃO DAS VERBAS").closest("table");
    expect(verbasTable).not.toBeNull();
    const verbasRows = (verbasTable as HTMLTableElement).querySelectorAll("tbody tr");
    expect(Array.from(verbasRows).map((row) => row.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "(+) Rubrica sem valor",
      "(+) Provento lançadoR$ 1.200,00",
      "(=) Líquido a receberR$ 1.200,00",
    ]);
    expect(screen.getByText("www.reginattosistemas.com.br - (65) 99210-2030")).toBeInTheDocument();
  });
});
