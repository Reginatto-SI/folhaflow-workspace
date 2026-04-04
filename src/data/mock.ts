import { Company, Employee, PayrollEntry, Rubric } from "@/types/payroll";

export const mockCompanies: Company[] = [
  { id: "c1", name: "Tech Solutions Ltda", cnpj: "12.345.678/0001-90", address: "Av. Paulista, 1000 - SP" },
  { id: "c2", name: "Comércio Global S/A", cnpj: "98.765.432/0001-10", address: "Rua das Flores, 200 - RJ" },
  { id: "c3", name: "Indústria Beta ME", cnpj: "11.222.333/0001-44", address: "Rod. BR-101, Km 50 - SC" },
];

export const mockEmployees: Employee[] = [
  { id: "e1", companyId: "c1", name: "Ana Silva", position: "Desenvolvedora Senior", baseSalary: 12000, admissionDate: "2021-03-15", status: "active" },
  { id: "e2", companyId: "c1", name: "Carlos Santos", position: "Gerente de Projetos", baseSalary: 15000, admissionDate: "2019-08-01", status: "active" },
  { id: "e3", companyId: "c1", name: "Maria Oliveira", position: "Analista de RH", baseSalary: 8500, admissionDate: "2022-01-10", status: "active" },
  { id: "e4", companyId: "c1", name: "João Pereira", position: "Designer UX", baseSalary: 9000, admissionDate: "2020-06-20", status: "active" },
  { id: "e5", companyId: "c1", name: "Fernanda Lima", position: "Estagiária", baseSalary: 2000, admissionDate: "2024-02-01", status: "active" },
  { id: "e6", companyId: "c2", name: "Roberto Costa", position: "Diretor Comercial", baseSalary: 18000, admissionDate: "2018-05-01", status: "active" },
  { id: "e7", companyId: "c2", name: "Juliana Alves", position: "Vendedora", baseSalary: 5500, admissionDate: "2023-03-10", status: "active" },
  { id: "e8", companyId: "c2", name: "Pedro Mendes", position: "Analista Financeiro", baseSalary: 7800, admissionDate: "2021-11-15", status: "active" },
  { id: "e9", companyId: "c3", name: "Lucia Ferreira", position: "Eng. de Produção", baseSalary: 11000, admissionDate: "2020-09-01", status: "active" },
  { id: "e10", companyId: "c3", name: "Marcos Souza", position: "Operador", baseSalary: 3500, admissionDate: "2022-07-01", status: "active" },
];

export const mockRubrics: Rubric[] = [
  { id: "r1", companyId: "c1", name: "Horas Extras", type: "earning", behavior: "manual", isFrequent: true },
  { id: "r2", companyId: "c1", name: "Bônus", type: "earning", behavior: "manual", isFrequent: false },
  { id: "r3", companyId: "c1", name: "Vale Transporte", type: "deduction", behavior: "percentage", defaultValue: 6, isFrequent: true },
  { id: "r4", companyId: "c1", name: "Vale Refeição", type: "deduction", behavior: "fixed", defaultValue: 450, isFrequent: true },
  { id: "r5", companyId: "c1", name: "INSS", type: "deduction", behavior: "percentage", defaultValue: 14, isFrequent: true },
  { id: "r6", companyId: "c1", name: "IRRF", type: "deduction", behavior: "percentage", defaultValue: 27.5, isFrequent: true },
];

export const generatePayrollEntries = (companyId: string, month: number, year: number): PayrollEntry[] => {
  const employees = mockEmployees.filter((e) => e.companyId === companyId && e.status === "active");
  return employees.map((emp) => ({
    id: `p-${emp.id}-${month}-${year}`,
    employeeId: emp.id,
    companyId,
    month,
    year,
    baseSalary: emp.baseSalary,
    earnings: {
      "Horas Extras": Math.round(Math.random() * 2000),
      "Bônus": Math.random() > 0.7 ? Math.round(Math.random() * 3000) : 0,
    },
    deductions: {
      "Vale Transporte": Math.round(emp.baseSalary * 0.06),
      "Vale Refeição": 450,
      "INSS": Math.round(emp.baseSalary * 0.14),
      "IRRF": Math.round(emp.baseSalary * 0.275 * 0.5),
    },
    notes: "",
  }));
};
