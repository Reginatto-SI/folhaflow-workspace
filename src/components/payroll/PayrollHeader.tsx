import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface PayrollHeaderProps {
  onNewEntry?: () => void;
}

const PayrollHeader: React.FC<PayrollHeaderProps> = ({ onNewEntry }) => {
  const { activeCompanies, selectedCompany, setSelectedCompany, selectedMonth, setSelectedMonth } = usePayroll();

  // Range mais amplo (-12 / +12 meses): com busca por digitação, escala sem fricção.
  const monthOptions = React.useMemo(() => {
    const options: { label: string; value: string; month: number; year: number }[] = [];
    const now = new Date();
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push({
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
        value: `${d.getMonth() + 1}-${d.getFullYear()}`,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      });
    }
    return options;
  }, []);

  // Comentário: PRD-05 §5.4 — apenas empresas ATIVAS aparecem no seletor da Central de Folha.
  const companyItems = React.useMemo(
    () => activeCompanies.map((c) => ({ value: c.id, label: c.name })),
    [activeCompanies],
  );

  const monthItems = React.useMemo(
    () => monthOptions.map((o) => ({ value: o.value, label: o.label })),
    [monthOptions],
  );

  const selectedMonthValue = `${selectedMonth.month}-${selectedMonth.year}`;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Combobox com busca: o usuário digita parte do nome da empresa para filtrar a lista. */}
      <SearchableCombobox
        value={selectedCompany?.id || ""}
        items={companyItems}
        placeholder="Selecione a empresa"
        searchPlaceholder="Buscar empresa..."
        emptyMessage="Nenhuma empresa encontrada."
        className="w-[240px]"
        onValueChange={(id) => {
          const c = activeCompanies.find((c) => c.id === id);
          if (c) setSelectedCompany(c);
        }}
      />

      {/* Combobox com busca: aceita mês ou ano (ex: "março", "2026"). */}
      <SearchableCombobox
        value={selectedMonthValue}
        items={monthItems}
        placeholder="Selecione o mês"
        searchPlaceholder="Buscar competência..."
        emptyMessage="Nenhuma competência encontrada."
        className="w-[200px]"
        onValueChange={(v) => {
          if (!v) return;
          const [m, y] = v.split("-").map(Number);
          setSelectedMonth({ month: m, year: y });
        }}
      />

      <Badge variant="outline" className="text-xs font-medium">Em edição</Badge>

      <div className="ml-auto flex items-center gap-2">
        <Button size="sm" onClick={onNewEntry}>
          <Plus className="h-4 w-4 mr-1" />
          Novo lançamento
        </Button>
        <Button size="sm" variant="outline" disabled>
          <FileText className="h-4 w-4 mr-1" />
          Gerar relatório
        </Button>
      </div>
    </div>
  );
};

export default PayrollHeader;
