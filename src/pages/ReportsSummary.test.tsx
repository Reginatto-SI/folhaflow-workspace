import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReportsSummary from "./ReportsSummary";

const payrollContextMock = vi.hoisted(() => ({
  usePayroll: vi.fn(),
}));

vi.mock("@/contexts/PayrollContext", () => payrollContextMock);

interface MockSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

interface MockSelectItemProps {
  value: string;
  children: React.ReactNode;
}

interface MockSummaryInput {
  month: { month: number; year: number };
}

vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: MockSelectProps) => (
    <select
      aria-label="Competência"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: MockSelectItemProps) => <option value={value}>{children}</option>,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

vi.mock("@/lib/reportSummaryData", () => ({
  buildReportSummaryData: ({ month }: MockSummaryInput) => ({
    title: `Resumo de Folha de Pagamento - ${month.month}/${month.year}`,
    competenceLabel: `${month.month}/${month.year}`,
    month: month.month,
    year: month.year,
    companies: [{ id: "empresa-1", name: "COMERCIAL", headcount: month.month === 4 ? 3 : 1 }],
    rows: [
      {
        key: "__headcount__",
        label: "Total de Funcionários",
        kind: "headcount",
        valuesByCompanyId: { "empresa-1": month.month === 4 ? 3 : 1 },
        total: month.month === 4 ? 3 : 1,
        semImob: month.month === 4 ? 3 : 1,
        isInteger: true,
        isBold: true,
      },
    ],
  }),
}));

vi.mock("@/lib/reportSummaryManagerial", () => ({
  buildManagerialSummary: () => null,
}));

vi.mock("@/lib/reportSummaryPdf", () => ({ generateReportSummaryPdf: vi.fn() }));
vi.mock("@/lib/reportSummaryExcel", () => ({ generateReportSummaryExcel: vi.fn() }));

describe("ReportsSummary", () => {
  it("mantém a competência escolhida no relatório mesmo quando ela não é a competência global da Central", () => {
    payrollContextMock.usePayroll.mockReturnValue({
      activeCompanies: [{ id: "empresa-1", name: "COMERCIAL", isActive: true }],
      allPayrollBatches: [
        { id: "batch-maio", companyId: "empresa-1", month: 5, year: 2026, isArchived: false },
        { id: "batch-abril", companyId: "empresa-2", month: 4, year: 2026, isArchived: false },
      ],
      allEmployees: [],
      allPayrollEntries: [],
      rubrics: [],
      isLoading: false,
      selectedMonth: { month: 5, year: 2026 },
    });

    render(<ReportsSummary />);

    expect(screen.getByText("Resumo de Folha de Pagamento - 5/2026")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Competência" }), {
      target: { value: "4/2026" },
    });

    expect(screen.getByText("Resumo de Folha de Pagamento - 4/2026")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Competência" })).toHaveValue("4/2026");
  });
});
