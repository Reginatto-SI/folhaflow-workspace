import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserOptions } from "jspdf-autotable";

const { doc, autoTableMock } = vi.hoisted(() => ({
  doc: {
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    lastAutoTable: { finalY: 30 },
    addPage: vi.fn(), setPage: vi.fn(), setFont: vi.fn(), setFontSize: vi.fn(),
    setTextColor: vi.fn(), setDrawColor: vi.fn(), setLineWidth: vi.fn(),
    line: vi.fn(), text: vi.fn(), save: vi.fn(), getNumberOfPages: () => 3,
    splitTextToSize: (text: string) => [text],
  },
  autoTableMock: vi.fn(),
}));
vi.mock("jspdf", () => ({ default: vi.fn().mockImplementation(() => doc) }));
vi.mock("jspdf-autotable", () => ({ default: autoTableMock }));

import { generateDashboardPdf, type DashboardPdfData } from "./dashboardPdf";

const fixture = (): DashboardPdfData => ({
  baseCompetence: { month: 10, year: 2026, label: "outubro de 2026" },
  comparisonLabel: "setembro de 2026",
  companyName: "Todas as empresas",
  statuses: [
    { period: "Competência base", competence: "outubro de 2026", summary: "1 finalizada · 1 em edição", detail: null },
    { period: "Comparação", competence: "setembro de 2026", summary: "2 folhas finalizadas", detail: null },
  ],
  provisional: true,
  indicators: [
    { label: "Salário Líquido", current: "R$ 1.635,00", previous: "R$ 2.000,00", difference: "-R$ 365,00", percentage: "-18,25%" },
    { label: "Descontos", current: "R$ 0,00", previous: "—", difference: "—", percentage: "—" },
  ],
  indicatorNotes: ["Funcionários: contagem de registros, não necessariamente pessoas únicas."],
  evolution: [["set. de 2026", "R$ 0,00", "—"], ["out. de 2026", "R$ 350,00", "R$ 1.635,00"]],
  highlights: [["Maior aumento (R$)", "—", "—"], ["Maior redução (R$)", "Empresa Árvore", "-R$ 365,00"]],
  ranking: Array.from({ length: 8 }, (_, index) => [`Empresa ${index}`, "R$ 1.635,00", "R$ 2.000,00", "-R$ 365,00", "-18,25%", "0"]),
  composition: [{ label: "G2 Complemento", current: "R$ 350,00", previous: "—", difference: "—", percentage: "—" }],
});

const options = () => autoTableMock.mock.calls.map((call) => call[1] as UserOptions);
const tableWithHeading = (heading: string) => options().find((option) => option.head?.[0]?.[0] === heading);

beforeEach(() => {
  vi.clearAllMocks();
  doc.save.mockResolvedValue(undefined);
  autoTableMock.mockImplementation((_doc: unknown, option: UserOptions) => { doc.lastAutoTable.finalY = Number(option.startY) + 10; });
});

describe("PDF gerencial do Dashboard", () => {
  it("preserva textos e valores apresentados, inclusive negativos, zeros e indisponibilidade, sem modificar a entrada", async () => {
    const data = fixture();
    const original = structuredClone(data);
    await generateDashboardPdf(data);
    expect(tableWithHeading("Indicador")?.body).toEqual([
      ["Salário Líquido", "R$ 1.635,00", "R$ 2.000,00", "-R$ 365,00", "-18,25%"],
      ["Descontos", "R$ 0,00", "—", "—", "—"],
    ]);
    expect(tableWithHeading("Competência")?.body).toEqual(data.evolution);
    expect(tableWithHeading("Grupo")?.body).toEqual([["G2 Complemento", "R$ 350,00", "—", "—", "—"]]);
    expect(data).toEqual(original);
  });

  it("exporta todas as empresas comparáveis, na ordem recebida, sem limitar às seis do gráfico", async () => {
    const data = fixture();
    await generateDashboardPdf(data);
    expect(tableWithHeading("Empresa")?.body).toEqual(data.ranking);
    expect(tableWithHeading("Empresa")?.body).toHaveLength(8);
    expect(tableWithHeading("Indicador")?.styles?.halign).toBe("right");
  });

  it("omite ranking e destaques quando o painel não os disponibiliza, sem inventar comparação", async () => {
    const data = fixture();
    data.companyName = "Empresa Árvore";
    data.comparisonLabel = null;
    data.statuses = data.statuses.slice(0, 1);
    data.ranking = [];
    data.highlights = [];
    data.indicators.forEach((row) => { row.previous = "—"; row.difference = "—"; row.percentage = "—"; });
    await generateDashboardPdf(data);
    expect(tableWithHeading("Empresa")).toBeUndefined();
    expect(doc.text).not.toHaveBeenCalledWith("Principais variações", expect.anything(), expect.anything());
    expect(doc.text.mock.calls.some(([text]) => typeof text === "string" && text.startsWith("Comparação:"))).toBe(false);
    expect(tableWithHeading("Indicador")?.body?.[0]).toEqual(["Salário Líquido", "R$ 1.635,00", "—", "—", "—"]);
  });

  it("reproduz status não consolidado e aviso provisório; não usa aviso quando a base está finalizada", async () => {
    const data = fixture();
    data.statuses[0].summary = "Status não consolidado";
    data.statuses[0].detail = "Há múltiplas folhas não arquivadas para 1 empresa nesta competência.";
    await generateDashboardPdf(data);
    expect(tableWithHeading("Período")?.body?.[0]).toEqual(["Competência base", "outubro de 2026", `${data.statuses[0].summary}\n${data.statuses[0].detail}`]);
    expect(options().some((option) => JSON.stringify(option.body).includes("enquanto houver folhas em andamento"))).toBe(true);
    autoTableMock.mockClear();
    data.provisional = false;
    data.statuses[0].summary = "2 folhas finalizadas";
    data.statuses[0].detail = null;
    await generateDashboardPdf(data);
    expect(options().some((option) => JSON.stringify(option.body).includes("enquanto houver folhas em andamento"))).toBe(false);
  });

  it("inclui identificação institucional e paginação em todas as páginas e sanitiza o nome do arquivo", async () => {
    const data = fixture();
    data.companyName = 'Indústria / São José: "Matriz"?';
    await generateDashboardPdf(data);
    expect(doc.setPage.mock.calls).toEqual([[1], [2], [3]]);
    for (const page of [1, 2, 3]) expect(doc.text).toHaveBeenCalledWith(`Página ${page} de 3`, expect.any(Number), expect.any(Number), { align: "center" });
    expect(doc.text.mock.calls.filter(([text]) => text === "Gerado por Reginatto SI — www.reginattosistemas.com.br — Contato: (65) 99210-2030")).toHaveLength(3);
    expect(doc.save).toHaveBeenCalledWith("Dashboard_Folha_2026-10_Industria_Sao_Jose_Matriz.pdf", { returnPromise: true });
  });

  it("propaga a falha do download para que o Dashboard informe o erro", async () => {
    doc.save.mockRejectedValueOnce(new Error("Falha ao salvar"));
    await expect(generateDashboardPdf(fixture())).rejects.toThrow("Falha ao salvar");
  });
});
