import React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const resultSalarioRealRubric: Rubric = {
  id: "rub-salario-real",
  name: "Salário Real",
  code: "salario_real",
  type: "provento",
  nature: "calculada",
  calculationMethod: "formula",
  classification: null,
  order: 4,
  isActive: true,
  allowManualOverride: false,
  formulaItems: [
    { id: "item-sr-1", operation: "add", sourceRubricId: baseRubric.id, order: 1 },
    { id: "item-sr-2", operation: "add", sourceRubricId: earningRubric.id, order: 2 },
  ],
};

const resultG2ComplementoRubric: Rubric = {
  id: "rub-g2",
  name: "G2 Complemento",
  code: "g2_complemento",
  type: "provento",
  nature: "calculada",
  calculationMethod: "formula",
  classification: null,
  order: 5,
  isActive: true,
  allowManualOverride: false,
  formulaItems: [
    { id: "item-g2-1", operation: "add", sourceRubricId: resultSalarioRealRubric.id, order: 1 },
    { id: "item-g2-2", operation: "subtract", sourceRubricId: baseRubric.id, order: 2 },
  ],
};

const resultSalarioLiquidoRubric: Rubric = {
  id: "rub-salario-liquido",
  name: "Salário Líquido",
  code: "salario_liquido",
  type: "provento",
  nature: "calculada",
  calculationMethod: "formula",
  classification: null,
  order: 6,
  isActive: true,
  allowManualOverride: false,
  formulaItems: [
    { id: "item-sl-1", operation: "add", sourceRubricId: resultSalarioRealRubric.id, order: 1 },
    { id: "item-sl-2", operation: "subtract", sourceRubricId: deductionRubric.id, order: 2 },
  ],
};

const noDerivedRubric: Rubric = {
  id: "rub-no-derived",
  name: "Resultado Técnico",
  code: "resultado_tecnico",
  type: "provento",
  nature: "calculada",
  calculationMethod: "formula",
  classification: null,
  order: 6,
  isActive: false,
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

    expect((salaryInput as HTMLInputElement).value).toBe("R$ 1.500,00");
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

  it("não exibe bloco técnico de derivados e preserva ações do drawer", () => {
    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, resultSalarioLiquidoRubric]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText(/Campos derivados \(readonly\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Salário Líquido$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Gerar recibo" })).toBeDisabled();
  });

  it("recalcula resultados em tempo real no preview local sem depender de salvar", () => {
    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[
          baseRubric,
          earningRubric,
          deductionRubric,
          resultSalarioRealRubric,
          resultG2ComplementoRubric,
          resultSalarioLiquidoRubric,
        ]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const salaryBaseInput = screen.getByTitle("SAL_BASE — Salário Base").closest("div")?.querySelector("input") as HTMLInputElement;
    const horasExtrasInput = screen.getByTitle("HEX — Horas Extras").closest("div")?.querySelector("input") as HTMLInputElement;
    const descontoInput = screen.getByTitle("VAL — Vale").closest("div")?.querySelector("input") as HTMLInputElement;

    fireEvent.change(salaryBaseInput, { target: { value: "1000,00" } });
    fireEvent.blur(salaryBaseInput);
    fireEvent.change(horasExtrasInput, { target: { value: "200,00" } });
    fireEvent.blur(horasExtrasInput);
    fireEvent.change(descontoInput, { target: { value: "100,00" } });
    fireEvent.blur(descontoInput);

    const resultadosSection = screen.getByText("Resultados").closest("section") as HTMLElement;
    expect(within(resultadosSection).getByText("Salário Real")).toBeInTheDocument();
    expect(within(resultadosSection).getByText("G2 Complemento")).toBeInTheDocument();
    expect(within(resultadosSection).getByText("Salário Líquido")).toBeInTheDocument();
    expect(within(resultadosSection).getByText(/R\$\s*1\.200,00/)).toBeInTheDocument();
    expect(within(resultadosSection).getByText(/R\$\s*200,00/)).toBeInTheDocument();
    expect(within(resultadosSection).getByText(/R\$\s*1\.100,00/)).toBeInTheDocument();

    // Prova de recálculo local em tempo real: ao editar input manual, resultado muda sem salvar.
    fireEvent.change(horasExtrasInput, { target: { value: "300,00" } });
    fireEvent.blur(horasExtrasInput);

    expect(within(resultadosSection).getByText(/R\$\s*1\.300,00/)).toBeInTheDocument();
    expect(within(resultadosSection).getByText(/R\$\s*300,00/)).toBeInTheDocument();
    expect(within(resultadosSection).getByText(/R\$\s*1\.200,00/)).toBeInTheDocument();
  });

  it("não renderiza o card de resultados quando não houver rubricas derivadas ativas", () => {
    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, earningRubric, deductionRubric, noDerivedRubric]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText("Resultados")).not.toBeInTheDocument();
  });
});
