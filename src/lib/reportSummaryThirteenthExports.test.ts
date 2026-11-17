import { expect, it, vi } from "vitest";
import { utils, writeFile } from "xlsx";
import autoTable from "jspdf-autotable";
import type { ReportSummaryDataset } from "@/lib/reportSummaryData";
import { generateReportSummaryExcel } from "@/lib/reportSummaryExcel";
import { generateReportSummaryPdf } from "@/lib/reportSummaryPdf";

vi.mock("xlsx", async (importOriginal) => ({
  ...await importOriginal<typeof import("xlsx")>(),
  writeFile: vi.fn(),
}));
vi.mock("jspdf-autotable", () => ({ default: vi.fn() }));
vi.mock("jspdf", async (importOriginal) => {
  const { jsPDF } = await importOriginal<typeof import("jspdf")>();
  return {
    default: class extends jsPDF {
      save = vi.fn() as InstanceType<typeof jsPDF>["save"];
    },
  };
});

it("inclui os dois valores no PDF e Excel do Resumo Completo", () => {
  const dataset: ReportSummaryDataset = {
    title: "Resumo do 13º",
    competenceLabel: "13º - 1ª parcela",
    month: 13,
    year: 2026,
    companies: [{ id: "empresa", name: "Empresa", headcount: 1 }],
    rows: [
      {
        key: "reference", label: "Salário Total", kind: "reference", valuesByCompanyId: {},
        total: 0, semImob: 0, manualPresence: { total: false, semImob: false },
      },
      {
        key: "managerial", label: "Salário G. 13º", kind: "rubric", rubricType: "provento",
        valuesByCompanyId: { empresa: 0 }, total: 0, semImob: 0,
        manualPresence: { total: true, semImob: true },
      },
    ],
  };

  generateReportSummaryExcel(dataset);
  const workbook = vi.mocked(writeFile).mock.calls[0][0];
  const rows = utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
  expect(rows).toContainEqual(["Salário Total", "", "", ""]);
  expect(rows).toContainEqual(["Salário G. 13º", 0, 0, 0]);

  generateReportSummaryPdf(dataset);
  const pdfRows = vi.mocked(autoTable).mock.calls[0][1].body;
  expect(pdfRows).toContainEqual(["Salário Total", "", "", ""]);
  expect(pdfRows).toContainEqual(["Salário G. 13º", "R$0,00", "R$0,00", "R$0,00"]);
});
