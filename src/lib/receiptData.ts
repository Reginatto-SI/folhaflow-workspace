// Comentário: monta os dados do recibo APENAS a partir do que já existe no sistema.
// Não altera cálculo de folha — usa os mesmos valores já calculados pela Central/Drawer,
// mas exibe somente as linhas operacionais do recibo legado.
import { PayrollEntry, Rubric, RubricClassification } from "@/types/payroll";
import { calculatePayrollFromEntry } from "@/lib/payrollSpreadsheet";
import { valorPorExtenso } from "@/lib/numberToWords";

export type ReceiptLine = {
  label: string;
  prefix: "" | "(+)" | "(-)" | "(=)";
  value: number;
  highlight?: boolean;
};

export type ReceiptData = {
  baseSalary: number;
  netSalary: number;
  valorExtenso: string;
  lines: ReceiptLine[];
};

type LegacyReceiptLineDefinition = {
  label: string;
  prefix: ReceiptLine["prefix"];
  getValue: (context: LegacyReceiptContext) => number;
};

type LegacyReceiptContext = {
  entry: PayrollEntry;
  rubrics: Rubric[];
  valuesByRubricId: Record<string, number>;
  // PRD-07: rubricas com quantidade complementar (ex.: dias) são individualizadas
  // no recibo — não entram nas agregações legadas.
  individualizedRubricIds: Set<string>;
};

const toSafeNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeRubricText = (value?: string | null) =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isLegacyGrossSalaryRubric = (rubric: Rubric) => {
  const code = normalizeRubricText(rubric.code);
  const name = normalizeRubricText(rubric.name);
  return code.includes("salario bruto") || code.includes("sal bruto") || name.includes("salario bruto");
};

const isFiscalSalaryRubric = (rubric: Rubric) => {
  const code = normalizeRubricText(rubric.code);
  const name = normalizeRubricText(rubric.name);
  return code.includes("salario fiscal") || code.includes("sal fiscal") || name.includes("salario fiscal");
};

const isTechnicalSalaryRubric = (rubric: Rubric) =>
  rubric.nature !== "calculada" &&
  rubric.type === "provento" &&
  (isLegacyGrossSalaryRubric(rubric) ||
    isFiscalSalaryRubric(rubric) ||
    rubric.classification === "salario_ctps" ||
    rubric.classification === "salario_g");

const getFirstRubricValue = (context: LegacyReceiptContext, predicate: (rubric: Rubric) => boolean) => {
  const rubric = [...context.rubrics]
    .filter((item) => item.isActive && predicate(item))
    .sort((a, b) => a.order - b.order)[0];

  return rubric ? toSafeNumber(context.valuesByRubricId[rubric.id]) : null;
};

const getLegacyGrossSalaryValue = (context: LegacyReceiptContext) => {
  // Comentário: a linha "Salário Bruto" do recibo legado representa uma única
  // base operacional. Não somamos CTPS + G + Fiscal; seguimos a pista do backend
  // transitório: salário bruto explícito > salário fiscal > CTPS > base_salary.
  return (
    getFirstRubricValue(
      context,
      (rubric) => rubric.nature !== "calculada" && rubric.type === "provento" && isLegacyGrossSalaryRubric(rubric),
    ) ??
    getFirstRubricValue(
      context,
      (rubric) => rubric.nature !== "calculada" && rubric.type === "provento" && isFiscalSalaryRubric(rubric),
    ) ??
    getFirstRubricValue(
      context,
      (rubric) => rubric.nature !== "calculada" && rubric.type === "provento" && rubric.classification === "salario_ctps",
    ) ??
    toSafeNumber(context.entry.baseSalary)
  );
};

const isPremioDesempRubric = (rubric: Rubric) => {
  const code = normalizeRubricText(rubric.code);
  const name = normalizeRubricText(rubric.name);
  return code.includes("premio") || code.includes("desemp") || name.includes("premio") || name.includes("desemp");
};

