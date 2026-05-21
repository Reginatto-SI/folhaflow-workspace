import { Company, Employee, PayrollBatch, PayrollEntry, PayrollMonth, Rubric } from "@/types/payroll";

export type ReportFixedColumnKey = "name" | "department" | "jobRole" | "admissionRegistration";

export type ReportDynamicColumn = {
  rubricId: string;
  rubricCode: string;
  rubricName: string;
  rubricType: Rubric["type"];
  order: number;
};

export type ReportByCompanyRow = {
  employeeId: string;
  name: string;
  department: string;
  jobRole: string;
  admissionRegistration: string;
  rubricValues: Record<string, number>;
};

export type ReportByCompanyDataset = {
  title: string;
  companyName: string;
  competenceLabel: string;
  month: number;
  year: number;
  fixedColumns: Array<{ key: ReportFixedColumnKey; label: string }>;
  dynamicColumns: ReportDynamicColumn[];
  rows: ReportByCompanyRow[];
  totalsByRubricId: Record<string, number>;
};

const monthLabel = (month: number, year: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "2-digit" }).toUpperCase();

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const readValueFromPayload = (entry: PayrollEntry, key: string) => {
  const earningsValue = entry.earnings?.[key];
  if (typeof earningsValue === "number") return earningsValue;
  const deductionsValue = entry.deductions?.[key];
  if (typeof deductionsValue === "number") return deductionsValue;
  return null;
};

const readRubricValueFromEntry = (entry: PayrollEntry, rubric: Pick<Rubric, "id" | "code" | "classification">) => {
  // Comentário: regra crítica do relatório — NÃO recalcular folha.
  // Ordem de leitura compatível com o ecossistema atual:
  //  1) payload por ID técnico da rubrica (padrão atual),
  //  2) payload por code técnico (compatibilidade histórica),
  //  3) campos persistidos oficiais de payroll_entries apenas quando necessário.
  const byId = readValueFromPayload(entry, rubric.id);
  if (typeof byId === "number") return byId;

  const byCode = readValueFromPayload(entry, rubric.code);
  if (typeof byCode === "number") return byCode;

  // Campos persistidos oficiais (sem recálculo):
  // - `net_salary` cobre a rubrica canônica salario_liquido quando ainda não materializada no payload.
  // - `inss_amount` cobre INSS em cenários legados onde o desconto não foi salvo no JSON por rubrica.
  if (rubric.code === "salario_liquido" && typeof entry.netSalary === "number") return entry.netSalary;
  if (rubric.classification === "inss" && typeof entry.inssAmount === "number") return entry.inssAmount;

  return 0;
};

export function buildReportByCompanyData(params: {
  company: Company;
  month: PayrollMonth;
  batch: PayrollBatch | null;
  allBatches: PayrollBatch[];
  allEmployees: Employee[];
  allEntries: PayrollEntry[];
  rubrics: Rubric[];
}): ReportByCompanyDataset {
  const { company, month, batch, allBatches, allEmployees, allEntries, rubrics } = params;

  const rubricById = new Map(rubrics.map((rubric) => [rubric.id, rubric]));

  const activeRubrics = [...rubrics]
    .filter((rubric) => rubric.isActive)
    .sort((a, b) => a.order - b.order)
    .map((rubric) => ({
      rubricId: rubric.id,
      rubricCode: rubric.code,
      rubricName: rubric.name,
      rubricType: rubric.type,
      order: rubric.order,
    }));

  const validBatchIds = new Set(
    allBatches
      .filter(
        (item) =>
          item.companyId === company.id &&
          item.month === month.month &&
          item.year === month.year &&
          !item.isArchived,
      )
      .map((item) => item.id),
  );

  const filteredEntries = allEntries.filter((entry) => {
    if (entry.companyId !== company.id || entry.month !== month.month || entry.year !== month.year) return false;
    if (entry.payrollBatchId) return validBatchIds.has(entry.payrollBatchId);
    // Compatibilidade transitória com legado: se não há vínculo de batch, aceitamos apenas
    // quando o batch selecionado existe e não está arquivado.
    return !!batch && !batch.isArchived;
  });

  const employeeById = new Map(allEmployees.map((employee) => [employee.id, employee]));

  const rows = filteredEntries.map((entry) => {
    const employee = employeeById.get(entry.employeeId);
    const department = employee?.department || "-";
    const jobRole = employee?.role || "-";
    const admissionRegistration = [employee?.admissionDate, employee?.registration].filter(Boolean).join(" / ") || "-";

    const rubricValues: Record<string, number> = {};
    activeRubrics.forEach((column) => {
      rubricValues[column.rubricId] = toNumber(readRubricValueFromEntry(entry, {
        id: column.rubricId,
        code: column.rubricCode,
        classification: rubricById.get(column.rubricId)?.classification ?? null,
      }));
    });

    return {
      employeeId: entry.employeeId,
      name: employee?.name || "Funcionário não encontrado",
      department,
      jobRole,
      admissionRegistration,
      rubricValues,
    };
  });

  const totalsByRubricId = activeRubrics.reduce<Record<string, number>>((acc, rubric) => {
    acc[rubric.rubricId] = rows.reduce((sum, row) => sum + toNumber(row.rubricValues[rubric.rubricId]), 0);
    return acc;
  }, {});

  const competence = monthLabel(month.month, month.year);

  return {
    title: `Folha - ${company.name} (${competence})`,
    companyName: company.name,
    competenceLabel: competence,
    month: month.month,
    year: month.year,
    fixedColumns: [
      { key: "name", label: "Nome" },
      { key: "department", label: "Setor" },
      { key: "jobRole", label: "Função/Cargo" },
      { key: "admissionRegistration", label: "Admissão/Registro" },
    ],
    dynamicColumns: activeRubrics,
    rows,
    totalsByRubricId,
  };
}
