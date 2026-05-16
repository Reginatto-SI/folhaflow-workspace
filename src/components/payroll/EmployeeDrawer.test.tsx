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

const legacyNameSalarioRealRubric: Rubric = {
  ...resultSalarioRealRubric,
  id: "rub-salario-real-legacy",
  code: "legacy_sal_real",
};

const legacyNameG2ComplementoRubric: Rubric = {
  ...resultG2ComplementoRubric,
  id: "rub-g2-legacy",
  code: "legacy_g2_comp",
  formulaItems: [
    { id: "item-g2-l-1", operation: "add", sourceRubricId: legacyNameSalarioRealRubric.id, order: 1 },
    { id: "item-g2-l-2", operation: "subtract", sourceRubricId: baseRubric.id, order: 2 },
  ],
};

const legacyNameSalarioLiquidoRubric: Rubric = {
  ...resultSalarioLiquidoRubric,
  id: "rub-salario-liquido-legacy",
  code: "legacy_sal_liq",
  formulaItems: [
    { id: "item-sl-l-1", operation: "add", sourceRubricId: legacyNameSalarioRealRubric.id, order: 1 },
    { id: "item-sl-l-2", operation: "subtract", sourceRubricId: deductionRubric.id, order: 2 },
  ],
};

const duplicateCodeSalarioRealRubric: Rubric = {
  ...resultSalarioRealRubric,
  id: "rub-salario-real-duplicate-code",
  name: "Salário Real Duplicado",
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
    expect(payload.earningsTotal).toBe(1500);
    expect(payload.deductionsTotal).toBe(0);
    expect(payload.netSalary).toBe(1500);

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

  it("emite prévia operacional para sincronizar tabela e totalizadores antes de salvar", async () => {
    const onPreviewChange = vi.fn();

    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, earningRubric, deductionRubric, resultSalarioRealRubric, resultG2ComplementoRubric, resultSalarioLiquidoRubric]}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onPreviewChange={onPreviewChange}
      />
    );

    const salaryInput = screen.getByTitle("SAL_BASE — Salário Base").closest("div")?.querySelector("input");
    const earningInput = screen.getByTitle("HEX — Horas Extras").closest("div")?.querySelector("input");

    fireEvent.change(salaryInput as HTMLInputElement, { target: { value: "1000,00" } });
    fireEvent.blur(salaryInput as HTMLInputElement);
    fireEvent.change(earningInput as HTMLInputElement, { target: { value: "250,00" } });
    fireEvent.blur(earningInput as HTMLInputElement);

    await waitFor(() => {
      const lastPreview = onPreviewChange.mock.calls.at(-1)?.[0] as PayrollEntry | null;
      expect(lastPreview?.earnings[baseRubric.id]).toBe(1000);
      expect(lastPreview?.earnings[earningRubric.id]).toBe(250);
      expect(lastPreview?.netSalary).toBe(1250);
    });
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


  it("separa salários base dos proventos e mantém resultados na ordem operacional", () => {
    const salarioCtpsRubric: Rubric = {
      ...baseRubric,
      id: "rub-salario-ctps-layout",
      name: "Salário CTPS",
      code: "SAL_CTPS",
      classification: "salario_ctps",
      order: 1,
    };
    const salarioGRubric: Rubric = {
      ...earningRubric,
      id: "rub-salario-g-layout",
      name: "Salário G",
      code: "SAL_G",
      classification: "salario_g",
      order: 2,
    };
    const salarioFiscalRubric: Rubric = {
      ...earningRubric,
      id: "rub-salario-fiscal-layout",
      name: "Salário Fiscal",
      code: "SAL_FISCAL",
      classification: "outros_rendimentos",
      order: 3,
    };
    const outrosRendimentosRubric: Rubric = {
      ...earningRubric,
      id: "rub-outros-rendimentos-layout",
      name: "Outros Rendimentos",
      code: "OUTROS",
      classification: "outros_rendimentos",
      order: 4,
    };

    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[
          salarioCtpsRubric,
          salarioGRubric,
          salarioFiscalRubric,
          outrosRendimentosRubric,
          deductionRubric,
          resultSalarioRealRubric,
          resultSalarioLiquidoRubric,
          resultG2ComplementoRubric,
        ]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const salariosBaseSection = screen.getByText("Salários Base").closest("section") as HTMLElement;
    expect(within(salariosBaseSection).getByTitle("SAL_CTPS — Salário CTPS")).toBeInTheDocument();
    expect(within(salariosBaseSection).getByTitle("SAL_G — Salário G")).toBeInTheDocument();
    expect(within(salariosBaseSection).getByTitle("SAL_FISCAL — Salário Fiscal")).toBeInTheDocument();
    expect(salariosBaseSection.querySelector(".grid")?.classList.contains("lg:grid-cols-4")).toBe(true);

    const proventosSection = screen.getByText("Proventos").closest("section") as HTMLElement;
    expect(within(proventosSection).getByTitle("OUTROS — Outros Rendimentos")).toBeInTheDocument();
    expect(within(proventosSection).queryByTitle("SAL_CTPS — Salário CTPS")).not.toBeInTheDocument();
    expect(proventosSection.querySelector(".grid")?.classList.contains("lg:grid-cols-4")).toBe(true);

    const descontosSection = screen.getByText("Descontos").closest("section") as HTMLElement;
    expect(descontosSection.querySelector(".grid")?.classList.contains("lg:grid-cols-4")).toBe(true);

    const resultadosSection = screen.getByText("Resultados").closest("section") as HTMLElement;
    const resultNames = within(resultadosSection)
      .getAllByText(/Salário Real|G2 Complemento|Salário Líquido/)
      .map((node) => node.textContent);
    expect(resultNames).toEqual(["Salário Real", "G2 Complemento", "Salário Líquido"]);
  });

  it("seleciona todo o valor monetário editável ao receber foco sem reselecionar em clique posterior", async () => {
    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={{
          ...entry,
          earnings: { [baseRubric.id]: 1500 },
        }}
        employee={employee}
        rubrics={[baseRubric, earningRubric, deductionRubric]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const salaryInput = screen.getByTitle("SAL_BASE — Salário Base").closest("div")?.querySelector("input") as HTMLInputElement;

    fireEvent.focus(salaryInput);

    await waitFor(() => {
      expect(salaryInput.selectionStart).toBe(0);
      expect(salaryInput.selectionEnd).toBe(salaryInput.value.length);
    });

    salaryInput.setSelectionRange(3, 3);
    fireEvent.click(salaryInput);

    expect(salaryInput.selectionStart).toBe(3);
    expect(salaryInput.selectionEnd).toBe(3);
  });

  it("renderiza rubrica manual ativa nova no drawer e salva por tipo", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const newManualRubric: Rubric = {
      id: "rub-new-manual",
      name: "Bônus manual",
      code: "BONUS",
      type: "provento",
      nature: "base",
      calculationMethod: "manual",
      classification: "outros_rendimentos",
      order: 9,
      isActive: true,
      allowManualOverride: true,
      formulaItems: [],
    };

    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, newManualRubric]}
        onSave={onSave}
      />
    );

    const bonusInput = screen.getByTitle("BONUS — Bônus manual").closest("div")?.querySelector("input") as HTMLInputElement;
    fireEvent.change(bonusInput, { target: { value: "250,00" } });
    fireEvent.blur(bonusInput);
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const payload = onSave.mock.calls[0][1] as Partial<PayrollEntry>;
    expect(payload.earnings?.[newManualRubric.id]).toBe(250);
    expect(payload.deductions?.[newManualRubric.id]).toBeUndefined();
    expect(payload.earningsTotal).toBe(250);
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
    expect(screen.queryByTitle("salario_liquido — Salário Líquido")).not.toBeInTheDocument();
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

  it("renderiza aviso de ausência canônica mesmo sem rubricas derivadas ativas", () => {
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

    expect(screen.getByText("Resultados")).toBeInTheDocument();
    expect(screen.getByText("Alguns resultados do sistema precisam ser revisados na configuração de rubricas. Consulte o responsável pelo sistema.")).toBeInTheDocument();
  });

  it("usa fallback legado no drawer sem divergir da resolução compartilhada", () => {
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
          legacyNameSalarioRealRubric,
          legacyNameG2ComplementoRubric,
          legacyNameSalarioLiquidoRubric,
        ]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByText("Resultados do sistema usando configuração legada de rubricas. Consulte o responsável pelo sistema.")).not.toBeInTheDocument();
    expect(screen.getByText("Salário Real")).toBeInTheDocument();
    expect(screen.getByText("G2 Complemento")).toBeInTheDocument();
    expect(screen.getByText("Salário Líquido")).toBeInTheDocument();
  });


  it("não exibe alerta nos valores validados do legado quando os três resultados canônicos foram calculados", () => {
    const salarioCtpsRubric: Rubric = {
      ...baseRubric,
      id: "rub-salario-ctps",
      name: "Salário CTPS",
      code: "SAL_CTPS",
      classification: "salario_ctps",
      order: 1,
    };
    const salarioGRubric: Rubric = {
      ...earningRubric,
      id: "rub-salario-g",
      name: "Salário G",
      code: "SAL_G",
      classification: "salario_g",
      order: 2,
    };
    const salarioFiscalRubric: Rubric = {
      ...earningRubric,
      id: "rub-salario-fiscal",
      name: "Salário Fiscal",
      code: "SAL_FISCAL",
      classification: "outros_rendimentos",
      order: 3,
    };
    const inssRubric: Rubric = {
      ...deductionRubric,
      id: "rub-inss",
      name: "INSS",
      code: "INSS",
      classification: "inss",
      order: 4,
    };
    const emprestimoRubric: Rubric = {
      ...deductionRubric,
      id: "rub-emprestimo",
      name: "Empréstimo consignado",
      code: "EMPRESTIMO",
      classification: "emprestimos",
      order: 5,
    };
    const valesRubric: Rubric = {
      ...deductionRubric,
      id: "rub-vales",
      name: "Vales / Descontos",
      code: "VALES",
      classification: "vales",
      order: 6,
    };
    const salarioRealRubric: Rubric = {
      ...resultSalarioRealRubric,
      calculationMethod: "valor_fixo",
      fixedValue: 6553.22,
      formulaItems: [],
      order: 7,
    };
    const g2ComplementoRubric: Rubric = {
      ...resultG2ComplementoRubric,
      calculationMethod: "valor_fixo",
      fixedValue: -1769.17,
      formulaItems: [],
      order: 8,
    };
    const salarioLiquidoRubric: Rubric = {
      ...resultSalarioLiquidoRubric,
      calculationMethod: "valor_fixo",
      fixedValue: 1514.9,
      formulaItems: [],
      order: 9,
    };

    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[
          salarioCtpsRubric,
          salarioGRubric,
          salarioFiscalRubric,
          inssRubric,
          emprestimoRubric,
          valesRubric,
          salarioRealRubric,
          g2ComplementoRubric,
          salarioLiquidoRubric,
        ]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const changeValue = (title: string, value: string) => {
      const input = screen.getByTitle(title).closest("div")?.querySelector("input") as HTMLInputElement;
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    };

    changeValue("SAL_CTPS — Salário CTPS", "3000");
    changeValue("SAL_G — Salário G", "7000");
    changeValue("SAL_FISCAL — Salário Fiscal", "3284,07");
    changeValue("INSS — INSS", "446,78");
    changeValue("EMPRESTIMO — Empréstimo consignado", "878,32");
    changeValue("VALES — Vales / Descontos", "4160");

    const resultadosSection = screen.getByText("Resultados").closest("section") as HTMLElement;
    expect(within(resultadosSection).queryByText(/precisam ser revisados|Configuração canônica incompleta|configuração legada/i)).not.toBeInTheDocument();
    expect(within(resultadosSection).getByText(/R\$\s*6\.553,22/)).toBeInTheDocument();
    expect(within(resultadosSection).getByText(/-R\$\s*1\.769,17/)).toBeInTheDocument();
    expect(within(resultadosSection).getByText(/R\$\s*1\.514,90/)).toBeInTheDocument();
  });

  it("mostra mensagem de ausência quando rubricas canônicas obrigatórias não existem", () => {
    render(
      <EmployeeDrawer
        open
        onOpenChange={() => {}}
        entry={entry}
        employee={employee}
        rubrics={[baseRubric, earningRubric, deductionRubric]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Alguns resultados do sistema precisam ser revisados na configuração de rubricas. Consulte o responsável pelo sistema.")).toBeInTheDocument();
  });

  it("mostra mensagem de conflito quando houver ambiguidade canônica", () => {
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
          duplicateCodeSalarioRealRubric,
          resultG2ComplementoRubric,
          resultSalarioLiquidoRubric,
        ]}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Configuração canônica incompleta: verifique salario_real, g2_complemento e salario_liquido.")).toBeInTheDocument();
  });
});
