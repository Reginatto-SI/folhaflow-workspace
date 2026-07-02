import { describe, expect, it } from "vitest";

import { formatPayrollReportFilename } from "@/lib/payrollReportFilename";

describe("formatPayrollReportFilename", () => {
  it("formata o nome operacional do PDF mantendo espaços e caixa alta", () => {
    expect(formatPayrollReportFilename({ competencia: { month: 6, year: 2026 }, empresaNome: "COND GRUPO", extension: "pdf" })).toBe(
      "JUNHO -26 - Folha de Pagamento COND GRUPO.pdf",
    );
  });

  it("formata o nome operacional do Excel a partir de string de competência", () => {
    expect(formatPayrollReportFilename({ competencia: "julho de 2026", empresaNome: "Comercial", extension: "xlsx" })).toBe(
      "JULHO -26 - Folha de Pagamento COMERCIAL.xlsx",
    );
  });

  it("aceita Date e remove caracteres inválidos sem transformar o nome da empresa em slug", () => {
    expect(formatPayrollReportFilename({ competencia: new Date(2026, 2, 1), empresaNome: "Empresa Ágil / Matriz", extension: "pdf" })).toBe(
      "MARÇO -26 - Folha de Pagamento EMPRESA ÁGIL MATRIZ.pdf",
    );
  });
});
