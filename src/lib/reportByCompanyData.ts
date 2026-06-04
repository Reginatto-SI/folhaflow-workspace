import { Company, Employee, PayrollBatch, PayrollEntry, PayrollMonth, Rubric } from "@/types/payroll";
import { calculatePayrollFromEntry, resolveCanonicalDerivedRubricIds } from "@/lib/payrollSpreadsheet";

export type ReportFixedColumnKey = "name" | "department" | "jobRole" | "admissionRegistration";

export type ReportDynamicColumn = {
  rubricId: string;
  rubricCode: string;
  rubricName: string;
  rubricType: Rubric["type"];
  rubricClassification: Rubric["classification"];
  order: number;
  isCanonicalSalarioReal: boolean;
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

const employeeNameCollator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

const compareReportEmployeeNames = (
  a: { sortName: string; cpf?: string; sourceIndex: number },
  b: { sortName: string; cpf?: string; sourceIndex: number },
) => {
  const nameA = a.sortName.trim();
  const nameB = b.sortName.trim();

  if (!nameA && !nameB) {
    const cpfCompare = employeeNameCollator.compare(a.cpf ?? "", b.cpf ?? "");
    return cpfCompare || a.sourceIndex - b.sourceIndex;
  }
  if (!nameA) return 1;
  if (!nameB) return -1;

  const nameCompare = employeeNameCollator.compare(nameA, nameB);
  if (nameCompare !== 0) return nameCompare;

  const cpfCompare = employeeNameCollator.compare(a.cpf ?? "", b.cpf ?? "");
  return cpfCompare || a.sourceIndex - b.sourceIndex;
};

const readValueFromPayload = (entry: PayrollEntry, key: string) => {
  const earningsValue = entry.earnings?.[key];
  if (typeof earningsValue === "number") return earningsValue;
  const deductionsValue = entry.deductions?.[key];
  if (typeof deductionsValue === "number") return deductionsValue;
  return null;
};

const readRubricValueFromEntry = (
  entry: PayrollEntry,
  rubric: Pick<Rubric, "id" | "code" | "classification">,
  canonicalIds: { salarioRealId: string | null; g2ComplementoId: string | null; salarioLiquidoId: string | null },
  canonicalComputed?: { salarioReal: number; g2Complemento: number; salarioLiquido: number }
) => {
  // Comentário: regra crítica do relatório — NÃO recalcular folha.
  // Para rubricas canônicas finais (PRD-12), priorizamos o mesmo resultado
  // resolvido pela Central (`calculatePayrollFromEntry`) ANTES do payload.
  // A identificação usa o mesmo resolvedor canônico da Central por ID de rubrica,
  // cobrindo códigos legados (inclusive numéricos) sem heurística paralela no relatório.
  if (canonicalComputed) {
    if (canonicalIds.salarioRealId && rubric.id === canonicalIds.salarioRealId) return canonicalComputed.salarioReal;
    if (canonicalIds.g2ComplementoId && rubric.id === canonicalIds.g2ComplementoId) return canonicalComputed.g2Complemento;
    if (canonicalIds.salarioLiquidoId && rubric.id === canonicalIds.salarioLiquidoId) return canonicalComputed.salarioLiquido;
  }

  // Para as demais rubricas, mantemos a ordem legada de leitura:
  //  1) payload por ID técnico da rubrica,
  //  2) payload por code técnico,
  //  3) campos persistidos oficiais quando necessário.
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
  allBatches?: PayrollBatch[];
  allEmployees?: Employee[];
  allEntries?: PayrollEntry[];
  rubrics?: Rubric[];
}): ReportByCompanyDataset {
  const { company, month, batch } = params;
  const allBatches = params.allBatches ?? [];
  const allEmployees = params.allEmployees ?? [];
  const allEntries = params.allEntries ?? [];
  const rubrics = params.rubrics ?? [];

  const rubricById = new Map(rubrics.map((rubric) => [rubric.id, rubric]));
  const canonicalIds = resolveCanonicalDerivedRubricIds(rubrics);

  const activeRubrics = [...rubrics]
    .filter((rubric) => rubric.isActive)
    .sort((a, b) => a.order - b.order)
    .map((rubric) => ({
      rubricId: rubric.id,
      rubricCode: rubric.code,
      rubricName: rubric.name,
      rubricType: rubric.type,
      rubricClassification: rubric.classification,
      order: rubric.order,
      // Comentário: marca técnica usada somente na apresentação do PDF para remover Salário Real sem depender do nome da coluna.
      isCanonicalSalarioReal: canonicalIds.salarioRealId === rubric.id,
    }));

  const batchesById = new Map(allBatches.map((item) => [item.id, item]));

  const filteredEntries = allEntries.filter((entry) => {
    if (entry.companyId !== company.id || entry.month !== month.month || entry.year !== month.year) return false;
    if (batch && !batch.isArchived) {
      // Regra compatível com a Central:
      // 1) com competência ativa selecionada, prioriza vínculo explícito por batch;
      // 2) fallback legado para entradas sem payrollBatchId.
      if (entry.payrollBatchId) return entry.payrollBatchId === batch.id;
      return true;
    }

    // Fallback transitório quando não há batch ativo selecionado.
    // Mantém regra por empresa+competência, mas evita incluir dados de batch arquivado.
    if (!entry.payrollBatchId) return true;
    const linkedBatch = batchesById.get(entry.payrollBatchId);
    return !linkedBatch?.isArchived;
  });

  const employeeById = new Map(allEmployees.map((employee) => [employee.id, employee]));

  const rowsWithSort = filteredEntries.map((entry, sourceIndex) => {
    const employee = employeeById.get(entry.employeeId);
    const department = employee?.department || "-";
    const jobRole = employee?.role || "-";
    const admissionRegistration = [employee?.admissionDate, employee?.registration].filter(Boolean).join(" / ") || "-";

    const canonicalComputed = calculatePayrollFromEntry({ entry, rubrics });

    const rubricValues: Record<string, number> = {};
    activeRubrics.forEach((column) => {
      rubricValues[column.rubricId] = toNumber(readRubricValueFromEntry(entry, {
        id: column.rubricId,
        code: column.rubricCode,
        classification: rubricById.get(column.rubricId)?.classification ?? null,
      }, canonicalIds, canonicalComputed));
    });

    return {
      employeeId: entry.employeeId,
      name: employee?.name || "Funcionário não encontrado",
      department,
      jobRole,
      admissionRegistration,
      rubricValues,
      sortName: employee?.name ?? "",
      cpf: employee?.cpf,
      sourceIndex,
    };
  });

  // Comentário: relatórios/exportações saem A-Z por funcionário para previsibilidade operacional; a ordenação não altera cálculo nem totais.
  const rows = [...rowsWithSort]
    .sort((a, b) => compareReportEmployeeNames(a, b))
    .map(({ sortName: _sortName, cpf: _cpf, sourceIndex: _sourceIndex, ...row }) => row);

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
