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
  workerType: "mensalista",
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
  earnings: { salario_ctps: 1200, horas_extras: 250 },
  deductions: { inss: 100 },
  notes: "observação não deve aparecer no recibo",
  netSalary: 1350,
};

describe("Receipt", () => {
  it("renderiza o modelo legado, mantém linhas vazias e não duplica sinais", () => {
    const rubrics = [
      makeRubric({ id: "salario_ctps", name: "Salário CTPS", code: "SAL_CTPS", classification: "salario_ctps", order: 1 }),
      makeRubric({ id: "horas_extras", name: "(+) Horas Extras", code: "HE", classification: "horas_extras", order: 2 }),
      makeRubric({ id: "inss", name: "(-) INSS", code: "INSS", type: "desconto", classification: "inss", order: 3 }),
      makeRubric({ id: "salario_liquido", name: "Salário Líquido", code: "salario_liquido", nature: "calculada", calculationMethod: "formula", order: 4 }),
    ];

    render(<Receipt entry={entry} employee={employee} company={company} rubrics={rubrics} isLast />);

    expect(screen.getByText("Observação:").closest("tr")).toHaveTextContent("Saldo salário - ABRIL-26");
    expect(screen.queryByText("observação não deve aparecer no recibo")).not.toBeInTheDocument();
    expect(screen.queryByText(/\(\+\) \(\+\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(-\) \(-\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Salário Líquido$/i)).not.toBeInTheDocument();

    const emptyRow = screen.getByText("(+) 1/3 de férias").closest("tr");
    expect(emptyRow).not.toBeNull();
    expect(within(emptyRow as HTMLTableRowElement).getAllByRole("cell")[1]).toHaveTextContent(/^$/);
    expect(emptyRow).not.toHaveTextContent("R$ 0,00");

    const verbasTable = screen.getByText("DISCRIMINAÇÃO DAS VERBAS").closest("table");
    expect(verbasTable).not.toBeNull();
    const verbasRows = (verbasTable as HTMLTableElement).querySelectorAll("tbody tr");
    expect(Array.from(verbasRows).map((row) => row.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "Salário BrutoR$ 1.200,00",
      "(+) Diárias/Gratificações",
      "(+) 1/3 de férias",
      "(+) Hora extrasR$ 250,00",
      "(+) Prêmio/Desemp.",
      "(-) INSSR$ 100,00",
      "(-) Emprést. Consig.",
      "(-) Adiant. Gerencial",
      "(-) Vale/Desconto",
      "(-) Descontos/Faltas",
      "(=) Líquido a receberR$ 1.350,00",
    ]);

    const receiptSheet = screen.getByText("DISCRIMINAÇÃO DAS VERBAS").closest(".receipt-sheet");
    expect(receiptSheet).toHaveClass("notranslate");
    expect(receiptSheet).toHaveAttribute("translate", "no");
    expect(receiptSheet).toHaveAttribute("lang", "pt-BR");
    expect(verbasTable).toHaveClass("notranslate");
    expect(screen.getByText("Valor por Extenso:").nextElementSibling).toHaveAttribute("translate", "no");
    expect(screen.getByText("www.reginattosistemas.com.br - (65) 99210-2030")).toBeInTheDocument();
  });

  it("mantém valor por extenso em português do Brasil e protegido contra tradução", () => {
    render(<Receipt entry={{ ...entry, netSalary: 833.33 }} employee={employee} company={company} rubrics={[]} isLast />);

    const valorExtensoCell = screen.getByText("oitocentos e trinta e três reais e trinta e três centavos");
    expect(valorExtensoCell).toHaveClass("notranslate");
    expect(valorExtensoCell).toHaveAttribute("translate", "no");
    expect(valorExtensoCell).toHaveAttribute("lang", "pt-BR");
    expect(screen.getByText("Valor por Extenso:")).toHaveClass("notranslate");
    expect(screen.getByText("VALOR RECEBIDO:")).toHaveAttribute("translate", "no");
  });

});
