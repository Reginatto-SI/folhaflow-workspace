// Comentário: componente visual de UM recibo de pagamento.
// - Apenas EXIBE os dados já calculados no sistema (sem recálculo).
// - Layout fiel ao modelo legado da empresa (não modernizar).
// - Usado tanto para emissão individual (drawer) quanto para emissão em lote
//   (Central de Folha). Em lote, basta renderizar vários componentes <Receipt />.
import React from "react";
import { PayrollEntry, Employee, Company, Department, JobRole, Rubric } from "@/types/payroll";
import { buildReceiptData } from "@/lib/receiptData";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const stripLeadingReceiptSign = (label: string) =>
  label.replace(/^\s*(\(\+\)|\(-\)|\(=\))\s*/u, "");

const formatReceiptLineLabel = (prefix: string, label: string) => {
  // Comentário: cadastro legado pode trazer o sinal no nome da rubrica; o recibo
  // adiciona o sinal pela linha do modelo, então removemos o sinal original só na renderização.
  const cleanLabel = stripLeadingReceiptSign(label);
  return prefix ? `${prefix} ${cleanLabel}` : cleanLabel;
};

const MESES_PT = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

const formatCompetencia = (month: number, year: number) => {
  const m = MESES_PT[Math.max(0, Math.min(11, month - 1))] || "";
  const y = String(year).slice(-2);
  return `${m}-${y}`;
};

export interface ReceiptProps {
  entry: PayrollEntry;
  employee: Employee;
  company?: Company | null;
  department?: Department | null;
  jobRole?: JobRole | null;
  rubrics: Rubric[];
  isLast?: boolean;
}

const Receipt: React.FC<ReceiptProps> = ({ entry, employee, company, department, jobRole, rubrics, isLast }) => {
  const data = buildReceiptData(entry, rubrics);
  const competencia = formatCompetencia(entry.month, entry.year);
  // Comentário: observação do recibo é fixa por competência; não vem do Drawer/lançamento.
  const observacao = `Saldo salário - ${competencia}`;

  return (
    <div
      className="receipt-sheet"
      style={{
        pageBreakAfter: isLast ? "auto" : "always",
        breakAfter: isLast ? "auto" : "page",
      }}
    >
      <div className="receipt-frame">
        {/* Cabeçalho com nome do grupo/empresa */}
        <div className="receipt-header">{(company?.name || "—").toUpperCase()}</div>

        {/* Bloco de dados do funcionário */}
        <table className="receipt-info">
          <tbody>
            <tr><td className="rk">NOME:</td><td className="rv">{employee.name}</td></tr>
            <tr><td className="rk">EMPRESA:</td><td className="rv">{company?.name || "—"}</td></tr>
            <tr><td className="rk">SETOR:</td><td className="rv">{department?.name || employee.department || "—"}</td></tr>
            <tr><td className="rk">FUNÇÃO:</td><td className="rv">{jobRole?.name || employee.role || "—"}</td></tr>
            <tr><td className="rk">MÊS:</td><td className="rv">{competencia}</td></tr>
            <tr><td className="rk">VALOR RECEBIDO:</td><td className="rv">{fmt(data.netSalary)}</td></tr>
            <tr><td className="rk">Valor por Extenso:</td><td className="rv">{data.valorExtenso}</td></tr>
            <tr><td className="rk">Observação:</td><td className="rv">{observacao}</td></tr>
          </tbody>
        </table>

        {/* Discriminação das verbas */}
        <table className="receipt-verbas">
          <thead>
            <tr><th colSpan={2}>DISCRIMINAÇÃO DAS VERBAS</th></tr>
          </thead>
          <tbody>
            {data.lines.map((line, idx) => (
              <tr key={idx} className={line.highlight ? "verba-total" : ""}>
                <td className="vl">{formatReceiptLineLabel(line.prefix, line.label)}</td>
                <td className="vv">{line.highlight || line.value !== 0 ? fmt(line.value) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="receipt-decl">Declaro ter recebido a importância discriminada neste recibo.</p>

        {/* Comentário: cidade fixa ("Sorriso - MT") por exigência operacional;
            não há cadastro de cidade por empresa no schema atual. */}
        <p className="receipt-local">Sorriso - MT, Data: ______/______/______</p>

        <div className="receipt-sign">
          <div className="sign-line" />
          <div className="sign-name">{employee.name}</div>
        </div>

        <div className="receipt-footer">www.reginattosistemas.com.br - (65) 99210-2030</div>
      </div>
    </div>
  );
};

export default Receipt;
