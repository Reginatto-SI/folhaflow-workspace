import { describe, expect, it } from "vitest";
import { buildReportSummaryData } from "@/lib/reportSummaryData";
import type { Company, Employee, PayrollBatch, PayrollEntry, Rubric } from "@/types/payroll";

const makeRubric = (overrides: Partial<Rubric>): Rubric => ({
  id: overrides.id ?? crypto.randomUUID(),
  name: overrides.name ?? "Rubrica",
  code: overrides.code ?? "RUB",
  type: overrides.type ?? "provento",
  nature: overrides.nature ?? "base",
  calculationMethod: overrides.calculationMethod ?? "manual",
  classification: overrides.classification ?? null,
  order: overrides.order ?? 1,
  isActive: overrides.isActive ?? true,
  formulaItems: overrides.formulaItems ?? [],
  allowManualOverride: overrides.allowManualOverride ?? false,
});

describe("buildReportSummaryData - rendimentos legado", () => {
  it("soma rubricas adicionais incluindo prêmio e compra de férias via outros_rendimentos", () => {
    const company = {
      id: "c1",
      name: "Empresa 1",
      cnpj: "00.000.000/0001-00",
      isActive: true,
      createdAt: "2026-01-01",
    } as unknown as Company;

    const batch = {
      id: "b1",
      companyId: "c1",
      month: 4,
      year: 2026,
      status: "em_edicao",
      isArchived: false,
      createdAt: "2026-04-01",
      closedAt: null,
      paymentDate: null,
      updatedAt: "2026-04-01",
      expectedEmployees: 1,
    } as unknown as PayrollBatch;

    const employee = {
      id: "e1",
      companyId: "c1",
      name: "Funcionario 1",
      cpf: "000.000.000-00",
      pis: null,
      registration: "1",
      department: "Adm",
      role: "Analista",
      admissionDate: "2025-01-01",
      status: "ativo",
      createdAt: "2025-01-01",
      updatedAt: "2026-04-01",
      baseSalary: null,
    } as unknown as Employee;

    const rubrics: Rubric[] = [
      makeRubric({ id: "sal_ctps", code: "SAL_CTPS", name: "Salário CTPS", classification: "salario_ctps", order: 1 }),
      makeRubric({ id: "sal_g", code: "SAL_G", name: "Salário G", classification: "salario_g", order: 2 }),
      makeRubric({ id: "outros", code: "OUTROS", name: "Outros Rend.", classification: "outros_rendimentos", order: 3 }),
      makeRubric({ id: "he", code: "HE", name: "Horas Extras", classification: "horas_extras", order: 4 }),
      makeRubric({ id: "ferias", code: "FERIAS", name: "1/3 Férias", classification: "ferias_terco", order: 5 }),
      makeRubric({ id: "insal", code: "INSAL", name: "Insalubridade", classification: "insalubridade", order: 6 }),
      makeRubric({ id: "premio", code: "PREMIO", name: "Prêmio/Desemp.", classification: "outros_rendimentos", order: 7 }),
      makeRubric({ id: "compra", code: "COMPRA_FERIAS", name: "Compra de Férias", classification: "outros_rendimentos", order: 8 }),
      makeRubric({ id: "sal_fiscal", code: "SAL_FISCAL", name: "Salário Fiscal", classification: null, nature: "calculada", calculationMethod: "formula", order: 9 }),
      makeRubric({ id: "sal_real", code: "SALARIO_REAL", name: "Salário Real", classification: null, nature: "calculada", calculationMethod: "formula", order: 10 }),
      makeRubric({ id: "g2", code: "G2_COMPLEMENTO", name: "Salário G2 complem.", classification: null, nature: "calculada", calculationMethod: "formula", order: 11 }),
      makeRubric({ id: "liq", code: "SALARIO_LIQUIDO", name: "Salário Líquido", classification: null, nature: "calculada", calculationMethod: "formula", order: 12 }),
      makeRubric({ id: "inss", code: "INSS", name: "INSS", type: "desconto", classification: "inss", order: 13 }),
    ];

    const entry = {
      id: "p1",
      companyId: "c1",
      employeeId: "e1",
      payrollBatchId: "b1",
      month: 4,
      year: 2026,
      earnings: {
        sal_ctps: 1000,
        sal_g: 2000,
        outros: 100,
        he: 200,
        ferias: 300,
        insal: 400,
        premio: 500,
        compra: 600,
        sal_fiscal: 700,
        sal_real: 800,
        g2: 900,
        liq: 1000,
      },
      deductions: { inss: 50 },
      inssAmount: 50,
      netSalary: 0,
      createdAt: "2026-04-01",
      updatedAt: "2026-04-01",
    } as unknown as PayrollEntry;


    const dataset = buildReportSummaryData({
      month: { month: 4, year: 2026 },
      companies: [company],
      allBatches: [batch],
      allEmployees: [employee],
      allEntries: [entry],
      rubrics,
    });

    const rendimentos = dataset.rows.find((r) => r.key === "__rendimentos__");
    expect(rendimentos).toBeTruthy();

    // Soma esperada: outros + horas extras + 1/3 férias + insalubridade + prêmio + compra férias
    expect(rendimentos?.total).toBe(2100);

    // Exclusões explícitas: salários-base/finais e descontos NÃO entram em Rendimentos.
    // Se qualquer item abaixo entrar indevidamente, o total deixaria de ser 2100.
    expect(rendimentos?.total).not.toBe(3100); // + salário CTPS
    expect(rendimentos?.total).not.toBe(4100); // + salário G
    expect(rendimentos?.total).not.toBe(2800); // + salário fiscal
    expect(rendimentos?.total).not.toBe(2900); // + salário real
    expect(rendimentos?.total).not.toBe(3000); // + G2 complemento
    expect(rendimentos?.total).not.toBe(3100); // + salário líquido
    expect(rendimentos?.total).not.toBe(2150); // + desconto (INSS)
  });
});
