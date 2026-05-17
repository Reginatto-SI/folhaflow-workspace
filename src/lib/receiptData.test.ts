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
  earnings: {
    sal_ctps: 3000,
    sal_g: 7000,
    salario_fiscal: 3284.07,
    he: 450,
    premio: 200,
    diaria: 150,
    salario_real: 6553.22,
    g2_complemento: -1769.17,
    salario_liquido: 1514.9,
  },
  deductions: {
    inss: 446.78,
    emprestimo: 878.32,
    vales: 4160,
  },
  notes: "observação digitada no drawer",
  netSalary: 1514.9,
};

describe("buildReceiptData", () => {
  it("usa uma única base fiscal para Salário Bruto e não soma salários técnicos", () => {
    const rubrics = [
      makeRubric({ id: "sal_ctps", name: "Salário CTPS", code: "SAL_CTPS", classification: "salario_ctps", order: 1 }),
      makeRubric({ id: "sal_g", name: "Salário G", code: "SAL_G", classification: "salario_g", order: 2 }),
      makeRubric({ id: "salario_fiscal", name: "Salário Fiscal", code: "SALARIO_FISCAL", classification: null, order: 3 }),
      makeRubric({ id: "diaria", name: "Diária", code: "DIARIA", classification: "outros_rendimentos", order: 4 }),
      makeRubric({ id: "ferias", name: "1/3 férias", code: "FERIAS", classification: "ferias_terco", order: 5 }),
      makeRubric({ id: "he", name: "(+) Horas Extras", code: "HE", classification: "horas_extras", order: 6 }),
      makeRubric({ id: "premio", name: "Prêmio", code: "PREMIO", classification: "outros_rendimentos", order: 7 }),
      makeRubric({ id: "inss", name: "(-) INSS", code: "INSS", type: "desconto", classification: "inss", order: 8 }),
      makeRubric({ id: "emprestimo", name: "Empréstimo", code: "EMPRESTIMO", type: "desconto", classification: "emprestimos", order: 9 }),
      makeRubric({ id: "vales", name: "Vales", code: "VALES", type: "desconto", classification: "vales", order: 10 }),
      makeRubric({ id: "salario_real", name: "Salário Real", code: "salario_real", nature: "calculada", calculationMethod: "formula", order: 11 }),
      makeRubric({ id: "g2_complemento", name: "Salário G2 Complemento", code: "g2_complemento", nature: "calculada", calculationMethod: "formula", order: 12 }),
      makeRubric({ id: "salario_liquido", name: "Salário Líquido", code: "salario_liquido", nature: "calculada", calculationMethod: "formula", order: 13 }),
    ];

    const data = buildReceiptData(entry, rubrics);

    expect(data.lines.map((line) => `${line.prefix} ${line.label}`.trim())).toEqual([
      "Salário Bruto",
      "(+) Diarias/Gratificações",
      "(+) 1/3 de férias",
      "(+) Hora extras",
      "(+) Premio/Desemp.",
      "(-) INSS",
      "(-) Emprést. Consig.",
      "(-) Adiant. Gerencial",
      "(-) Vale/Desconto",
      "(-) Descontos/Faltas",
      "(=) Líquido a receber",
    ]);
    expect(data.lines.map((line) => line.label)).not.toEqual(expect.arrayContaining(["Salário Real", "Salário G2 Complemento", "Salário Líquido"]));
    expect(data.baseSalary).toBe(3284.07);
    expect(data.lines[0].value).toBe(3284.07);
    expect(data.lines[1].value).toBe(150);
    expect(data.lines[2].value).toBe(0);
    expect(data.lines[3].value).toBe(450);
    expect(data.lines[4].value).toBe(200);
    expect(data.lines[5].value).toBe(446.78);
    expect(data.lines[6].value).toBe(878.32);
    expect(data.lines[8].value).toBe(4160);
    expect(data.lines.at(-1)).toMatchObject({ label: "Líquido a receber", prefix: "(=)", value: 1514.9, highlight: true });
  });
});
