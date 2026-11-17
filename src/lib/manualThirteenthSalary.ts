import type { PayrollEntry, Rubric } from "@/types/payroll";

export const resolveManualThirteenthRubric = (rubrics: Rubric[]) => {
  const candidates = rubrics.filter((rubric) =>
    rubric.isActive && rubric.classification === "salario_g" &&
    rubric.type === "provento" && rubric.nature === "base" && rubric.calculationMethod === "manual"
  );
  return candidates.find((rubric) => rubric.code === "salario_g") ??
    (candidates.length === 1 ? candidates[0] : undefined);
};

export const readManualThirteenthSalary = (entry: PayrollEntry, rubric: Rubric): number | undefined => {
  const value = entry.earnings[rubric.id] ?? entry.earnings[rubric.code] ?? entry.earnings[rubric.name];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};
