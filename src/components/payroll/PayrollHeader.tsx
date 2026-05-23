import React from "react";
import { getSuggestedPaymentDate, usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Archive, Building2, CalendarDays, CheckCircle2, Copy, FileSpreadsheet, FileText, MoreHorizontal, PencilLine, Plus, Printer, RotateCcw } from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface PayrollHeaderProps {
  onNewEntry?: () => void;
  onGenerateReceipts?: () => void;
  onDuplicatePayroll?: () => void;
  onGenerateReport?: () => void;
  onGenerateExcelReport?: () => void;
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
    // Comentário: reforça contraste para status visual mais sólido e leitura profissional no header.
    badgeClassName: "border-sky-300 bg-sky-100 text-sky-900",
    buttonClassName: "border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200 hover:text-sky-950",
  },
  em_revisao: {
    icon: AlertTriangle,
    badgeClassName: "border-amber-300 bg-amber-100 text-amber-900",
    buttonClassName: "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-950",
  },
  finalizado: {
    icon: CheckCircle2,
    badgeClassName: "border-emerald-300 bg-emerald-100 text-emerald-900",
    buttonClassName: "border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 hover:text-emerald-950",
  },
};

const normalizePayrollStatus = (status?: string | null): PayrollStatus => {
  if (status === "em_revisao" || status === "finalizado") return status;
  return "em_edicao";
};

