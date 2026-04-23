import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface PayrollHeaderProps {
  onNewEntry?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Em edição",
  em_edicao: "Em edição",
  em_revisao: "Em revisão",
  finalizado: "Finalizado",
};

const STATUS_OPTIONS: Array<{ value: "em_edicao" | "em_revisao" | "finalizado"; label: string }> = [
  { value: "em_edicao", label: "Em edição" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "finalizado", label: "Finalizado" },
];

const PayrollHeader: React.FC<PayrollHeaderProps> = ({ onNewEntry }) => {
  const {
    activeCompanies,
    selectedCompany,
    setSelectedCompany,
    selectedMonth,
    setSelectedMonth,
    availableCompetences,
    currentBatch,
    updateCurrentBatchStatus,
  } = usePayroll();
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [statusDraft, setStatusDraft] = React.useState<"em_edicao" | "em_revisao" | "finalizado">("em_edicao");
  const [isSavingStatus, setIsSavingStatus] = React.useState(false);

  // Comentário: PRD-05 §5.4 — apenas empresas ATIVAS aparecem no seletor da Central de Folha.
  const companyItems = React.useMemo(
    () => activeCompanies.map((c) => ({ value: c.id, label: c.name })),
    [activeCompanies],
  );

  const monthItems = React.useMemo(
    () =>
      availableCompetences.map((item) => {
        const date = new Date(item.year, item.month - 1, 1);
        return {
          value: `${item.month}-${item.year}`,
          label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        };
      }),
    [availableCompetences],
  );

  const selectedMonthValue = `${selectedMonth.month}-${selectedMonth.year}`;
  const hasSelectedMonthInOptions = monthItems.some((item) => item.value === selectedMonthValue);
  const monthValue = hasSelectedMonthInOptions ? selectedMonthValue : "";

  React.useEffect(() => {
    // Comentário: ao trocar empresa, mantemos a competência atual apenas se existir batch.
    // Caso contrário, selecionamos automaticamente a competência mais recente disponível.
    if (!availableCompetences.length) return;
    if (hasSelectedMonthInOptions) return;
    const first = availableCompetences[0];
    setSelectedMonth({ month: first.month, year: first.year });
  }, [availableCompetences, hasSelectedMonthInOptions, setSelectedMonth]);

  const statusLabel = currentBatch ? (STATUS_LABEL[currentBatch.status] ?? currentBatch.status) : "Em edição";

  React.useEffect(() => {
    if (!currentBatch) {
      setStatusDraft("em_edicao");
      return;
    }
    if (currentBatch.status === "em_revisao" || currentBatch.status === "finalizado") {
      setStatusDraft(currentBatch.status);
      return;
    }
    setStatusDraft("em_edicao");
  }, [currentBatch]);

  const handleSaveStatus = async () => {
    try {
      setIsSavingStatus(true);
      await updateCurrentBatchStatus(statusDraft);
      toast.success("Status da folha atualizado.");
      setStatusDialogOpen(false);
    } catch {
      toast.error("Não foi possível atualizar o status da folha.");
    } finally {
      setIsSavingStatus(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2.5 mb-3">
        {/* Combobox com busca: o usuário digita parte do nome da empresa para filtrar a lista. */}
        <SearchableCombobox
          value={selectedCompany?.id || ""}
          items={companyItems}
          placeholder="Selecione a empresa"
          searchPlaceholder="Buscar empresa..."
          emptyMessage="Nenhuma empresa encontrada."
          className="w-[220px]"
          onValueChange={(id) => {
            const c = activeCompanies.find((c) => c.id === id);
            if (c) setSelectedCompany(c);
          }}
        />

        {/* Combobox com busca: aceita mês ou ano (ex: "março", "2026"). */}
        <SearchableCombobox
          value={monthValue}
          items={monthItems}
          placeholder="Selecione a competência"
          searchPlaceholder="Buscar competência..."
          emptyMessage="Nenhuma folha cadastrada para esta empresa."
          className="w-[190px]"
          onValueChange={(v) => {
            if (!v) return;
            const [m, y] = v.split("-").map(Number);
            setSelectedMonth({ month: m, year: y });
          }}
        />

        {/* Comentário: badge virou controle operacional simples do status da folha. */}
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3"
          onClick={() => setStatusDialogOpen(true)}
          disabled={!currentBatch}
        >
          <Badge variant="outline" className="text-xs font-medium">{statusLabel}</Badge>
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={onNewEntry} className="h-8 px-3">
            <Plus className="h-4 w-4 mr-1" />
            Novo lançamento
          </Button>
          {/* Tooltip explica que relatório é PRD-08, fora do escopo desta sprint. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button size="sm" variant="outline" disabled className="h-8 px-3">
                  <FileText className="h-4 w-4 mr-1" />
                  Gerar relatório
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Disponível em sprint futura (PRD-08).</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar status da folha</DialogTitle>
            <DialogDescription>Defina o status operacional da folha selecionada.</DialogDescription>
          </DialogHeader>
          <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as typeof statusDraft)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isSavingStatus}>
              Cancelar
            </Button>
            <Button onClick={handleSaveStatus} disabled={isSavingStatus || !currentBatch}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default PayrollHeader;
