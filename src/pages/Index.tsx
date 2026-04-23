import React, { useState, useMemo, useCallback, useRef } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import PayrollHeader from "@/components/payroll/PayrollHeader";
import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollFilters from "@/components/payroll/PayrollFilters";
import PayrollTable from "@/components/payroll/PayrollTable";
import EmployeeDrawer from "@/components/payroll/EmployeeDrawer";
import { PayrollEntry, Employee, Rubric } from "@/types/payroll";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { calculatePayrollFromEntry } from "@/lib/payrollSpreadsheet";

const Index = () => {
  const {
    payrollEntries,
    allEmployees,
    allDepartments,
    allJobRoles,
    departments,
    jobRoles,
    rubrics,
    updatePayrollEntry,
    addPayrollEntry,
    selectedCompany,
    selectedMonth,
  } = usePayroll();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [drawerMode, setDrawerMode] = useState<"edit" | "create">("edit");
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [isSavingNewEntry, setIsSavingNewEntry] = useState(false);
  const [inlineOverrides, setInlineOverrides] = useState<Record<string, PayrollEntry>>({});
  const [inlineSaveStateByEntryId, setInlineSaveStateByEntryId] = useState<Record<string, "saving" | "error">>({});
  const persistTimersRef = useRef<Record<string, number>>({});
  const persistVersionRef = useRef<Record<string, number>>({});

  const competenceLabel = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [selectedMonth.month, selectedMonth.year]
  );

  const mergedEntries = useMemo(() => {
    if (!Object.keys(inlineOverrides).length) return payrollEntries;
    return payrollEntries.map((entry) => inlineOverrides[entry.id] || entry);
  }, [inlineOverrides, payrollEntries]);

  const filteredEntries = useMemo(() => {
    return mergedEntries.filter((entry) => {
      const emp = allEmployees.find((e) => e.id === entry.employeeId);
      if (!emp) return false;

      if (search && !emp.name.toLowerCase().includes(search.toLowerCase())) return false;

      if (filterDept && filterDept !== "all") {
        if (emp.departmentId !== filterDept) return false;
      }

      if (filterRole && filterRole !== "all") {
        if (emp.jobRoleId !== filterRole) return false;
      }

      return true;
    });
  }, [mergedEntries, allEmployees, search, filterDept, filterRole]);

  React.useEffect(() => () => {
    Object.values(persistTimersRef.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  const handleRowClick = useCallback((entry: PayrollEntry) => {
    setDrawerMode("edit");
    setCreateEmployeeId("");
    setSelectedEntry(entry);
    setDrawerOpen(true);
  }, []);

  const handleSave = useCallback(
    async (id: string, updates: Partial<PayrollEntry>) => {
      // Fluxo simplificado: salvar apenas persistência; cálculo de tela já foi resolvido no frontend.
      await updatePayrollEntry(id, updates);
    },
    [updatePayrollEntry]
  );

  const persistInlineEntry = useCallback(async (entryId: string, nextEntry: PayrollEntry, version: number) => {
    const earningsPayload: Record<string, number> = {};
    const deductionsPayload: Record<string, number> = {};

    rubrics
      .filter((rubric) => rubric.isActive && rubric.nature !== "calculada")
      .forEach((rubric) => {
        if (rubric.type === "desconto") {
          deductionsPayload[rubric.id] = nextEntry.deductions?.[rubric.id] || 0;
        } else {
          earningsPayload[rubric.id] = nextEntry.earnings?.[rubric.id] || 0;
        }
      });

    try {
      // Comentário: feedback discreto para sinalizar gravação assíncrona sem bloquear a edição.
      setInlineSaveStateByEntryId((prev) => ({ ...prev, [entryId]: "saving" }));
      await updatePayrollEntry(entryId, {
        baseSalary: nextEntry.baseSalary,
        earnings: earningsPayload,
        deductions: deductionsPayload,
      });
      // Comentário: proteção contra corrida entre timers/respostas antigas.
      // Apenas a versão mais recente pode limpar override/estado visual.
      if ((persistVersionRef.current[entryId] || 0) !== version) return;
      setInlineOverrides((prev) => {
        const { [entryId]: _, ...rest } = prev;
        return rest;
      });
      setInlineSaveStateByEntryId((prev) => {
        const { [entryId]: _, ...rest } = prev;
        return rest;
      });
    } catch {
      if ((persistVersionRef.current[entryId] || 0) !== version) return;
      setInlineSaveStateByEntryId((prev) => ({ ...prev, [entryId]: "error" }));
      toast.error("Não foi possível salvar alteração inline.");
    }
  }, [rubrics, updatePayrollEntry]);

  const handleInlineEntryChange = useCallback((entryId: string, rubric: Rubric, value: number, commit = false) => {
    const sourceEntry = inlineOverrides[entryId] || mergedEntries.find((item) => item.id === entryId) || payrollEntries.find((item) => item.id === entryId);
    if (!sourceEntry) return;

    const nextEntry: PayrollEntry = {
      ...sourceEntry,
      earnings: rubric.type === "desconto" ? sourceEntry.earnings : { ...(sourceEntry.earnings || {}), [rubric.id]: value },
      deductions: rubric.type === "desconto" ? { ...(sourceEntry.deductions || {}), [rubric.id]: value } : sourceEntry.deductions,
    };
    nextEntry.baseSalary = calculatePayrollFromEntry({ entry: nextEntry, rubrics }).baseSalary;

    setInlineOverrides((prev) => ({ ...prev, [entryId]: nextEntry }));
    setInlineSaveStateByEntryId((prev) => ({ ...prev, [entryId]: "saving" }));

    const existingTimer = persistTimersRef.current[entryId];
    if (existingTimer) window.clearTimeout(existingTimer);
    const version = (persistVersionRef.current[entryId] || 0) + 1;
    persistVersionRef.current[entryId] = version;

    if (commit) {
      void persistInlineEntry(entryId, nextEntry, version);
      return;
    }

    persistTimersRef.current[entryId] = window.setTimeout(() => {
      void persistInlineEntry(entryId, nextEntry, version);
      delete persistTimersRef.current[entryId];
    }, 300);
  }, [inlineOverrides, mergedEntries, payrollEntries, persistInlineEntry, rubrics]);

  const availableEmployeesForEntry = useMemo(() => {
    const alreadyInPayroll = new Set(payrollEntries.map((entry) => entry.employeeId));
    // Comentário: empresa registrante é referência cadastral.
    // Na operação de folha, o funcionário pode participar de qualquer empresa do grupo.
    return allEmployees.filter((employee) => employee.isActive && !alreadyInPayroll.has(employee.id));
  }, [allEmployees, payrollEntries]);

  const handleOpenNewEntry = useCallback(() => {
    setNewEmployeeId("");
    setNewEntryOpen(true);
  }, []);

  const handleCreatePayrollEntry = useCallback(async () => {
    if (!selectedCompany) {
      toast.error("Selecione uma empresa antes de criar lançamento.");
      return;
    }
    if (!newEmployeeId) {
      toast.error("Selecione um funcionário para o lançamento.");
      return;
    }

    const employee = allEmployees.find((item) => item.id === newEmployeeId);
    if (!employee) {
      toast.error("Funcionário não encontrado para lançamento.");
      return;
    }

    setIsSavingNewEntry(true);
    try {
      await addPayrollEntry({
        employeeId: employee.id,
        companyId: selectedCompany.id,
        month: selectedMonth.month,
        year: selectedMonth.year,
        // Comentário: salário não vem do cadastro de funcionário.
        // O valor inicial da folha nasce no lançamento e pode ser ajustado na Central.
        baseSalary: 0,
        earnings: {},
        deductions: {},
        notes: "",
      });
      toast.success("Lançamento criado com sucesso.");
      setNewEntryOpen(false);
      setNewEmployeeId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
        toast.error("Este funcionário já possui lançamento nesta competência.");
      } else {
        toast.error("Não foi possível criar o lançamento.");
      }
    } finally {
      setIsSavingNewEntry(false);
    }
  }, [addPayrollEntry, allEmployees, newEmployeeId, selectedCompany, selectedMonth.month, selectedMonth.year]);

  const clearFilters = () => {
    setSearch("");
    setFilterDept("");
    setFilterRole("");
  };

  const selectedEmployee = selectedEntry ? allEmployees.find((e) => e.id === selectedEntry.employeeId) || null : null;
  const selectedCreateEmployee = createEmployeeId ? allEmployees.find((e) => e.id === createEmployeeId) || null : null;
  const drawerEmployee = drawerMode === "create" ? selectedCreateEmployee : selectedEmployee;

  // Comentário: no modo criação, evitamos funcionário já lançado na competência,
  // sem restringir pela empresa registrante do cadastro.
  const availableCreateEmployees: Employee[] = useMemo(() => {
    if (!selectedCompany) return [];
    const existingEmployeeIds = new Set(payrollEntries.map((entry) => entry.employeeId));
    return allEmployees.filter(
      (employee) => employee.isActive && !existingEmployeeIds.has(employee.id)
    );
  }, [allEmployees, payrollEntries, selectedCompany]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Central de Folha</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecione empresa e competência, clique em um funcionário para editar valores.</p>
      </div>

      <PayrollHeader onNewEntry={handleOpenNewEntry} />
      <TotalsBar entriesOverride={mergedEntries} />
      <PayrollFilters
        search={search}
        onSearchChange={setSearch}
        departmentId={filterDept}
        onDepartmentChange={setFilterDept}
        jobRoleId={filterRole}
        onJobRoleChange={setFilterRole}
        departments={departments}
        jobRoles={jobRoles}
        onClear={clearFilters}
      />
      <PayrollTable
        entries={filteredEntries}
        allEmployees={allEmployees}
        allDepartments={allDepartments}
        allJobRoles={allJobRoles}
        onRowClick={handleRowClick}
        rubrics={rubrics}
        onInlineEntryChange={handleInlineEntryChange}
        inlineSaveStateByEntryId={inlineSaveStateByEntryId}
      />
      <EmployeeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        entry={selectedEntry}
        employee={drawerEmployee}
        employees={availableCreateEmployees}
        selectedEmployeeId={createEmployeeId}
        onSelectedEmployeeIdChange={setCreateEmployeeId}
        rubrics={rubrics}
        companyName={selectedCompany?.name}
        competenceLabel={competenceLabel}
        onSave={handleSave}
      />
      <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Funcionário</Label>
            <Select value={newEmployeeId} onValueChange={setNewEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funcionário" />
              </SelectTrigger>
              <SelectContent>
                {availableEmployeesForEntry.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableEmployeesForEntry.length === 0 && (
              <p className="text-xs text-muted-foreground">Todos os funcionários ativos já possuem lançamento para esta competência.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNewEntryOpen(false)} disabled={isSavingNewEntry}>
                Cancelar
              </Button>
              <Button onClick={handleCreatePayrollEntry} disabled={isSavingNewEntry || availableEmployeesForEntry.length === 0}>
                Salvar lançamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
