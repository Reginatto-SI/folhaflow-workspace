import React, { useState, useMemo, useCallback } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import PayrollHeader from "@/components/payroll/PayrollHeader";
import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollFilters from "@/components/payroll/PayrollFilters";
import PayrollTable from "@/components/payroll/PayrollTable";
import EmployeeDrawer from "@/components/payroll/EmployeeDrawer";
import { PayrollEntry, Employee } from "@/types/payroll";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import ReceiptPrintView from "@/components/payroll/ReceiptPrintView";

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
    deletePayrollEntry,
    selectedCompany,
    selectedMonth,
    currentBatch,
  } = usePayroll();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [livePreviewEntry, setLivePreviewEntry] = useState<PayrollEntry | null>(null);
  const [drawerMode, setDrawerMode] = useState<"edit" | "create">("edit");
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [isSavingNewEntry, setIsSavingNewEntry] = useState(false);
  // Comentário: estado dos recibos (individual = 1 entry, lote = N entries).
  const [receiptsState, setReceiptsState] = useState<{ entries: PayrollEntry[]; title?: string } | null>(null);

  const competenceLabel = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [selectedMonth.month, selectedMonth.year]
  );

  const centralEntries = useMemo(() => {
    if (!livePreviewEntry) return payrollEntries;

    // Comentário: salario_real, g2_complemento e salario_liquido são rubricas canônicas.
    // A Central, o drawer e os totalizadores usam a mesma entrada operacional derivada
    // pela prévia do drawer e a mesma função de cálculo, sem cálculo paralelo.
    return payrollEntries.map((entry) => (entry.id === livePreviewEntry.id ? livePreviewEntry : entry));
  }, [livePreviewEntry, payrollEntries]);

  const filteredEntries = useMemo(() => {
    return centralEntries.filter((entry) => {
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
  }, [centralEntries, allEmployees, search, filterDept, filterRole]);

  // Paginação apenas visual: não altera totais (TotalsBar usa centralEntries) nem cálculos.
  const { page, pageSize, total, paginatedItems: pagedEntries, setPage, setPageSize, resetToFirstPage } =
    usePagination(filteredEntries);

  React.useEffect(() => {
    resetToFirstPage();
  }, [search, filterDept, filterRole, selectedCompany?.id, selectedMonth.month, selectedMonth.year, resetToFirstPage]);

  const handleRowClick = useCallback((entry: PayrollEntry) => {
    setDrawerMode("edit");
    setCreateEmployeeId("");
    setLivePreviewEntry(null);
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

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      await deletePayrollEntry(id);
    },
    [deletePayrollEntry]
  );

  // Comentário: dispara visualização do recibo individual a partir do drawer.
  // Usa a entrada com prévia já aplicada (mesma fonte do livePreviewEntry),
  // garantindo que o recibo bata 100% com o que o usuário vê na tela.
  const handleGenerateReceiptIndividual = useCallback((entry: PayrollEntry) => {
    const live = livePreviewEntry && livePreviewEntry.id === entry.id ? livePreviewEntry : entry;
    setReceiptsState({ entries: [live], title: "Recibo de pagamento" });
    setDrawerOpen(false);
  }, [livePreviewEntry]);

  // Comentário: geração em lote — usa os lançamentos da Central já filtrados na tela
  // (respeita busca/setor/cargo), 1 página A4 por recibo.
  const handleGenerateReceiptsBatch = useCallback(() => {
    if (!filteredEntries || filteredEntries.length === 0) {
      toast.error("Não há lançamentos para gerar recibos.");
      return;
    }
    setReceiptsState({ entries: filteredEntries, title: `Recibos — ${competenceLabel}` });
  }, [competenceLabel, filteredEntries]);


  const availableEmployeesForEntry = useMemo(() => {
    const alreadyInPayroll = new Set(payrollEntries.map((entry) => entry.employeeId));
    // Comentário: empresa registrante é referência cadastral.
    // Na operação de folha, o funcionário pode participar de qualquer empresa do grupo.
    return allEmployees.filter((employee) => employee.isActive && !alreadyInPayroll.has(employee.id));
  }, [allEmployees, payrollEntries]);

  const handleDrawerOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) setLivePreviewEntry(null);
  }, []);

  const handlePreviewChange = useCallback((entry: PayrollEntry | null) => {
    setLivePreviewEntry(entry);
  }, []);

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

      <PayrollHeader onNewEntry={handleOpenNewEntry} onGenerateReceipts={handleGenerateReceiptsBatch} />
      <TotalsBar entriesOverride={centralEntries} />
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
        entries={pagedEntries}
        allEmployees={allEmployees}
        allDepartments={allDepartments}
        allJobRoles={allJobRoles}
        onRowClick={handleRowClick}
        rubrics={rubrics}
      />
      {filteredEntries.length > 0 && (
        <div className="mt-2 rounded-lg border bg-card">
          <TablePagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="lançamentos"
            className="border-t-0"
          />
        </div>
      )}
      <EmployeeDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
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
        onDelete={handleDeleteEntry}
        canDelete={currentBatch?.status !== "finalizado"}
        onPreviewChange={handlePreviewChange}
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
