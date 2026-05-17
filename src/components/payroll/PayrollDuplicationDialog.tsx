import React from "react";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";
import { usePayroll, PayrollDuplicationResult } from "@/contexts/PayrollContext";
import { PayrollMonth, Rubric } from "@/types/payroll";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const formatCompetence = (competence: PayrollMonth) =>
  new Date(competence.year, competence.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const formatCompetenceShort = (competence: PayrollMonth) =>
  `${String(competence.month).padStart(2, "0")}/${competence.year}`;

const competenceValue = (competence: PayrollMonth) => `${competence.month}-${competence.year}`;

const parseCompetenceValue = (value: string): PayrollMonth => {
  const [month, year] = value.split("-").map(Number);
  return { month, year };
};

const parseMonthInput = (value: string): PayrollMonth | null => {
  if (!value) return null;
  const [year, month] = value.split("-").map(Number);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
  return { month, year };
};

const toMonthInputValue = (competence: PayrollMonth | null) =>
  competence ? `${competence.year}-${String(competence.month).padStart(2, "0")}` : "";

const isManualRubric = (rubric: Rubric) =>
  rubric.isActive && rubric.nature === "base" && rubric.calculationMethod === "manual";

const buildSummaryLines = (result: PayrollDuplicationResult) => {
  if (result.mode === "single") {
    const created = result.created[0];
    return created ? [`${created.entries} lançamento(s) copiado(s).`] : [];
  }

  const alreadyExists = result.skipped.filter((item) => item.reason === "duplicate_target").length;
  const missingBase = result.skipped.filter((item) => item.reason === "missing_base").length;
  const emptyBase = result.skipped.filter((item) => item.reason === "empty_base").length;

  return [
    `${result.created.length} folha(s) criada(s) com sucesso.`,
    `${alreadyExists} empresa(s) ignorada(s) porque já possuíam folha.`,
    `${missingBase} empresa(s) ignorada(s) porque não possuíam folha base.`,
    `${emptyBase} empresa(s) ignorada(s) porque a folha base estava sem lançamentos.`,
    `${result.errors.length} erro(s) crítico(s).`,
  ];
};

interface PayrollDuplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SuccessConfirmationState {
  result: PayrollDuplicationResult;
  baseCompetence: PayrollMonth;
  targetCompetence: PayrollMonth;
}

const PayrollDuplicationDialog: React.FC<PayrollDuplicationDialogProps> = ({ open, onOpenChange }) => {
  const {
    activeCompanies,
    selectedCompany,
    selectedMonth,
    allPayrollBatches,
    rubrics,
    duplicatePayroll,
    setSelectedCompany,
    setSelectedMonth,
  } = usePayroll();

  const [mode, setMode] = React.useState<"single" | "all">("single");
  const [companyId, setCompanyId] = React.useState("");
  const [baseCompetence, setBaseCompetence] = React.useState<PayrollMonth | null>(null);
  const [targetCompetence, setTargetCompetence] = React.useState<PayrollMonth | null>(null);
  const [selectedRubricIds, setSelectedRubricIds] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successConfirmation, setSuccessConfirmation] = React.useState<SuccessConfirmationState | null>(null);

  const manualRubrics = React.useMemo(
    () => rubrics.filter(isManualRubric).sort((a, b) => a.order - b.order),
    [rubrics]
  );

  const calculatedRubrics = React.useMemo(
    () => rubrics.filter((rubric) => rubric.isActive && rubric.nature === "calculada").sort((a, b) => a.order - b.order),
    [rubrics]
  );

  React.useEffect(() => {
    if (!open) return;
    setMode("single");
    setCompanyId(selectedCompany?.id || "");
    setBaseCompetence(selectedMonth);
    setTargetCompetence(null);
    setSelectedRubricIds(manualRubrics.map((rubric) => rubric.id));
  }, [manualRubrics, open, selectedCompany?.id, selectedMonth]);

  const singleBaseOptions = React.useMemo(() => {
    if (!companyId) return [];
    return allPayrollBatches
      .filter((batch) => batch.companyId === companyId)
      .map((batch) => ({ month: batch.month, year: batch.year }))
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [allPayrollBatches, companyId]);

  const allBaseOptions = React.useMemo(() => {
    const seen = new Map<string, PayrollMonth>();
    allPayrollBatches.forEach((batch) => {
      const key = competenceValue(batch);
      if (!seen.has(key)) seen.set(key, { month: batch.month, year: batch.year });
    });
    return [...seen.values()].sort((a, b) => (b.year - a.year) || (b.month - a.month));
  }, [allPayrollBatches]);

  const baseOptions = mode === "single" ? singleBaseOptions : allBaseOptions;
  const summaryLines = successConfirmation ? buildSummaryLines(successConfirmation.result) : [];

  React.useEffect(() => {
    if (!open) return;
    if (baseOptions.length === 0) {
      setBaseCompetence(null);
      return;
    }
    if (baseCompetence && baseOptions.some((item) => competenceValue(item) === competenceValue(baseCompetence))) return;
    setBaseCompetence(baseOptions[0]);
  }, [baseCompetence, baseOptions, open]);

  const toggleRubric = (rubricId: string, checked: boolean) => {
    setSelectedRubricIds((prev) => checked ? [...prev, rubricId] : prev.filter((id) => id !== rubricId));
  };

  const validate = () => {
    if (mode === "single" && !companyId) return "Selecione uma empresa.";
    if (!baseCompetence) return "Selecione a folha/competência base.";
    if (!targetCompetence) return "Informe a nova competência.";
    if (baseCompetence.month === targetCompetence.month && baseCompetence.year === targetCompetence.year) {
      return "A nova competência deve ser diferente da competência base.";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationMessage = validate();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setIsSubmitting(true);
    try {
      const duplicationResult = await duplicatePayroll({
        mode,
        companyId: mode === "single" ? companyId : undefined,
        baseMonth: baseCompetence!,
        targetMonth: targetCompetence!,
        selectedRubricIds,
      });
      // O modal de criação é fechado após sucesso para separar o fluxo de confirmação.
      onOpenChange(false);
      // O modal de sucesso confirma visualmente a folha recém-criada antes de navegar.
      setSuccessConfirmation({
        result: duplicationResult,
        baseCompetence: baseCompetence!,
        targetCompetence: targetCompetence!,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a folha.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompanyChange = (nextCompanyId: string) => {
    // Mantém a empresa escolhida apenas no estado do modal; a Central só muda após sucesso em duplicatePayroll.
    setCompanyId(nextCompanyId);
    setBaseCompetence(null);
  };

  const createdPayroll = successConfirmation?.result.created[0] ?? null;
  const canNavigateToCreatedPayroll = successConfirmation?.result.mode === "single" && !!createdPayroll;

  const handleCloseSuccessConfirmation = () => {
    if (successConfirmation && canNavigateToCreatedPayroll && createdPayroll) {
      const targetCompany = activeCompanies.find((company) => company.id === createdPayroll.companyId);
      if (targetCompany) {
        // No modo Empresa específica, fechar o modal de sucesso também confirma a navegação.
        setSelectedCompany(targetCompany);
        setSelectedMonth(successConfirmation.targetCompetence);
      }
    }

    setSuccessConfirmation(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <>
            <DialogHeader>
              <DialogTitle>Criar nova folha</DialogTitle>
              <DialogDescription>
                Duplique funcionários e valores manuais selecionados a partir de uma folha existente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de criação</Label>
                <RadioGroup value={mode} onValueChange={(value) => { setMode(value as "single" | "all"); setBaseCompetence(null); }} className="grid grid-cols-2 gap-2">
                  <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-normal">
                    <RadioGroupItem value="single" /> Empresa específica
                  </Label>
                  <Label className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm font-normal">
                    <RadioGroupItem value="all" /> Todas as empresas
                  </Label>
                </RadioGroup>
              </div>

              {mode === "single" && (
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={companyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCompanies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{mode === "single" ? "Folha base" : "Competência base"}</Label>
                  <Select value={baseCompetence ? competenceValue(baseCompetence) : ""} onValueChange={(value) => setBaseCompetence(parseCompetenceValue(value))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a competência existente" />
                    </SelectTrigger>
                    <SelectContent>
                      {baseOptions.map((competence) => (
                        <SelectItem key={competenceValue(competence)} value={competenceValue(competence)}>
                          {formatCompetence(competence)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {baseOptions.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma folha existente encontrada.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Nova competência</Label>
                  <Input
                    type="month"
                    value={toMonthInputValue(targetCompetence)}
                    onChange={(event) => setTargetCompetence(parseMonthInput(event.target.value))}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div>
                  <Label>Rubricas manuais a copiar</Label>
                  <p className="text-xs text-muted-foreground">Rubricas desmarcadas nascerão zeradas/vazias na nova folha.</p>
                </div>
                <div className="grid max-h-48 gap-2 overflow-auto rounded-md border p-3 sm:grid-cols-2">
                  {manualRubrics.map((rubric) => (
                    <Label key={rubric.id} className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                      <Checkbox
                        checked={selectedRubricIds.includes(rubric.id)}
                        onCheckedChange={(checked) => toggleRubric(rubric.id, checked === true)}
                      />
                      {rubric.name}
                    </Label>
                  ))}
                  {manualRubrics.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma rubrica manual ativa encontrada.</p>}
                </div>
                {calculatedRubrics.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Rubricas calculadas ({calculatedRubrics.map((rubric) => rubric.name).join(", ")}) não são copiadas como valor fixo; serão calculadas automaticamente.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || baseOptions.length === 0}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                Confirmar criação
              </Button>
            </DialogFooter>
          </>
        </DialogContent>
      </Dialog>

      <Dialog open={!!successConfirmation} onOpenChange={(nextOpen) => { if (!nextOpen) handleCloseSuccessConfirmation(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <DialogTitle>{successConfirmation?.result.mode === "single" ? "Folha criada com sucesso" : "Processo concluído"}</DialogTitle>
            <DialogDescription>
              {successConfirmation?.result.mode === "single" && successConfirmation
                ? `A nova folha da competência ${formatCompetenceShort(successConfirmation.targetCompetence)} foi criada com base na folha ${formatCompetenceShort(successConfirmation.baseCompetence)}.`
                : "Resumo da criação de folhas por empresa."}
            </DialogDescription>
          </DialogHeader>

          {successConfirmation?.result.mode === "single" ? (
            <p className="text-center text-sm text-muted-foreground">
              Você será direcionado para a nova folha para continuar a conferência e edição dos valores.
            </p>
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <ul className="space-y-2">
                {summaryLines.map((line) => (
                  <li key={line} className="flex items-center justify-between gap-3">
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {successConfirmation && successConfirmation.result.errors.length > 0 && (
                <div className="mt-3 text-xs text-destructive">
                  {successConfirmation.result.errors.map((item) => (
                    <p key={item.companyId}>{item.companyName}: {item.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleCloseSuccessConfirmation}>
              {canNavigateToCreatedPayroll ? "Ir para nova folha" : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PayrollDuplicationDialog;
