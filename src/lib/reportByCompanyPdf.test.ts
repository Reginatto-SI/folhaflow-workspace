import { describe, expect, it } from "vitest";
import {
  buildPayrollPdfDynamicColumns,
  formatJobRoleForPrint,
  formatPdfCurrencyBlankWhenZero,
  getPayrollPdfBodyColumnHalign,
  getPayrollPdfBodyColumnStyle,
  isHighlightedPayrollPdfColumn,
} from "@/lib/reportByCompanyPdf";
import type { ReportByCompanyDataset, ReportDynamicColumn } from "@/lib/reportByCompanyData";

const column = (overrides: Partial<ReportDynamicColumn> & Pick<ReportDynamicColumn, "rubricId" | "rubricName" | "order">): ReportDynamicColumn => ({
  rubricId: overrides.rubricId,
  rubricCode: overrides.rubricCode ?? overrides.rubricId,
  rubricName: overrides.rubricName,
  rubricType: overrides.rubricType ?? "provento",
  rubricClassification: overrides.rubricClassification ?? null,
  order: overrides.order,
  isCanonicalSalarioReal: overrides.isCanonicalSalarioReal ?? false,
});

const datasetWithColumns = (dynamicColumns: ReportDynamicColumn[]): ReportByCompanyDataset => ({
  title: "Folha - Empresa (ABRIL DE 26)",
  companyName: "Empresa",
  competenceLabel: "ABRIL DE 26",
  month: 4,
  year: 2026,
  fixedColumns: [
    { key: "name", label: "Nome" },
    { key: "department", label: "Setor" },
    { key: "jobRole", label: "Função" },
    { key: "admissionRegistration", label: "Admissão / Registro" },
  ],
  dynamicColumns,
  rows: [],
  totalsByRubricId: {},
});

const officialColumns = [
  column({ rubricId: "liquido", rubricCode: "salario_liquido", rubricName: "Salário Líquido", order: 18 }),
  column({ rubricId: "ctps", rubricCode: "salario_ctps", rubricName: "Salário CTPS", rubricClassification: "salario_ctps", order: 99 }),
  column({ rubricId: "real", rubricCode: "salario_real", rubricName: "Salário Real", order: 17, isCanonicalSalarioReal: true }),
  column({ rubricId: "vales", rubricCode: "VALES", rubricName: "Vales / Descontos", rubricType: "desconto", rubricClassification: "vales", order: 14 }),
  column({ rubricId: "salario_g", rubricCode: "SALARIO_G", rubricName: "Salário G", rubricClassification: "salario_g", order: 6 }),
  column({ rubricId: "compra", rubricCode: "COMPRA_FERIAS", rubricName: "Compra de Férias", rubricClassification: "outros_rendimentos", order: 12 }),
  column({ rubricId: "outros", rubricCode: "OUTROS_RENDIMENTOS", rubricName: "(+) Outros Rendim.", rubricClassification: "outros_rendimentos", order: 7 }),
  column({ rubricId: "fiscal", rubricCode: "SALARIO_FISCAL", rubricName: "Salário Fiscal", order: 16 }),
  column({ rubricId: "horas", rubricCode: "HORAS_EXTRAS", rubricName: "(+) Horas Extras", rubricClassification: "horas_extras", order: 8 }),
  column({ rubricId: "g2", rubricCode: "g2_complemento", rubricName: "Salário G2 complem.", order: 17 }),
  column({ rubricId: "ferias", rubricCode: "FERIAS_TERCO", rubricName: "(+) 1/3 de Férias", rubricClassification: "ferias_terco", order: 9 }),
  column({ rubricId: "faltas", rubricCode: "FALTAS", rubricName: "Faltas / Desconto", rubricType: "desconto", rubricClassification: "faltas", order: 15 }),
  column({ rubricId: "premio", rubricCode: "PREMIO_DESEMP", rubricName: "Premio.Desemp.", rubricClassification: "outros_rendimentos", order: 10 }),
  column({ rubricId: "inss", rubricCode: "INSS", rubricName: "INSS", rubricType: "desconto", rubricClassification: "inss", order: 13 }),
  column({ rubricId: "emprestimos", rubricCode: "EMPREST_CONSIG", rubricName: "Emprést. Consig.", rubricType: "desconto", rubricClassification: "emprestimos", order: 11 }),
  column({ rubricId: "desconhecida", rubricCode: "INSALUBRIDADE", rubricName: "Insalubridade", rubricClassification: "insalubridade", order: 5 }),
];

