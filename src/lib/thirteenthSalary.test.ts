import { describe, expect, it } from "vitest";
import { buildReceiptData } from "./receiptData";
import {
  THIRTEENTH_FIRST_CODE,
  THIRTEENTH_SECOND_CODE,
  batchTypeFromMonth,
  formatCompetenceLabel,
  monthFromDb,
  toDbMonth,
} from "./competence";
import { formatPayrollReportFilename } from "./payrollReportFilename";
import { getSuggestedPaymentDate } from "@/contexts/PayrollContext";
import { PayrollEntry, Rubric } from "@/types/payroll";

const rubric = (o: Partial<Rubric>): Rubric => ({
  id: "r", name: "R", code: "R", type: "provento", nature: "base", calculationMethod: "manual",
  classification: null, order: 1, isActive: true, formulaItems: [], allowManualOverride: true, ...o,
});

const rubrics: Rubric[] = [
  rubric({ id: "g", name: "Salário G", code: "2", classification: "salario_g", order: 2 }),
  rubric({ id: "inss", name: "(-)INSS", code: "10", type: "desconto", classification: "inss", order: 11 }),
  rubric({ id: "adiant", name: "(-) Adiant Geren.", code: "12", type: "desconto", classification: "adiantamentos", order: 13 }),
  rubric({
    id: "liq", name: "Salário Líquido", code: "salario_liquido", nature: "calculada", calculationMethod: "formula", order: 18,
    formulaItems: [
      { id: "1", operation: "add", sourceRubricId: "g", order: 1 },
      { id: "2", operation: "subtract", sourceRubricId: "inss", order: 2 },
      { id: "3", operation: "subtract", sourceRubricId: "adiant", order: 3 },
    ],
  }),
];

const entry = (month: number, earnings: Record<string, number>, deductions: Record<string, number>): PayrollEntry => ({
  id: "e", employeeId: "emp", companyId: "c", month, year: 2026, baseSalary: 0, earnings, deductions, notes: "",
});

describe("13º salário — competências", () => {
  it("nunca grava mês no banco para 13º e preserva meses mensais", () => {
    expect(toDbMonth(THIRTEENTH_FIRST_CODE)).toBeNull();
    expect(toDbMonth(THIRTEENTH_SECOND_CODE)).toBeNull();
    expect(toDbMonth(11)).toBe(11);
    expect(batchTypeFromMonth(THIRTEENTH_FIRST_CODE)).toBe("13_primeira");
    expect(batchTypeFromMonth(THIRTEENTH_SECOND_CODE)).toBe("13_segunda");
    expect(batchTypeFromMonth(12)).toBe("mensal");
    expect(monthFromDb(null, "13_segunda")).toBe(THIRTEENTH_SECOND_CODE);
    expect(monthFromDb(12, "mensal")).toBe(12);
  });

  it("rotula as parcelas no seletor", () => {
    expect(formatCompetenceLabel(THIRTEENTH_FIRST_CODE, 2026)).toBe("13º Salário — 1ª Parcela / 2026");
    expect(formatCompetenceLabel(THIRTEENTH_SECOND_CODE, 2026)).toBe("13º Salário — 2ª Parcela / 2026");
  });

  it("não sugere dia 5 automaticamente para 13º, mantendo a regra mensal", () => {
    expect(getSuggestedPaymentDate(THIRTEENTH_FIRST_CODE, 2026)).toBeNull();
    expect(getSuggestedPaymentDate(THIRTEENTH_SECOND_CODE, 2026)).toBeNull();
    expect(getSuggestedPaymentDate(12, 2026)).toBe("2027-01-05");
  });

  it("identifica a parcela no nome do arquivo exportado", () => {
    expect(formatPayrollReportFilename({ competencia: { month: THIRTEENTH_FIRST_CODE, year: 2026 }, empresaNome: "Comercial", extension: "pdf" }))
      .toBe("13º SALÁRIO 1ª PARCELA -26 - Folha de Pagamento COMERCIAL.pdf");
  });
});

describe("13º salário — recibo", () => {
  it("1ª parcela: Salário G aparece como 13º 1ª Parcela e líquido = valor lançado", () => {
    const data = buildReceiptData(entry(THIRTEENTH_FIRST_CODE, { g: 2500 }, {}), rubrics);
    expect(data.lines[0]).toMatchObject({ label: "13º Salário — 1ª Parcela", value: 2500 });
    expect(data.netSalary).toBe(2500);
  });

  it("2ª parcela: 13º integral − adiantamento da 1ª parcela − INSS", () => {
    const data = buildReceiptData(entry(THIRTEENTH_SECOND_CODE, { g: 5000 }, { adiant: 2500, inss: 400 }), rubrics);
    expect(data.lines[0]).toMatchObject({ label: "13º Salário", value: 5000 });
    expect(data.lines.find((l) => l.label === "Adiantamento da 1ª Parcela")?.value).toBe(2500);
    expect(data.netSalary).toBe(2100);
  });

  it("folha mensal mantém os rótulos originais", () => {
    const data = buildReceiptData(entry(11, { g: 5000 }, { adiant: 100 }), rubrics);
    expect(data.lines[0].label).toBe("Salário Bruto");
    expect(data.lines.some((l) => l.label === "Adiant. Gerencial")).toBe(true);
  });
});
