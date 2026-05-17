// Comentário: monta os dados do recibo APENAS a partir do que já existe no sistema.
// Não recalcula nada novo — usa a mesma função calculatePayroll que o drawer e a
// Central usam, garantindo que o valor exibido no recibo bata 100% com a tela.
import { PayrollEntry, Rubric } from "@/types/payroll";
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

const getRubricPrefix = (rubric: Rubric): ReceiptLine["prefix"] => {
  if (rubric.type === "provento") return "(+)";
  if (rubric.type === "desconto") return "(-)";
  return "";
};

export function buildReceiptData(entry: PayrollEntry, rubrics: Rubric[]): ReceiptData {
  const result = calculatePayrollFromEntry({ entry, rubrics });
  const activeRubrics = [...rubrics].filter((r) => r.isActive).sort((a, b) => a.order - b.order);

  // Comentário: a tabela do recibo segue o cadastro real de rubricas ativas,
  // preservando a ordem cadastrada e exibindo linhas mesmo quando o valor é zero.
  const lines: ReceiptLine[] = activeRubrics.map((rubric) => ({
    label: rubric.name,
    prefix: getRubricPrefix(rubric),
    value: result.valuesByRubricId[rubric.id] || 0,
  }));

  const baseSalary = result.baseSalary;

  // Líquido: prioriza canônica salario_liquido; fallback netSalary.
  const netSalary = result.canonicalDerivedRubricIds.salarioLiquidoId
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
