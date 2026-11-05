import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import PayrollTable from "@/components/payroll/PayrollTable";
import { calculatePayrollFromEntry } from "@/lib/payrollSpreadsheet";
import { buildReportByCompanyData } from "@/lib/reportByCompanyData";
import { buildFinancialSheetData, buildReportByCompanyWorkbook } from "@/lib/reportByCompanyExcel";
import type { Company, Employee, PayrollEntry, Rubric, RubricFormulaItem } from "@/types/payroll";

vi.mock("@/contexts/PayrollContext", () => ({ usePayroll: () => ({}) }));
afterEach(cleanup);

const base = (code: string, type: Rubric["type"] = "provento"): Rubric => ({
  id: `id-${code}`, code, name: `Label alterado ${code}`, type, nature: "base",
  calculationMethod: "manual", classification: code === "2" ? "salario_g" : "outros_rendimentos",
  isActive: true, order: 99, formulaItems: [], allowManualOverride: true,
});
const item = (code: string, operation: RubricFormulaItem["operation"], order: number): RubricFormulaItem => ({
  id: `${code}-${order}`, sourceRubricId: `id-${code}`, operation, order,
});
const additions = ["4", "5", "6", "8", "9"];
const deductions = ["14", "11", "10", "13"];
const existingG2 = [item("2", "add", 1), item("salario_fiscal", "subtract", 2),
  ...deductions.map((code, i) => item(code, "subtract", i + 3)),
  ...additions.map((code, i) => item(code, "add", i + 7))];
const derived = (code: string, formulaItems: RubricFormulaItem[]): Rubric => ({
  ...base(code), nature: "calculada", calculationMethod: "formula", classification: null,
  formulaItems, allowManualOverride: false,
});
const rubrics = (code: string, corrected: boolean): Rubric[] => [
  base("2"), base("salario_fiscal"), base("18"), ...additions.map((c) => base(c)),
  ...deductions.map((c) => base(c, "desconto")),
  derived("salario_real", [item("2", "add", 1)]),
  derived(code, corrected ? [...existingG2, item("18", "add", 12)] : existingG2),
  // Líquido já inclui Comissão diretamente: sua fórmula não muda com G2.
  derived("salario_liquido", [item("2", "add", 1), ...deductions.map((c, i) => item(c, "subtract", i + 2)),
    ...additions.map((c, i) => item(c, "add", i + 6)), item("18", "add", 11)]),
];
const employee: Employee = { id: "e", companyId: "c", name: "Funcionário de homologação", cpf: "",
  workerType: "mensalista", isMonthly: true, isOnLeave: false, isActive: true };
const company: Company = { id: "c", name: "FILIAL CBA", cnpj: "", address: "", isActive: true };
const entry = (commission: number): PayrollEntry => ({ id: "p", employeeId: "e", companyId: "c", month: 10, year: 2026,
  baseSalary: 0, earnings: { "id-2": 3300.95, "id-salario_fiscal": 2340.95, "id-18": commission,
    // Saídas antigas persistidas não devem prevalecer sobre o motor compartilhado.
    "id-g2_complemento": 600, "id-salario_liquido": 9999 },
  deductions: { "id-10": 360 }, notes: "" });

describe.each(["g2_complemento", "salario_g2_complemento"])("Comissão no G2 (%s)", (code) => {
  it.each([700, 0])("preserva fiscal/líquido e alinha Central e Excel com comissão %s", async (commission) => {
    const before = rubrics(code, false);
    const after = rubrics(code, true);
    const currentEntry = entry(commission);
    const previous = calculatePayrollFromEntry({ entry: currentEntry, rubrics: before });
    const computed = calculatePayrollFromEntry({ entry: currentEntry, rubrics: after });
    expect(previous.g2Complemento).toBeCloseTo(600, 2);
    expect(computed.g2Complemento).toBeCloseTo(600 + commission, 2);
    expect(computed.salarioLiquido).toBeCloseTo(2940.95 + commission, 2);
    expect(computed.salarioLiquido).toBe(previous.salarioLiquido);
    expect(computed.salarioReal).toBe(previous.salarioReal);
    expect(computed.valuesByRubricId["id-salario_fiscal"]).toBe(2340.95);
    expect(after.find((r) => r.code === "salario_liquido")).toEqual(before.find((r) => r.code === "salario_liquido"));

    render(<PayrollTable entries={[currentEntry]} rubrics={after} allEmployees={[employee]}
      allDepartments={[]} allJobRoles={[]} onRowClick={vi.fn()} onToggleConferido={vi.fn()}
      sortKey="employee" sortDirection="asc" onSortChange={vi.fn()} />);
    const row = screen.getByText(employee.name).closest("tr")!;
    const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(within(row).getByText(fmt(600 + commission), { exact: false })).toBeTruthy();
    expect(within(row).getByText(fmt(2940.95 + commission), { exact: false })).toBeTruthy();
    const dataset = buildReportByCompanyData({ company, month: { month: 10, year: 2026 }, batch: null,
      allEmployees: [employee], allEntries: [currentEntry], rubrics: after });
    expect(buildFinancialSheetData(dataset)[3].slice(8, 11).map((cell) => cell.v))
      .toEqual([2340.95, computed.g2Complemento, computed.salarioLiquido]);
    const workbook = await buildReportByCompanyWorkbook(dataset);
    expect(workbook.getWorksheet("Financeiro")!.getRow(4).values).toEqual(expect.arrayContaining([
      2340.95, computed.g2Complemento, computed.salarioLiquido,
    ]));
  });
});
