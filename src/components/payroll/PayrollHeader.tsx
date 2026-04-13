import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface PayrollHeaderProps {
  onNewEntry?: () => void;
}

const PayrollHeader: React.FC<PayrollHeaderProps> = ({ onNewEntry }) => {
  const { companies, selectedCompany, setSelectedCompany, selectedMonth, setSelectedMonth } = usePayroll();

  const monthOptions = React.useMemo(() => {
    const options: { label: string; value: string; month: number; year: number }[] = [];
    const now = new Date();
    for (let i = -3; i <= 3; i++) {
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

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <Select
        value={selectedCompany?.id || ""}
        onValueChange={(id) => {
          const c = companies.find((c) => c.id === id);
          if (c) setSelectedCompany(c);
        }}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Selecione a empresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={`${selectedMonth.month}-${selectedMonth.year}`}
        onValueChange={(v) => {
          const [m, y] = v.split("-").map(Number);
          setSelectedMonth({ month: m, year: y });
        }}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

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
