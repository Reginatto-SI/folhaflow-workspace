export interface Company {
  id: string;
  name: string;
  cnpj: string;
  // Comentário: endereço passou a ser obrigatório por exigência do PRD-05.
  address: string;
  // Comentário: status lógico para inativação sem exclusão física (PRD-05 §5.5).
  isActive: boolean;
}

export interface Department {
  id: string;
  // Comentário: departamento é vinculado por empresa para preservar autonomia multiempresa e evitar mistura indevida entre estruturas.
  companyId: string;
  name: string;
  isActive: boolean;
}

export interface JobRole {
  id: string;
  // Comentário: função/cargo também é por empresa, mantendo consistência com cenários de grupos empresariais com nomenclaturas distintas.
  companyId: string;
  name: string;
  isActive: boolean;
}

export interface Employee {
  id: string;
  // Comentário: nesta fase, companyId representa a empresa formal de registro (empresa registrada), não o vínculo completo de folha multiempresa.
  companyId: string;
  name: string;
  cpf: string;
  admissionDate: string;
  registration?: string;
  // Comentário: campo novo para carteira de trabalho no cadastro-base de RH.
  workCardNumber?: string;
  notes?: string;
  // Comentário: vínculo estruturado por ID em transição gradual; ainda convivendo com campo legado de texto.
  departmentId?: string;
  department?: string;
  // Comentário: vínculo estruturado por ID em transição gradual; ainda convivendo com campo legado de texto.
  jobRoleId?: string;
  role?: string;
  isMonthly: boolean;
  isOnLeave: boolean;
  isActive: boolean;
  bankName?: string;
  bankBranch?: string;
  bankAccount?: string;
  bankPixKey?: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  companyId: string;
  month: number;
  year: number;
  baseSalary: number;
  earnings: Record<string, number>;
  deductions: Record<string, number>;
  notes: string;
}

export interface RubricFormulaItem {
  id: string;
  operation: "add" | "subtract";
  sourceRubricId: string;
  order: number;
}

// Comentário: contrato canônico do PRD-02. `nature` separa rubricas-base
// (entrada operacional na folha) de calculadas (derivadas). `calculationMethod`
// define como o valor é obtido. `classification` é o eixo técnico de agrupamento
// para recibos e relatórios — NUNCA usar nome da rubrica para inferir comportamento.
export type RubricNature = "base" | "calculada";
export type RubricMethod = "manual" | "valor_fixo" | "percentual" | "formula";
export type RubricClassification =
  // Proventos
  | "salario_ctps"
  | "salario_g"
  | "outros_rendimentos"
  | "horas_extras"
  | "salario_familia"
  | "ferias_terco"
  | "insalubridade"
  // Descontos
  | "inss"
  | "emprestimos"
  | "adiantamentos"
  | "vales"
  | "faltas";

export interface Rubric {
  id: string;
  name: string;
  code: string;
  type: "provento" | "desconto";
  // Contrato PRD-02
  nature: RubricNature;
  calculationMethod: RubricMethod;
  // Comentário: nullable apenas durante a transição — UI exige preenchimento ao salvar.
  classification: RubricClassification | null;
  order: number;
  isActive: boolean;
  // Campos condicionais (PRD-02)
  fixedValue?: number | null;
  percentageValue?: number | null;
  percentageBaseRubricId?: string | null;
  formulaItems: RubricFormulaItem[];
  allowManualOverride: boolean;
  // Compatibilidade temporária — não usar em lógica nova.
  // `category` (texto livre) e `mode` (manual|formula) são derivados/preservados
  // só enquanto motor/recibos não migram para `classification` + `calculationMethod`.
  category?: string;
  mode?: "manual" | "formula";
}

export type PayrollMonth = {
  month: number;
  year: number;
};
