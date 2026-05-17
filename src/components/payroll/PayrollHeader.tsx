import React from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, Copy, FileText, MoreHorizontal, Plus, Printer, RotateCcw } from "lucide-react";
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
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

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

const STATUS_OPTIONS: Array<{ value: "em_edicao" | "em_revisao" | "finalizado"; label: string }> = [
  { value: "em_edicao", label: "Em edição" },
  { value: "em_revisao", label: "Em revisão" },
  { value: "finalizado", label: "Finalizado" },
];

const PayrollHeader: React.FC<PayrollHeaderProps> = ({ onNewEntry, onGenerateReceipts, onDuplicatePayroll }) => {
  const {
    activeCompanies,
    selectedCompany,
    setSelectedCompany,
    selectedMonth,
    setSelectedMonth,
    availableCompetences,
    showArchivedPayrolls,
    setShowArchivedPayrolls,
    currentBatch,
    updateCurrentBatchStatus,
    archiveCurrentBatch,
    restoreCurrentBatch,
  } = usePayroll();
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [statusDraft, setStatusDraft] = React.useState<"em_edicao" | "em_revisao" | "finalizado">("em_edicao");
  const [isSavingStatus, setIsSavingStatus] = React.useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = React.useState(false);
  const [isSavingArchiveState, setIsSavingArchiveState] = React.useState(false);

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
          label: `${date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}${item.isArchived ? " · Arquivada" : ""}`,
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
  const isCurrentBatchArchived = currentBatch?.isArchived === true;
  const competenceLabel = new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
  const companyName = selectedCompany?.name || "empresa selecionada";

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

  const handleRestoreCurrentBatch = async () => {
    try {
      setIsSavingArchiveState(true);
      await restoreCurrentBatch();
      toast.success("Folha restaurada com sucesso.");
      setRestoreDialogOpen(false);
    } catch {
      toast.error("Não foi possível restaurar a folha.");
    } finally {
      setIsSavingArchiveState(false);
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
          disabled={!currentBatch || currentBatch.isArchived}
        >
          <Badge variant="outline" className="text-xs font-medium">{statusLabel}</Badge>
        </Button>

        {currentBatch?.isArchived && (
          <Badge variant="secondary" className="h-8 px-3 text-xs font-medium">Arquivada</Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={isCurrentBatchArchived ? 0 : undefined}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDuplicatePayroll}
                  className="h-8 px-3"
                  disabled={isCurrentBatchArchived}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Criar nova folha
                </Button>
              </span>
            </TooltipTrigger>
            {isCurrentBatchArchived && (
              <TooltipContent>Restaure a folha ou selecione uma folha ativa para criar nova folha.</TooltipContent>
            )}
          </Tooltip>
          <Button size="sm" onClick={onNewEntry} className="h-8 px-3" disabled={!currentBatch || currentBatch.isArchived}>
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
            disabled={!currentBatch || currentBatch.isArchived || !onGenerateReceipts}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" aria-label="Mais ações da folha">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuCheckboxItem
                checked={showArchivedPayrolls}
                onCheckedChange={(checked) => setShowArchivedPayrolls(checked === true)}
              >
                Mostrar arquivadas
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {currentBatch?.isArchived ? (
                <DropdownMenuItem onClick={() => setRestoreDialogOpen(true)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restaurar folha
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setArchiveDialogOpen(true)} disabled={!currentBatch}>
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar folha atual
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar folha de pagamento?</DialogTitle>
            <DialogDescription>
              A folha da competência {competenceLabel} da empresa {companyName} será removida da visualização padrão, mas poderá ser restaurada depois.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Nenhum lançamento será excluído definitivamente.</p>
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

      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Restaurar folha de pagamento?</DialogTitle>
            <DialogDescription>
              A folha da competência {competenceLabel} da empresa {companyName} voltará a aparecer na visualização padrão da Central de Folha.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} disabled={isSavingArchiveState}>
              Cancelar
            </Button>
            <Button onClick={handleRestoreCurrentBatch} disabled={isSavingArchiveState || !currentBatch}>
              Restaurar folha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default PayrollHeader;