const PayrollHeader: React.FC<PayrollHeaderProps> = ({ onNewEntry, onGenerateReceipts, onDuplicatePayroll, onGenerateReport, onGenerateExcelReport }) => {
  const {
    activeCompanies,
    selectedCompany,
    setSelectedCompany,
    selectedMonth,
    setSelectedMonth,
    availableCompetences,
    currentBatch,
    updateCurrentBatchStatus,
    updateCurrentBatchPaymentDate,
    archiveCurrentBatch,
  } = usePayroll();
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [statusDraft, setStatusDraft] = React.useState<PayrollStatus>("em_edicao");
  const [isSavingStatus, setIsSavingStatus] = React.useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [isSavingArchiveState, setIsSavingArchiveState] = React.useState(false);
  const [paymentDateDraft, setPaymentDateDraft] = React.useState("");

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

  const statusDraftVisual = STATUS_VISUAL[statusDraft];
  const StatusDraftIcon = statusDraftVisual.icon;
  // Comentário: o status exibido no header precisa de fallback visual seguro para dados legados ou ausentes.
  const currentStatus = normalizePayrollStatus(currentBatch?.status);
  const currentStatusVisual = STATUS_VISUAL[currentStatus];
  const CurrentStatusIcon = currentStatusVisual.icon;
  const statusLabel = currentBatch ? (STATUS_LABEL[currentBatch.status] ?? STATUS_LABEL[currentStatus]) : STATUS_LABEL[currentStatus];
  const competenceLabel = new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
  const companyName = selectedCompany?.name || "empresa selecionada";
  const suggestedPaymentDate = React.useMemo(() => {
    // Comentário: header reutiliza helper oficial da folha para manter regra única da sugestão.
    return getSuggestedPaymentDate(selectedMonth.month, selectedMonth.year);
  }, [selectedMonth.month, selectedMonth.year]);
  React.useEffect(() => {
    if (!currentBatch) {
      setStatusDraft("em_edicao");
      return;
    }
    setStatusDraft(normalizePayrollStatus(currentBatch.status));
  }, [currentBatch]);

  React.useEffect(() => {
    // Comentário: para folhas sem payment_date, o campo já nasce visualmente preenchido com a sugestão oficial (dia 5 do mês seguinte).
    setPaymentDateDraft(currentBatch?.paymentDate || suggestedPaymentDate || "");
  }, [currentBatch?.id, currentBatch?.paymentDate, suggestedPaymentDate]);

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

  const handleArchiveCurrentBatch = async () => {
    try {
      setIsSavingArchiveState(true);
      await archiveCurrentBatch();
      toast.success("Folha arquivada com sucesso.");
      setArchiveDialogOpen(false);
    } catch {
      toast.error("Não foi possível arquivar a folha.");
    } finally {
      setIsSavingArchiveState(false);
    }
  };

  const savePaymentDateIfNeeded = React.useCallback(async () => {
    if (!currentBatch) return;
    const nextValue = paymentDateDraft || null;
    const currentValue = currentBatch.paymentDate || null;
    if (nextValue === currentValue) return;
    await updateCurrentBatchPaymentDate(nextValue);
  }, [currentBatch, paymentDateDraft, updateCurrentBatchPaymentDate]);

  const handleGenerateReceiptsClick = async () => {
    if (!onGenerateReceipts) return;
    try {
      await savePaymentDateIfNeeded();
      onGenerateReceipts();
    } catch {
      toast.error("Não foi possível salvar a data de pagamento antes de gerar os recibos.");
    }
  };

  return (
    <TooltipProvider>
      <div className="mb-3 rounded-md border bg-muted/20 px-2.5 py-2">
        {/* Comentário: header em duas áreas horizontais — esquerda (campos) e direita (ação principal + menu), mantendo leitura limpa e profissional. */}
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-1 flex-wrap items-end gap-2.5">
            <div className="w-full space-y-1 sm:w-[220px]">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3 w-3" />
              Empresa
            </div>
            {/* Combobox com busca: o usuário digita parte do nome da empresa para filtrar a lista. */}
            <SearchableCombobox
              value={selectedCompany?.id || ""}
              items={companyItems}
              placeholder="Selecione a empresa"
              searchPlaceholder="Buscar empresa..."
              emptyMessage="Nenhuma empresa encontrada."
              className="h-8 py-0 font-medium text-foreground sm:w-[220px]"
              onValueChange={(id) => {
                const c = activeCompanies.find((c) => c.id === id);
                if (c) setSelectedCompany(c);
              }}
            />
            </div>

            <div className="w-full space-y-1 sm:w-[190px]">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              Competência
            </div>
            {/* Combobox com busca: aceita mês ou ano (ex: "março", "2026"). */}
            <SearchableCombobox
              value={monthValue}
              items={monthItems}
              placeholder="Selecione a competência"
              searchPlaceholder="Buscar competência..."
              emptyMessage="Nenhuma folha cadastrada para esta empresa."
              className="h-8 py-0 font-medium text-foreground sm:w-[190px]"
              onValueChange={(v) => {
                if (!v) return;
                const [m, y] = v.split("-").map(Number);
                setSelectedMonth({ month: m, year: y });
              }}
            />
            </div>
            <div className="w-full space-y-1 sm:w-[190px]">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Data de pagamento</div>
              <Input
                type="date"
                value={paymentDateDraft}
                disabled={!currentBatch || currentBatch.isArchived}
                className="h-8"
                onChange={(e) => setPaymentDateDraft(e.target.value)}
                onBlur={async () => {
                  if (!currentBatch) return;
                  try {
                    await savePaymentDateIfNeeded();
                  } catch {
                    toast.error("Não foi possível salvar a data de pagamento.");
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 self-start xl:self-end">
            <Button size="sm" onClick={onNewEntry} className="h-8 px-3" disabled={!currentBatch}>
              <Plus className="h-4 w-4 mr-1" />
              Novo lançamento
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" aria-label="Mais ações da folha">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => void handleGenerateReceiptsClick()} disabled={!currentBatch || !onGenerateReceipts}>
                <Printer className="mr-2 h-4 w-4" />
                Gerar recibos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerateReport} disabled={!currentBatch || !selectedCompany || !onGenerateReport}>
                <FileText className="mr-2 h-4 w-4" />
                {/* Comentário: PDF preservado; apenas renomeado no menu, mantendo handler original intacto. */}
                Gerar relatório PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onGenerateExcelReport} disabled={!currentBatch || !selectedCompany || !onGenerateExcelReport}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {/* Comentário: nova ação reutiliza a exportação Excel já existente em /relatorios/por-empresa. */}
                Gerar relatório Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicatePayroll} disabled={!currentBatch}>
                <Copy className="mr-2 h-4 w-4" />
                Criar nova folha
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusDialogOpen(true)} disabled={!currentBatch || currentBatch.isArchived}>
                <CurrentStatusIcon className="mr-2 h-4 w-4" />
                Status da folha: {statusLabel}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)} disabled={!currentBatch}>
                <Archive className="mr-2 h-4 w-4" />
                Arquivar folha atual
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
            {currentBatch?.isArchived && (
              <Badge variant="secondary" className="h-8 px-2.5 text-xs font-medium">Arquivada</Badge>
            )}
          </div>
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

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar folha de pagamento?</DialogTitle>
            <DialogDescription>
              A folha da competência {competenceLabel} da empresa {companyName} será removida da Central de Folha.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Nenhum dado será excluído definitivamente, mas esta folha não ficará mais visível para o usuário.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)} disabled={isSavingArchiveState}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleArchiveCurrentBatch} disabled={isSavingArchiveState || !currentBatch}>
              Arquivar folha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </TooltipProvider>
  );
};

export default PayrollHeader;
