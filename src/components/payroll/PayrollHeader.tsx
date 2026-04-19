import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText, RefreshCw } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface PayrollHeaderProps {
  onNewEntry?: () => void;
}

// PRD-03 §4: status visual da folha derivado do batch atual.
const STATUS_LABEL: Record<string, string> = {
  draft: "Em edição",
  closed: "Fechada",
  paid: "Paga",
};

const PayrollHeader: React.FC<PayrollHeaderProps> = ({ onNewEntry }) => {
  const {
    activeCompanies,
    selectedCompany,
    setSelectedCompany,
    selectedMonth,
    setSelectedMonth,
    recalculatePayrollBatch,
    currentBatch,
  } = usePayroll();
  const [isRecalculating, setIsRecalculating] = React.useState(false);

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

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      // Bloco 3 / Fase 1: recálculo final deve ser executado no backend como fonte de verdade.
      // A UI apenas dispara a ação e exibe o resultado persistido.
      await recalculatePayrollBatch();
      toast.success("Folha recalculada com sucesso.");
    } catch {
      toast.error("Não foi possível recalcular a folha.");
    } finally {
      setIsRecalculating(false);
    }
  };

  const statusLabel = currentBatch ? (STATUS_LABEL[currentBatch.status] ?? currentBatch.status) : "Em edição";

  return (
    <TooltipProvider>
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

        {/* PRD-03 §4: badge reativa ao status real do batch. */}
        <Badge variant="outline" className="text-xs font-medium">{statusLabel}</Badge>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={onNewEntry}>
            <Plus className="h-4 w-4 mr-1" />
            Novo lançamento
          </Button>
          <Button size="sm" variant="outline" onClick={handleRecalculate} disabled={isRecalculating}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Recalcular
          </Button>
          {/* Tooltip explica que relatório é PRD-08, fora do escopo desta sprint. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button size="sm" variant="outline" disabled>
                  <FileText className="h-4 w-4 mr-1" />
                  Gerar relatório
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Disponível em sprint futura (PRD-08).</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default PayrollHeader;
