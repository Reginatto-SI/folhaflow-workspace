// Comentário: competências da folha. As 12 mensais usam month 1..12.
// As duas folhas de 13º NÃO possuem mês no banco (month NULL + batch_type).
// No frontend, para reaproveitar comparações/ordenação existentes sem refatoração,
// elas são representadas internamente pelos códigos 13 e 14 — esses códigos
// NUNCA são gravados no banco (ver toDbMonth / batchTypeFromMonth).
export type PayrollBatchType = "mensal" | "13_primeira" | "13_segunda";

export const THIRTEENTH_FIRST_CODE = 13;
export const THIRTEENTH_SECOND_CODE = 14;

export const isThirteenthMonth = (month?: number | null) =>
  month === THIRTEENTH_FIRST_CODE || month === THIRTEENTH_SECOND_CODE;

export const batchTypeFromMonth = (month?: number | null): PayrollBatchType =>
  month === THIRTEENTH_FIRST_CODE ? "13_primeira" : month === THIRTEENTH_SECOND_CODE ? "13_segunda" : "mensal";

/** Converte linha do banco (month + batch_type) para o código interno. */
export const monthFromDb = (month: number | null | undefined, batchType?: string | null): number => {
  if (batchType === "13_primeira") return THIRTEENTH_FIRST_CODE;
  if (batchType === "13_segunda") return THIRTEENTH_SECOND_CODE;
  return Number(month ?? 0);
};

/** Mês persistido no banco: NULL para 13º. */
export const toDbMonth = (month: number): number | null => (isThirteenthMonth(month) ? null : month);

const PT_MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Rótulo padrão: "outubro de 2026" ou "13º Salário — 1ª Parcela / 2026". */
export const formatCompetenceLabel = (month: number, year: number): string => {
  if (month === THIRTEENTH_FIRST_CODE) return `13º Salário — 1ª Parcela / ${year}`;
  if (month === THIRTEENTH_SECOND_CODE) return `13º Salário — 2ª Parcela / ${year}`;
  return `${PT_MONTHS[Math.max(0, Math.min(11, month - 1))]} de ${year}`;
};

/** Rótulo curto: "10/2026" ou "13º 1ª Parc./2026". */
export const formatCompetenceShortLabel = (month: number, year: number): string => {
  if (month === THIRTEENTH_FIRST_CODE) return `13º 1ª Parcela/${year}`;
  if (month === THIRTEENTH_SECOND_CODE) return `13º 2ª Parcela/${year}`;
  return `${String(month).padStart(2, "0")}/${year}`;
};