const sumRubrics = (context: LegacyReceiptContext, predicate: (rubric: Rubric) => boolean) =>
  context.rubrics.reduce((sum, rubric) => {
    if (!rubric.isActive || !predicate(rubric)) return sum;
    return sum + toSafeNumber(context.valuesByRubricId[rubric.id]);
  }, 0);

const sumByClassifications = (context: LegacyReceiptContext, classifications: RubricClassification[]) => {
  const allowed = new Set<RubricClassification>(classifications);
  return sumRubrics(context, (rubric) => !!rubric.classification && allowed.has(rubric.classification));
};

const LEGACY_RECEIPT_LINES: LegacyReceiptLineDefinition[] = [
  {
    label: "Salário Bruto",
    prefix: "",
    getValue: (context) => getLegacyGrossSalaryValue(context),
  },
  {
    label: "Diarias/Gratificações",
    prefix: "(+)",
    getValue: (context) =>
      sumRubrics(
        context,
        (rubric) =>
          rubric.type === "provento" &&
          rubric.nature !== "calculada" &&
          !isTechnicalSalaryRubric(rubric) &&
          !isPremioDesempRubric(rubric) &&
          (rubric.classification === "outros_rendimentos" ||
            rubric.classification === "salario_familia" ||
            rubric.classification === "insalubridade"),
      ),
  },
  {
    label: "1/3 de férias",
    prefix: "(+)",
    getValue: (context) => sumByClassifications(context, ["ferias_terco"]),
  },
  {
    label: "Hora extras",
    prefix: "(+)",
    getValue: (context) => sumByClassifications(context, ["horas_extras"]),
  },
  {
    label: "Premio/Desemp.",
    prefix: "(+)",
    getValue: (context) =>
      sumRubrics(
        context,
        (rubric) => rubric.type === "provento" && rubric.nature !== "calculada" && isPremioDesempRubric(rubric),
      ),
  },
  {
    label: "INSS",
    prefix: "(-)",
    getValue: (context) => sumByClassifications(context, ["inss"]),
  },
  {
    label: "Emprést. Consig.",
    prefix: "(-)",
    getValue: (context) => sumByClassifications(context, ["emprestimos"]),
  },
  {
    label: "Adiant. Gerencial",
    prefix: "(-)",
    getValue: (context) => sumByClassifications(context, ["adiantamentos"]),
  },
  {
    label: "Vale/Desconto",
    prefix: "(-)",
    getValue: (context) => sumByClassifications(context, ["vales"]),
  },
  {
    label: "Descontos/Faltas",
    prefix: "(-)",
    getValue: (context) => sumByClassifications(context, ["faltas"]),
  },
];

export function buildReceiptData(entry: PayrollEntry, rubrics: Rubric[]): ReceiptData {
  const result = calculatePayrollFromEntry({ entry, rubrics });
  const context: LegacyReceiptContext = {
    entry,
    rubrics,
    valuesByRubricId: result.valuesByRubricId,
  };

  // Comentário: recibo legado é simplificado. Mantemos sempre as mesmas linhas,
  // agregando rubricas por classificação/cadastro e nunca exibindo rubricas técnicas
  // individualmente (salário real, G2 complemento, salário líquido etc.).
  const lines: ReceiptLine[] = LEGACY_RECEIPT_LINES.map((line) => ({
    label: line.label,
    prefix: line.prefix,
    value: line.getValue(context),
  }));

  const baseSalary = lines[0]?.value || 0;

  // Líquido oficial: usa o campo persistido da folha quando presente. Em prévias do
  // drawer/lote ainda não persistidas, mantém fallback para a canônica/função única já
  // usada pela Central, sem recalcular uma regra própria no recibo.
  const netSalary = typeof entry.netSalary === "number"
    ? entry.netSalary
    : result.canonicalDerivedRubricIds.salarioLiquidoId
      ? result.salarioLiquido
      : result.netSalary;

  lines.push({ label: "Líquido a receber", prefix: "(=)", value: netSalary, highlight: true });

  return {
    baseSalary,
    netSalary,
    valorExtenso: valorPorExtenso(netSalary),
    lines,
  };
}
