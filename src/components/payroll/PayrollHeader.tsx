import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Copy, FileText, PencilLine, Plus, Printer } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PayrollHeaderProps {
  onNewEntry?: () => void;
  onGenerateReceipts?: () => void;
  onDuplicatePayroll?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Em edição",
  em_edicao: "Em edição",
  em_revisao: "Em revisão",
  finalizado: "Finalizado",
};

type PayrollStatus = "em_edicao" | "em_revisao" | "finalizado";

const STATUS_OPTIONS: Array<{ value: PayrollStatus; label: string }> = [
  { value: "em_edicao", label: "Em edição" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "finalizado", label: "Finalizado" },
];

const STATUS_VISUAL: Record<PayrollStatus, { icon: React.ElementType; badgeClassName: string; buttonClassName: string }> = {
  em_edicao: {
    icon: PencilLine,
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    buttonClassName: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800",
  },
  em_revisao: {
    icon: AlertTriangle,
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    buttonClassName: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800",
  },
  finalizado: {
    icon: CheckCircle2,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    buttonClassName: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800",
  },
};

const normalizePayrollStatus = (status?: string | null): PayrollStatus => {
  if (status === "em_revisao" || status === "finalizado") return status;
  return "em_edicao";
};

const PayrollHeader: React.FC<PayrollHeaderProps> = ({ onNewEntry, onGenerateReceipts, onDuplicatePayroll }) => {
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
  const [statusDraft, setStatusDraft] = React.useState<PayrollStatus>("em_edicao");
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

  const normalizedStatus = normalizePayrollStatus(currentBatch?.status);
  const currentStatusVisual = STATUS_VISUAL[normalizedStatus];
  const CurrentStatusIcon = currentStatusVisual.icon;
  const statusDraftVisual = STATUS_VISUAL[statusDraft];
  const StatusDraftIcon = statusDraftVisual.icon;
  const statusLabel = currentBatch ? (STATUS_LABEL[currentBatch.status] ?? currentBatch.status) : "Em edição";

  React.useEffect(() => {
    if (!currentBatch) {
      setStatusDraft("em_edicao");
      return;
    }
    setStatusDraft(normalizePayrollStatus(currentBatch.status));
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

        {/* Comentário: status da folha é apenas operacional/visual nesta fase.
            Não deve alterar cálculo, edição, recibos, relatórios ou regras de negócio. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn("h-8 rounded-full px-3 shadow-sm", currentStatusVisual.buttonClassName)}
              onClick={() => setStatusDialogOpen(true)}
              disabled={!currentBatch}
            >
              <CurrentStatusIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{statusLabel}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Status operacional e visual; não bloqueia lançamentos nem altera cálculos.</TooltipContent>
        </Tooltip>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onDuplicatePayroll} className="h-8 px-3">
            <Copy className="h-4 w-4 mr-1" />
            Criar nova folha
          </Button>
          <Button size="sm" onClick={onNewEntry} className="h-8 px-3">
            <Plus className="h-4 w-4 mr-1" />
            Novo lançamento
          </Button>
          {/* Comentário: recibos em lote — reutiliza o mesmo componente do recibo
              individual; cada funcionário ocupa uma página A4 própria. */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-3"
            onClick={onGenerateReceipts}
            disabled={!currentBatch || !onGenerateReceipts}
          >
            <Printer className="h-4 w-4 mr-1" />
            Gerar recibos
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
            <DialogDescription>
              Defina o status operacional da folha selecionada. Ele é apenas visual e não afeta cálculo, edição, recibos ou relatórios.
            </DialogDescription>
          </DialogHeader>
          <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as PayrollStatus)}>
            <SelectTrigger className={cn("h-11", statusDraftVisual.badgeClassName)}>
              <Badge variant="outline" className={cn("gap-1.5 font-semibold", statusDraftVisual.badgeClassName)}>
                <StatusDraftIcon className="h-3.5 w-3.5" />
                {STATUS_LABEL[statusDraft]}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => {
                const optionVisual = STATUS_VISUAL[option.value];
                const OptionIcon = optionVisual.icon;

                return (
                  <SelectItem key={option.value} value={option.value}>
                    <Badge variant="outline" className={cn("gap-1.5 font-semibold", optionVisual.badgeClassName)}>
                      <OptionIcon className="h-3.5 w-3.5" />
                      {option.label}
                    </Badge>
                  </SelectItem>
                );
              })}
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
