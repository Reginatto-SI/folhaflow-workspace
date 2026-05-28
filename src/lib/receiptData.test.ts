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

    expect(data.baseSalary).toBe(3284.07);

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

    expect(data.lines[0].value).toBe(3284.07);
    expect(data.lines[1].value).toBe(150);
    expect(data.lines[2].value).toBe(0);
    expect(data.lines[3].value).toBe(450);
    expect(data.lines[4].value).toBe(200);
    expect(data.lines[5].value).toBe(446.78);
    expect(data.lines[6].value).toBe(878.32);
    expect(data.lines[7].value).toBe(0);
    expect(data.lines[8].value).toBe(4160);
    expect(data.lines[9].value).toBe(0);
    expect(data.lines.at(-1)).toMatchObject({
      label: "Líquido a receber",
      prefix: "(=)",
      value: 1514.9,
      highlight: true,
    });

    const labels = data.lines.map((line) => line.label.toLowerCase());
    expect(labels.some((label) => label.includes("salário real"))).toBe(false);
    expect(labels.some((label) => label.includes("g2 complemento"))).toBe(false);
    expect(labels.some((label) => label.includes("salário líquido"))).toBe(false);
  });

  it("ordena rubrica individualizada por quantidade entre Premio/Desemp. e INSS sem afetar cálculo", () => {
    const receiptEntry: PayrollEntry = {
      ...entry,
      earnings: {
        ...entry.earnings,
        premio: 200,
        compra_ferias: 600,
      },
      deductions: {
        ...entry.deductions,
        inss: 446.78,
      },
      netSalary: 1514.9,
      rubricMeta: {
        compra_ferias: { quantity: 10 },
      },
    };

    const rubrics = [
      makeRubric({ id: "salario_fiscal", name: "Salário Fiscal", code: "SALARIO_FISCAL", classification: null, order: 3 }),
      makeRubric({ id: "diaria", name: "Diária", code: "DIARIA", classification: "outros_rendimentos", order: 4 }),
      makeRubric({ id: "he", name: "(+) Horas Extras", code: "HE", classification: "horas_extras", order: 6 }),
      makeRubric({ id: "premio", name: "Prêmio/Desemp.", code: "PREMIO", classification: "outros_rendimentos", order: 8 }),
      makeRubric({
        id: "compra_ferias",
        name: "Compra de Férias",
        code: "COMPRA_FERIAS",
        classification: "outros_rendimentos",
        order: 9,
        usesComplementaryQuantity: true,
        complementaryQuantityLabel: "dias",
      }),
      makeRubric({ id: "inss", name: "INSS", code: "INSS", type: "desconto", classification: "inss", order: 10 }),
      makeRubric({ id: "emprestimo", name: "Empréstimo", code: "EMPRESTIMO", type: "desconto", classification: "emprestimos", order: 11 }),
      makeRubric({ id: "vales", name: "Vales", code: "VALES", type: "desconto", classification: "vales", order: 13 }),
    ];

    const data = buildReceiptData(receiptEntry, rubrics);

    const labels = data.lines.map((line) => `${line.prefix} ${line.label}`.trim());
    const premioIndex = labels.indexOf("(+) Premio/Desemp.");
    const compraFeriasIndex = labels.indexOf("(+) Compra de Férias (10 dias)");
    const inssIndex = labels.indexOf("(-) INSS");

    expect(premioIndex).toBeGreaterThan(-1);
    expect(compraFeriasIndex).toBeGreaterThan(-1);
    expect(inssIndex).toBeGreaterThan(-1);
    expect(premioIndex).toBeLessThan(compraFeriasIndex);
    expect(compraFeriasIndex).toBeLessThan(inssIndex);

    expect(data.lines[compraFeriasIndex].value).toBe(600);
    expect(data.netSalary).toBe(1514.9);
    expect(data.lines.at(-1)?.value).toBe(1514.9);

    const diariaLine = data.lines.find((line) => line.label === "Diarias/Gratificações");
    expect(diariaLine?.value).toBe(150);

    expect(labels.includes("(+) Diarias/Gratificações (10 dias)")).toBe(false);
    expect(data.lines.filter((line) => line.label.includes("Compra de Férias")).length).toBe(1);
  });

  it("prioriza a canônica recalculada quando netSalary persistido está legado", () => {
    const legacyEntry: PayrollEntry = {
      ...entry,
      earnings: {
        salario_fiscal: 1762.2,
        he: 66.84,
      },
      deductions: {
        inss: 199.69,
        vales: 527.22,
        faltas: 77.73,
      },
      netSalary: 1762.2,
    };

    const rubrics = [
      makeRubric({ id: "salario_fiscal", name: "Salário Fiscal", code: "SALARIO_FISCAL", classification: null, order: 3 }),
      makeRubric({ id: "he", name: "Horas Extras", code: "HE", classification: "horas_extras", order: 5 }),
      makeRubric({ id: "inss", name: "INSS", code: "INSS", type: "desconto", classification: "inss", order: 10 }),
      makeRubric({ id: "vales", name: "Vales/Descontos", code: "VALES", type: "desconto", classification: "vales", order: 13 }),
      makeRubric({ id: "faltas", name: "Faltas/Descontos", code: "FALTAS", type: "desconto", classification: "faltas", order: 14 }),
      makeRubric({
        id: "salario_liquido",
        name: "Salário Líquido",
        code: "salario_liquido",
        nature: "calculada",
        calculationMethod: "formula",
        order: 15,
        formulaItems: [
          { id: "liq-1", operation: "add", sourceRubricId: "salario_fiscal", order: 1 },
          { id: "liq-2", operation: "add", sourceRubricId: "he", order: 2 },
          { id: "liq-3", operation: "subtract", sourceRubricId: "inss", order: 3 },
          { id: "liq-4", operation: "subtract", sourceRubricId: "vales", order: 4 },
          { id: "liq-5", operation: "subtract", sourceRubricId: "faltas", order: 5 },
        ],
      }),
    ];

    const data = buildReceiptData(legacyEntry, rubrics);

    // Comentário: recibo reutiliza a mesma canônica da Central e não o net_salary antigo.
    expect(data.netSalary).toBeCloseTo(1024.4, 2);
    expect(data.lines.at(-1)?.value).toBeCloseTo(1024.4, 2);
  });
});
