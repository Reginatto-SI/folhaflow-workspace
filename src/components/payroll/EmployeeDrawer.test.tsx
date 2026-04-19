import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmployeeDrawer from "@/components/payroll/EmployeeDrawer";
import { Employee, PayrollEntry, Rubric } from "@/types/payroll";

const employee: Employee = {
  id: "emp-1",
  companyId: "comp-1",
  name: "João Silva",
  cpf: "12345678900",
  admissionDate: "2024-01-01",
  isMonthly: true,
  isOnLeave: false,
  isActive: true,
};

const baseRubric: Rubric = {
  id: "rub-base",
  name: "Salário Base",
  code: "SAL_BASE",
  type: "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: "salario_ctps",
  order: 1,
  isActive: true,
  allowManualOverride: true,
  formulaItems: [],
};

const earningRubric: Rubric = {
  id: "rub-earn",
  name: "Horas Extras",
  code: "HEX",
  type: "provento",
  nature: "base",
  calculationMethod: "manual",
  classification: "horas_extras",
  order: 2,
  isActive: true,
  allowManualOverride: true,
  formulaItems: [],
};

const deductionRubric: Rubric = {
  id: "rub-disc",
  name: "Vale",
  code: "VAL",
  type: "desconto",
  nature: "base",
  calculationMethod: "manual",
  classification: "vales",
  order: 3,
  isActive: true,
  allowManualOverride: true,
  formulaItems: [],
};

const derivedRubric: Rubric = {
  id: "rub-derived",
  name: "Salário Líquido Derivado",
  code: "SAL_LIQ",
  type: "provento",
  nature: "calculada",
  calculationMethod: "formula",
  classification: null,
  order: 4,
  isActive: true,
  allowManualOverride: false,
  formulaItems: [],
};

const entry: PayrollEntry = {
  id: "entry-1",
  employeeId: "emp-1",
  companyId: "comp-1",
  month: 3,
  year: 2026,
  baseSalary: 0,
  earnings: {},
  deductions: {},
  notes: "",
};

describe("EmployeeDrawer", () => {
  it("persiste e reidrata rubrica-base pelo mesmo contrato de earnings por rubric.id", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, earningRubric, deductionRubric]}
        onSave={onSave}
      />
    );

    const salaryInput = screen.getByTitle("SAL_BASE — Salário Base").closest("div")?.querySelector("input");
    expect(salaryInput).toBeTruthy();

    fireEvent.change(salaryInput as HTMLInputElement, { target: { value: "1500,00" } });
    fireEvent.blur(salaryInput as HTMLInputElement);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const payload = onSave.mock.calls[0][1] as Partial<PayrollEntry>;
    expect(payload.baseSalary).toBe(1500);
    expect(payload.earnings?.[baseRubric.id]).toBe(1500);

    const persistedEntry: PayrollEntry = {
      ...entry,
      baseSalary: 1500,
      earnings: {
        [baseRubric.id]: 1500,
      },
    };

    rerender(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={persistedEntry}
        employee={employee}
        rubrics={[baseRubric, earningRubric, deductionRubric]}
        onSave={onSave}
      />
    );

    expect((salaryInput as HTMLInputElement).value).toBe("1500.00");
  });

  it("parseia valor pt-BR com milhar e decimal sem zerar indevidamente", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, earningRubric, deductionRubric]}
        onSave={onSave}
      />
    );

    const salaryInput = screen.getByTitle("SAL_BASE — Salário Base").closest("div")?.querySelector("input") as HTMLInputElement;
    fireEvent.change(salaryInput, { target: { value: "1.234.567,89" } });
    fireEvent.blur(salaryInput);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const payload = onSave.mock.calls[0][1] as Partial<PayrollEntry>;
    expect(payload.earnings?.[baseRubric.id]).toBe(1234567.89);
    expect(payload.baseSalary).toBe(1234567.89);
  });

  it("exibe rubricas derivadas como readonly e preserva ações do drawer", () => {
    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, derivedRubric]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText(/Salário Líquido Derivado/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Gerar recibo" })).toBeDisabled();
  });
});
