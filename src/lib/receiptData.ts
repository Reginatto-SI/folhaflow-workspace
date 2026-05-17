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

const isBaseSalary = (rubric: Rubric) =>
  rubric.classification === "salario_ctps" || rubric.classification === "salario_g";

export function buildReceiptData(entry: PayrollEntry, rubrics: Rubric[]): ReceiptData {
  const result = calculatePayrollFromEntry({ entry, rubrics });
  const activeRubrics = [...rubrics].filter((r) => r.isActive).sort((a, b) => a.order - b.order);

  const lines: ReceiptLine[] = [];

  // Soma dos salários-base como linha "Salário Bruto" (fiel ao modelo legado).
  const baseSalary = activeRubrics
    .filter((r) => r.nature === "base" && r.type === "provento" && isBaseSalary(r))
    .reduce((sum, r) => sum + (result.valuesByRubricId[r.id] || 0), 0);

  if (baseSalary > 0) {
    lines.push({ label: "Salário Bruto", prefix: "", value: baseSalary });
  }

  // Outros proventos (não salário-base) com valor > 0.
  activeRubrics
    .filter((r) => r.nature === "base" && r.type === "provento" && !isBaseSalary(r))
    .forEach((r) => {
      const value = result.valuesByRubricId[r.id] || 0;
      if (value > 0) lines.push({ label: r.name, prefix: "(+)", value });
    });

  // Descontos com valor > 0.
  activeRubrics
    .filter((r) => r.nature === "base" && r.type === "desconto")
    .forEach((r) => {
      const value = result.valuesByRubricId[r.id] || 0;
      if (value > 0) lines.push({ label: r.name, prefix: "(-)", value });
    });

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
