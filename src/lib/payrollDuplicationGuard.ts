export const CANONICAL_DERIVED_RUBRIC_CODES = [
  "salario_real",
  "g2_complemento",
  "salario_liquido",
] as const;

export function stripDerivedRubricsFromPayload(
  payload: Record<string, number> | null | undefined,
  derivedRubricIds: string[]
): Record<string, number> {
  const source = payload ?? {};

  // Rubricas derivadas NÃO são duplicadas.
  // Esses valores são sempre recalculados pelo motor.
  // Regra definida nos PRD-09 e PRD-12.
  return Object.fromEntries(
    Object.entries(source).filter(([rubricId]) => !derivedRubricIds.includes(rubricId))
  );
}