describe("reportByCompanyPdf", () => {
  it("monta as colunas dinâmicas na ordem oficial completa e remove Salário Real", () => {
    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(officialColumns));

    expect(pdfColumns.map((item) => item.rubricId)).toEqual([
      "ctps",
      "salario_g",
      "outros",
      "horas",
      "ferias",
      "premio",
      "emprestimos",
      "compra",
      "inss",
      "vales",
      "faltas",
      "fiscal",
      "g2",
      "liquido",
    ]);
    expect(pdfColumns.some((item) => item.rubricId === "real" || item.isCanonicalSalarioReal)).toBe(false);
    expect(pdfColumns[0].rubricId).toBe("ctps");
  });

  it("posiciona Compra de Férias entre Emprést. Consig. e INSS quando a rubrica existe no dataset", () => {
    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(officialColumns));
    const ids = pdfColumns.map((item) => item.rubricId);

    expect(ids).toContain("compra");
    expect(ids.indexOf("emprestimos")).toBeLessThan(ids.indexOf("compra"));
    expect(ids.indexOf("compra")).toBeLessThan(ids.indexOf("inss"));
  });

  it("identifica Compra de Férias por nome normalizado mesmo com código legado", () => {
    const columns = [
      column({ rubricId: "emprestimos", rubricCode: "EMPREST_CONSIG", rubricName: "Emprést. Consig.", rubricType: "desconto", rubricClassification: "emprestimos", order: 1 }),
      column({ rubricId: "compra_nome", rubricCode: "77", rubricName: "(+) Compra de Férias", rubricClassification: "outros_rendimentos", order: 2 }),
      column({ rubricId: "inss", rubricCode: "INSS", rubricName: "INSS", rubricType: "desconto", rubricClassification: "inss", order: 3 }),
    ];

    expect(buildPayrollPdfDynamicColumns(datasetWithColumns(columns)).map((item) => item.rubricId)).toEqual([
      "emprestimos",
      "compra_nome",
      "inss",
    ]);
  });

  it("não identifica Compra de Férias com classificação incompatível", () => {
    const columns = [
      column({ rubricId: "compra_errada", rubricCode: "COMPRA_FERIAS", rubricName: "Compra de Férias", rubricClassification: "insalubridade", order: 1 }),
    ];

    expect(buildPayrollPdfDynamicColumns(datasetWithColumns(columns))).toEqual([]);
  });

  it("omite Compra de Férias sem erro quando a rubrica não existe no dataset", () => {
    const partialColumns = officialColumns.filter((item) => !["salario_g", "premio", "compra", "fiscal", "desconhecida"].includes(item.rubricId));

    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(partialColumns));

    expect(pdfColumns.map((item) => item.rubricId)).toEqual([
      "ctps",
      "outros",
      "horas",
      "ferias",
      "emprestimos",
      "inss",
      "vales",
      "faltas",
      "g2",
      "liquido",
    ]);
    expect(pdfColumns.some((item) => item.rubricId === "real")).toBe(false);
    expect(pdfColumns.some((item) => item.rubricId === "compra")).toBe(false);
  });

  it("não move Salário CTPS para a posição antiga de Salário Real", () => {
    const columns = [
      column({ rubricId: "outros", rubricCode: "OUTROS_RENDIMENTOS", rubricName: "(+) Outros Rendim.", rubricClassification: "outros_rendimentos", order: 1 }),
      column({ rubricId: "real", rubricCode: "salario_real", rubricName: "Salário Real", order: 2, isCanonicalSalarioReal: true }),
      column({ rubricId: "ctps", rubricCode: "salario_ctps", rubricName: "Salário CTPS", rubricClassification: "salario_ctps", order: 3 }),
      column({ rubricId: "liquido", rubricCode: "salario_liquido", rubricName: "Salário Líquido", order: 4 }),
    ];

    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(columns));

    expect(pdfColumns.map((item) => item.rubricId)).toEqual(["ctps", "outros", "liquido"]);
  });

  it("destaca somente as colunas finais oficiais de resultado", () => {
    const pdfColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(officialColumns));
    const highlightedIds = pdfColumns.filter(isHighlightedPayrollPdfColumn).map((item) => item.rubricId);

    expect(highlightedIds).toEqual(["fiscal", "g2", "liquido"]);
    expect(isHighlightedPayrollPdfColumn(pdfColumns[0])).toBe(false);
  });


  it("mantém cargo curto praticamente igual na impressão", () => {
    expect(formatJobRoleForPrint("Analista")).toBe("Analista");
    expect(formatJobRoleForPrint("  Operador   ")).toBe("Operador");
  });

  it("abrevia ou trunca cargo longo somente para impressão", () => {
    expect(formatJobRoleForPrint("Auxiliar De Produção O")).toBe("Aux. Produção");
    expect(formatJobRoleForPrint("Aj De Operador De Sala De Máquinas")).toBe("Aj. Operador Máq.");
    expect(formatJobRoleForPrint("Coordenador Geral De Processos Operacionais Internos")).toBe("Coordenador Geral Pro…");
  });

  it("formatação de cargo não altera colunas oficiais nem valores monetários", () => {
    const beforeColumns = buildPayrollPdfDynamicColumns(datasetWithColumns(officialColumns)).map((item) => item.rubricId);
    const money = formatPdfCurrencyBlankWhenZero(1250);

    expect(formatJobRoleForPrint("Aj De Operador De Sala De Máquinas")).toBe("Aj. Operador Máq.");
    expect(buildPayrollPdfDynamicColumns(datasetWithColumns(officialColumns)).map((item) => item.rubricId)).toEqual(beforeColumns);
    expect(money).toBe("R$ 1.250,00");
  });

  it("centraliza Admissão/Registro e colunas monetárias, mantendo identificação textual à esquerda", () => {
    expect(getPayrollPdfBodyColumnHalign(0)).toBe("left");
    expect(getPayrollPdfBodyColumnHalign(1)).toBe("left");
    expect(getPayrollPdfBodyColumnHalign(2)).toBe("left");
    expect(getPayrollPdfBodyColumnHalign(3)).toBe("center");
    expect(getPayrollPdfBodyColumnHalign(4)).toBe("center");
    expect(getPayrollPdfBodyColumnHalign(17)).toBe("center");
  });

  it("aplica negrito somente nas colunas monetárias do corpo", () => {
    expect(getPayrollPdfBodyColumnStyle(0)).toEqual({ halign: "left" });
    expect(getPayrollPdfBodyColumnStyle(1)).toEqual({ halign: "left" });
    expect(getPayrollPdfBodyColumnStyle(2)).toEqual({ halign: "left" });
    expect(getPayrollPdfBodyColumnStyle(3)).toEqual({ halign: "center" });
    expect(getPayrollPdfBodyColumnStyle(4)).toEqual({ halign: "center", fontStyle: "bold" });
    expect(getPayrollPdfBodyColumnStyle(17)).toEqual({ halign: "center", fontStyle: "bold" });
  });

  it("deixa valores monetários zerados em branco", () => {
    expect(formatPdfCurrencyBlankWhenZero(0)).toBe("");
    expect(formatPdfCurrencyBlankWhenZero("R$ 0,00")).toBe("");
    expect(formatPdfCurrencyBlankWhenZero(null)).toBe("");
    expect(formatPdfCurrencyBlankWhenZero(undefined)).toBe("");
  });

  it("preserva moeda brasileira para valores diferentes de zero", () => {
    expect(formatPdfCurrencyBlankWhenZero(3000)).toBe("R$ 3.000,00");
    expect(formatPdfCurrencyBlankWhenZero(-25.5)).toBe("-R$ 25,50");
  });
});
