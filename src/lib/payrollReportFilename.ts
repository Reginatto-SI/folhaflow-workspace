const PT_BR_MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

type PayrollReportCompetence =
  | string
  | Date
  | {
      month?: number | string;
      year?: number | string;
      competenceLabel?: string;
      label?: string;
    };

export type PayrollReportFilenameParams = {
  competencia: PayrollReportCompetence;
  empresaNome: string;
  extension: "pdf" | "xlsx";
};

const sanitizeFilenamePart = (value: string, fallback: string): string => {
  // Comentário: remove apenas caracteres inválidos em nomes de arquivo, sem aplicar slug.
  const sanitized = value
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? " " : char))
    .join("")
    .replace(/\s+/g, " ")
    .trim();

  return sanitized || fallback;
};

const normalizeYear = (year: unknown): string | null => {
  const yearText = String(year ?? "").trim();
  const match = yearText.match(/\d{2,4}/);
  if (!match) return null;
  return match[0].slice(-2).padStart(2, "0");
};

const fromMonthYear = (month: unknown, year: unknown) => {
  const monthNumber = Number(month);
  const yearSuffix = normalizeYear(year);

  if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12 && yearSuffix) {
    return { monthName: PT_BR_MONTHS[monthNumber - 1].toLocaleUpperCase("pt-BR"), yearSuffix };
  }

  return null;
};

const fromCompetenceString = (competencia: string) => {
  const text = competencia.trim();
  const lowerText = text.toLocaleLowerCase("pt-BR");
  const monthIndex = PT_BR_MONTHS.findIndex((monthName) => lowerText.includes(monthName));
  const yearSuffix = normalizeYear(text);

  if (monthIndex >= 0 && yearSuffix) {
    return { monthName: PT_BR_MONTHS[monthIndex].toLocaleUpperCase("pt-BR"), yearSuffix };
  }

  const numericMatch = text.match(/(?:^|\D)(\d{1,2})(?:\D+)(\d{2,4})(?:\D|$)/);
  if (numericMatch) return fromMonthYear(numericMatch[1], numericMatch[2]);

  return null;
};

const formatCompetenceForFilename = (competencia: PayrollReportCompetence): string => {
  if (competencia instanceof Date && !Number.isNaN(competencia.getTime())) {
    return `${PT_BR_MONTHS[competencia.getMonth()].toLocaleUpperCase("pt-BR")} -${String(competencia.getFullYear()).slice(-2)}`;
  }

  if (typeof competencia === "string") {
    const parsed = fromCompetenceString(competencia);
    if (parsed) return `${parsed.monthName} -${parsed.yearSuffix}`;
  }

  if (competencia && typeof competencia === "object" && !(competencia instanceof Date)) {
    const parsedFromFields = fromMonthYear(competencia.month, competencia.year);
    if (parsedFromFields) return `${parsedFromFields.monthName} -${parsedFromFields.yearSuffix}`;

    const label = competencia.competenceLabel ?? competencia.label;
    if (typeof label === "string") {
      const parsedFromLabel = fromCompetenceString(label);
      if (parsedFromLabel) return `${parsedFromLabel.monthName} -${parsedFromLabel.yearSuffix}`;
    }
  }

  return "COMPETENCIA -00";
};

export const formatPayrollReportFilename = ({ competencia, empresaNome, extension }: PayrollReportFilenameParams): string => {
  const competencePart = formatCompetenceForFilename(competencia);
  const companyPart = sanitizeFilenamePart(empresaNome.toLocaleUpperCase("pt-BR"), "EMPRESA");

  return `${competencePart} - Folha de Pagamento ${companyPart}.${extension}`;
};
