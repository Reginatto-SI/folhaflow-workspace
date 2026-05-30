import React, { useState, useMemo, useCallback } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import PayrollHeader from "@/components/payroll/PayrollHeader";
import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollFilters from "@/components/payroll/PayrollFilters";
import PayrollTable from "@/components/payroll/PayrollTable";
import EmployeeDrawer from "@/components/payroll/EmployeeDrawer";
import PayrollDuplicationDialog from "@/components/payroll/PayrollDuplicationDialog";
import { PayrollEntry, Employee } from "@/types/payroll";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildReportByCompanyData } from "@/lib/reportByCompanyData";
import { generateReportByCompanyPdf } from "@/lib/reportByCompanyPdf";
import { exportReportByCompanyExcel } from "@/lib/reportByCompanyExcel";
import { TablePagination, usePagination } from "@/components/ui/table-pagination";
import ReceiptPrintView from "@/components/payroll/ReceiptPrintView";
import { usePersistedFilters } from "@/hooks/usePersistedFilters";
import { calculatePayrollFromEntry } from "@/lib/payrollSpreadsheet";


type PayrollSortKey = "employee" | "cpf" | "department" | "role" | "salarioReal" | "g2Complemento" | "salarioLiquido";
type PayrollSortDirection = "asc" | "desc";
type PayrollSortState = { key: PayrollSortKey; direction: PayrollSortDirection } | null;

const centralPayrollCollator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

const normalizeCpfForSearch = (value?: string | null) => {
  // Comentário: CPF normalizado permite busca e ordenação com ou sem pontuação.
  return (value || "").replace(/\D/g, "");
};

const normalizeSearchText = (value?: string | null) => (value || "").trim().toLocaleLowerCase("pt-BR");

const compareTextForCentral = (a?: string | null, b?: string | null) => {
  const left = (a || "").trim();
  const right = (b || "").trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return centralPayrollCollator.compare(left, right);
};

const compareNumberForCentral = (a?: number | null, b?: number | null) => {
  const left = Number.isFinite(a) ? Number(a) : 0;
  const right = Number.isFinite(b) ? Number(b) : 0;
  return left - right;
};

type CentralPayrollFilters = {
  empresaId: string;
  competencia: { month: number; year: number };
  folhaId: string;
  busca: string;
  setorId: string;
  funcaoCargoId: string;
  statusConferencia: "all" | "checked" | "pending";
};

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
    availableCompetences,
    allPayrollBatches,
    activeCompanies,
    isLoading,
    setSelectedCompany,
    setSelectedMonth,
  } = usePayroll();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [conferenceStatus, setConferenceStatus] = useState<"all" | "checked" | "pending">("all");
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [livePreviewEntry, setLivePreviewEntry] = useState<PayrollEntry | null>(null);
  const [drawerMode, setDrawerMode] = useState<"edit" | "create">("edit");
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [duplicationOpen, setDuplicationOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [isSavingNewEntry, setIsSavingNewEntry] = useState(false);
  const [optimisticConferidoByEntryId, setOptimisticConferidoByEntryId] = useState<Record<string, boolean>>({});
  const [updatingConferidoIds, setUpdatingConferidoIds] = useState<Record<string, boolean>>({});
  // Comentário: estado dos recibos (individual = 1 entry, lote = N entries).
  const [receiptsState, setReceiptsState] = useState<{ entries: PayrollEntry[]; title?: string } | null>(null);
  const persistedFilters = usePersistedFilters<CentralPayrollFilters>("central-de-folha");
  const restoredFiltersRef = React.useRef(false);
  const [filtersReady, setFiltersReady] = useState(false);
  const [sortState, setSortState] = useState<PayrollSortState>(null);

  React.useEffect(() => {
    if (restoredFiltersRef.current || isLoading) return;
    if ((activeCompanies ?? []).length === 0) return;

    const saved = persistedFilters.readFilters();
    const savedCompany = saved?.empresaId ? activeCompanies.find((company) => company.id === saved.empresaId) : null;
    const savedBatch = savedCompany
      ? allPayrollBatches.find((batch) =>
          !batch.isArchived &&
          batch.companyId === savedCompany.id &&
          ((saved.folhaId && batch.id === saved.folhaId) ||
            (saved.competencia && batch.month === saved.competencia.month && batch.year === saved.competencia.year))
        )
      : null;

    // Comentário: restauração local roda depois de empresas/folhas carregarem, validando IDs antes de sobrescrever o fallback padrão.
    if (savedCompany) setSelectedCompany(savedCompany);
    if (savedBatch) setSelectedMonth({ month: savedBatch.month, year: savedBatch.year });
    if (typeof saved?.busca === "string") setSearch(saved.busca);
    const savedDepartment = savedCompany && saved?.setorId
      ? allDepartments.find((department) => department.id === saved.setorId && department.companyId === savedCompany.id && department.isActive)
      : null;
    const savedJobRole = savedCompany && saved?.funcaoCargoId
      ? allJobRoles.find((jobRole) => jobRole.id === saved.funcaoCargoId && jobRole.companyId === savedCompany.id && jobRole.isActive)
      : null;
    // Comentário: setor/função são validados contra a empresa restaurada, não contra listas derivadas da empresa anterior.
    if (savedDepartment) setFilterDept(savedDepartment.id);
    if (savedJobRole) setFilterRole(savedJobRole.id);
    if (saved?.statusConferencia === "checked" || saved?.statusConferencia === "pending") setConferenceStatus(saved.statusConferencia);

    restoredFiltersRef.current = true;
    setFiltersReady(true);
  }, [activeCompanies, allDepartments, allJobRoles, allPayrollBatches, isLoading, persistedFilters, setSelectedCompany, setSelectedMonth]);

  React.useEffect(() => {
    if (!filtersReady || !selectedCompany) return;
    const hasSelectedBatch = currentBatch && allPayrollBatches.some((batch) => batch.id === currentBatch.id && !batch.isArchived);

    persistedFilters.saveFilters({
      empresaId: selectedCompany.id,
      competencia: { month: selectedMonth.month, year: selectedMonth.year },
      ...(hasSelectedBatch ? { folhaId: currentBatch.id } : {}),
      busca: search,
      setorId: filterDept,
      funcaoCargoId: filterRole,
      statusConferencia: conferenceStatus,
    });
  }, [allPayrollBatches, conferenceStatus, currentBatch, filterDept, filterRole, filtersReady, persistedFilters, search, selectedCompany, selectedMonth.month, selectedMonth.year]);

  const resetOperationalFilters = useCallback(() => {
    persistedFilters.clearFilters();
    setSearch("");
    setFilterDept("");
    setFilterRole("");
    setConferenceStatus("all");

    const fallbackCompany = activeCompanies[0];
    if (!fallbackCompany) return;
    setSelectedCompany(fallbackCompany);
    const [fallbackBatch] = allPayrollBatches
      .filter((batch) => batch.companyId === fallbackCompany.id && !batch.isArchived)
      .sort((a, b) => (b.year - a.year) || (b.month - a.month));
    if (fallbackBatch) setSelectedMonth({ month: fallbackBatch.month, year: fallbackBatch.year });
  }, [activeCompanies, allPayrollBatches, persistedFilters, setSelectedCompany, setSelectedMonth]);

  const competenceLabel = useMemo(
    () => new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [selectedMonth.month, selectedMonth.year]
  );

  const centralEntries = useMemo(() => {
    const entriesWithConferidoUx = payrollEntries.map((entry) =>
      optimisticConferidoByEntryId[entry.id] === undefined
        ? entry
        : { ...entry, conferido: optimisticConferidoByEntryId[entry.id] }
    );

    if (!livePreviewEntry) return entriesWithConferidoUx;

    // Comentário: salario_real, g2_complemento e salario_liquido são rubricas canônicas.
    // A Central, o drawer e os totalizadores usam a mesma entrada operacional derivada
    // pela prévia do drawer e a mesma função de cálculo, sem cálculo paralelo.
    return entriesWithConferidoUx.map((entry) =>
      entry.id === livePreviewEntry.id ? { ...livePreviewEntry, conferido: entry.conferido } : entry
    );
  }, [livePreviewEntry, optimisticConferidoByEntryId, payrollEntries]);

  const employeeById = useMemo(() => new Map(allEmployees.map((employee) => [employee.id, employee])), [allEmployees]);
  const departmentById = useMemo(() => new Map(allDepartments.map((department) => [department.id, department.name])), [allDepartments]);
  const roleById = useMemo(() => new Map(allJobRoles.map((role) => [role.id, role.name])), [allJobRoles]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = normalizeSearchText(search);
    const cpfQuery = normalizeCpfForSearch(search);

    return centralEntries.filter((entry) => {
      const emp = employeeById.get(entry.employeeId);
      if (!emp) return false;

      if (normalizedQuery) {
        const matchName = normalizeSearchText(emp.name).includes(normalizedQuery);
        // Comentário: remove pontuação do CPF para aceitar buscas como 02017348180, 020.173.481-80 ou trechos.
        const matchCpf = cpfQuery.length > 0 && normalizeCpfForSearch(emp.cpf).includes(cpfQuery);
        if (!matchName && !matchCpf) return false;
      }

      if (filterDept && filterDept !== "all") {
        if (emp.departmentId !== filterDept) return false;
      }

      if (filterRole && filterRole !== "all") {
        if (emp.jobRoleId !== filterRole) return false;
      }
      if (conferenceStatus === "checked" && !entry.conferido) return false;
      if (conferenceStatus === "pending" && entry.conferido) return false;

      return true;
    });
  }, [centralEntries, employeeById, search, filterDept, filterRole, conferenceStatus]);

  const effectiveSort = sortState ?? { key: "employee" as const, direction: "asc" as const };

  const sortedEntries = useMemo(() => {
    // Comentário: ordenação padrão A-Z deixa a Central previsível sem depender da ordem do banco.
    return filteredEntries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const employeeA = employeeById.get(a.entry.employeeId);
        const employeeB = employeeById.get(b.entry.employeeId);
        const missingNameA = !employeeA?.name?.trim();
        const missingNameB = !employeeB?.name?.trim();
        if (missingNameA !== missingNameB) return missingNameA ? 1 : -1;
        const departmentA = employeeA?.departmentId ? (departmentById.get(employeeA.departmentId) || employeeA.department) : employeeA?.department;
        const departmentB = employeeB?.departmentId ? (departmentById.get(employeeB.departmentId) || employeeB.department) : employeeB?.department;
        const roleA = employeeA?.jobRoleId ? (roleById.get(employeeA.jobRoleId) || employeeA.role) : employeeA?.role;
        const roleB = employeeB?.jobRoleId ? (roleById.get(employeeB.jobRoleId) || employeeB.role) : employeeB?.role;
        const computedA = calculatePayrollFromEntry({ entry: a.entry, rubrics });
        const computedB = calculatePayrollFromEntry({ entry: b.entry, rubrics });

        let result = 0;
        switch (effectiveSort.key) {
          case "cpf":
            result = compareTextForCentral(normalizeCpfForSearch(employeeA?.cpf), normalizeCpfForSearch(employeeB?.cpf));
            break;
          case "department":
            result = compareTextForCentral(departmentA, departmentB);
            break;
          case "role":
            result = compareTextForCentral(roleA, roleB);
            break;
          case "salarioReal":
            result = compareNumberForCentral(computedA.salarioReal, computedB.salarioReal);
            break;
          case "g2Complemento":
            result = compareNumberForCentral(computedA.g2Complemento, computedB.g2Complemento);
            break;
          case "salarioLiquido":
            result = compareNumberForCentral(computedA.salarioLiquido, computedB.salarioLiquido);
            break;
          case "employee":
          default:
            result = compareTextForCentral(employeeA?.name, employeeB?.name);
            break;
        }

        if (result === 0 && effectiveSort.key !== "employee") {
          result = compareTextForCentral(employeeA?.name, employeeB?.name);
        }
        if (result === 0) result = a.index - b.index;
        return effectiveSort.direction === "asc" ? result : -result;
      })
      .map(({ entry }) => entry);
  }, [departmentById, effectiveSort.direction, effectiveSort.key, employeeById, filteredEntries, roleById, rubrics]);

  // Paginação apenas visual: não altera totais (TotalsBar usa centralEntries) nem cálculos.
  const { page, pageSize, total, paginatedItems: pagedEntries, setPage, setPageSize, resetToFirstPage } =
    usePagination(sortedEntries);

  const handleSortChange = useCallback((key: PayrollSortKey) => {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
    // Comentário: ao mudar a ordenação, voltamos à página 1 para evitar confusão visual na grade paginada.
    resetToFirstPage();
  }, [resetToFirstPage]);

  React.useEffect(() => {
    resetToFirstPage();
  }, [search, filterDept, filterRole, conferenceStatus, selectedCompany?.id, selectedMonth.month, selectedMonth.year, resetToFirstPage]);
  const checkedCount = useMemo(() => centralEntries.filter((entry) => entry.conferido).length, [centralEntries]);
  const selectedEntryConferido = useMemo(() => {
    if (!selectedEntry) return false;
    const optimisticConferido = optimisticConferidoByEntryId[selectedEntry.id];
    if (optimisticConferido !== undefined) return optimisticConferido;
    return centralEntries.find((entry) => entry.id === selectedEntry.id)?.conferido ?? selectedEntry.conferido ?? false;
  }, [centralEntries, optimisticConferidoByEntryId, selectedEntry]);

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
  const handleToggleConferido = useCallback(async (entry: PayrollEntry) => {
    if (updatingConferidoIds[entry.id]) return;

    const currentConferido = optimisticConferidoByEntryId[entry.id] ?? entry.conferido;
    const nextConferido = !currentConferido;

    // Comentário: atualização otimista apenas para UX do marcador operacional da Central.
    setOptimisticConferidoByEntryId((prev) => ({ ...prev, [entry.id]: nextConferido }));
    setUpdatingConferidoIds((prev) => ({ ...prev, [entry.id]: true }));

    try {
      await updatePayrollEntry(entry.id, { conferido: nextConferido });
      setOptimisticConferidoByEntryId((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    } catch {
      setOptimisticConferidoByEntryId((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      toast.error("Não foi possível atualizar a conferência deste funcionário.");
    } finally {
      setUpdatingConferidoIds((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    }
  }, [optimisticConferidoByEntryId, updatePayrollEntry, updatingConferidoIds]);

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

    // Comentário: recibos em lote sempre A-Z para evitar PDF em ordem aleatória ou pela ordenação atual da tabela.
    const receiptEntries = filteredEntries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const employeeA = employeeById.get(a.entry.employeeId);
        const employeeB = employeeById.get(b.entry.employeeId);
        const result = compareTextForCentral(employeeA?.name, employeeB?.name);
        return result || a.index - b.index;
      })
      .map(({ entry }) => entry);

    setReceiptsState({ entries: receiptEntries, title: `Recibos — ${competenceLabel}` });
  }, [competenceLabel, employeeById, filteredEntries]);



  const handleGenerateCompanyReport = useCallback(() => {
    if (!selectedCompany || !currentBatch) {
      toast.error("Selecione empresa e folha ativa para gerar o relatório.");
      return;
    }

    // Comentário: a Central só dispara a geração oficial do relatório por empresa
    // com a empresa/competência já selecionadas, sem cálculo paralelo no header.
    const dataset = buildReportByCompanyData({
      company: selectedCompany,
      month: selectedMonth,
      batch: currentBatch,
      allBatches: allPayrollBatches,
      allEmployees,
      // Comentário: `payrollEntries` já representa exatamente a folha ativa da Central
      // (empresa+competência e, quando existe, batch atual), conforme filtro oficial do PayrollContext.
      allEntries: payrollEntries,
      rubrics,
    });

    if (!dataset.rows.length) {
      toast.error("Não há dados para gerar o relatório nesta competência.");
      return;
    }

    generateReportByCompanyPdf(dataset);
    toast.success("PDF gerado e baixado com sucesso.");
  }, [selectedCompany, currentBatch, selectedMonth, allPayrollBatches, allEmployees, payrollEntries, rubrics]);


  const handleGenerateCompanyReportExcel = useCallback(() => {
    if (!selectedCompany || !currentBatch) {
      toast.error("Selecione empresa e folha ativa para gerar o relatório.");
      return;
    }

    // Comentário: Central reaproveita a mesma base de dados operacional e exportador Excel da tela de relatórios.
    const dataset = buildReportByCompanyData({
      company: selectedCompany,
      month: selectedMonth,
      batch: currentBatch,
      allBatches: allPayrollBatches,
      allEmployees,
      allEntries: payrollEntries,
      rubrics,
    });

    if (!dataset.rows.length) {
      toast.error("Não há dados para gerar o relatório nesta competência.");
      return;
    }

    exportReportByCompanyExcel(dataset);
  }, [selectedCompany, currentBatch, selectedMonth, allPayrollBatches, allEmployees, payrollEntries, rubrics]);

  const availableEmployeesForEntry = useMemo(() => {
    const alreadyInPayroll = new Set(payrollEntries.map((entry) => entry.employeeId));
    // Comentário: empresa registrante é referência cadastral.
    // Na operação de folha, o funcionário pode participar de qualquer empresa do grupo.
    return allEmployees.filter((employee) => employee.isActive && !alreadyInPayroll.has(employee.id));
  }, [allEmployees, payrollEntries]);

  const availableEmployeeItemsForEntry = useMemo(
    () => availableEmployeesForEntry.map((employee) => ({ value: employee.id, label: employee.name })),
    [availableEmployeesForEntry]
  );

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
      const createdEntry = await addPayrollEntry({
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
      // Comentário: após criar o lançamento, abrimos automaticamente o drawer existente
      // para reduzir atrito operacional e permitir preenchimento imediato da folha.
      setNewEntryOpen(false);
      setNewEmployeeId("");
      setDrawerMode("edit");
      setCreateEmployeeId("");
      setLivePreviewEntry(null);
      setSelectedEntry(createdEntry);
      setDrawerOpen(true);
      toast.success("Lançamento criado com sucesso.");
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
    setConferenceStatus("all");
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

      <PayrollHeader onNewEntry={handleOpenNewEntry} onGenerateReceipts={handleGenerateReceiptsBatch} onGenerateReport={handleGenerateCompanyReport} onGenerateExcelReport={handleGenerateCompanyReportExcel} onDuplicatePayroll={() => setDuplicationOpen(true)} onClearPersistedFilters={resetOperationalFilters} />
      <TotalsBar entriesOverride={centralEntries} checkedCount={checkedCount} />
      <PayrollFilters
        search={search}
        onSearchChange={setSearch}
        departmentId={filterDept}
        onDepartmentChange={setFilterDept}
        jobRoleId={filterRole}
        onJobRoleChange={setFilterRole}
        departments={departments}
        jobRoles={jobRoles}
        conferenceStatus={conferenceStatus}
        onConferenceStatusChange={setConferenceStatus}
        onClear={clearFilters}
      />
      {!currentBatch && availableCompetences.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhuma folha ativa encontrada para esta empresa.</p>
          <p>Crie uma nova folha para continuar a operação.</p>
        </div>
      ) : (
        <PayrollTable
          entries={pagedEntries}
          allEmployees={allEmployees}
          allDepartments={allDepartments}
          allJobRoles={allJobRoles}
          onRowClick={handleRowClick}
          onToggleConferido={handleToggleConferido}
          updatingConferidoIds={updatingConferidoIds}
          rubrics={rubrics}
          sortKey={effectiveSort.key}
          sortDirection={effectiveSort.direction}
          onSortChange={handleSortChange}
        />
      )}
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
        isConferido={selectedEntryConferido}
        employee={drawerEmployee}
        employees={availableCreateEmployees}
        selectedEmployeeId={createEmployeeId}
        onSelectedEmployeeIdChange={setCreateEmployeeId}
        rubrics={rubrics}
        companyName={selectedCompany?.name}
        competenceLabel={competenceLabel}
        onSave={handleSave}
        onDelete={handleDeleteEntry}
        onPreviewChange={handlePreviewChange}
        onGenerateReceipt={handleGenerateReceiptIndividual}
        onToggleConferido={handleToggleConferido}
      />
      <PayrollDuplicationDialog open={duplicationOpen} onOpenChange={setDuplicationOpen} />
      <ReceiptPrintView
        open={!!receiptsState}
        onClose={() => setReceiptsState(null)}
        entries={receiptsState?.entries || []}
        allEmployees={allEmployees}
        allDepartments={allDepartments}
        allJobRoles={allJobRoles}
        company={selectedCompany}
        rubrics={rubrics}
        title={receiptsState?.title}
        paymentDate={currentBatch?.paymentDate ?? null}
      />
      <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Funcionário</Label>
            {/* Comentário: substituímos o dropdown simples pelo combobox pesquisável já usado no sistema,
                mantendo exatamente a mesma lista de funcionários disponíveis para o novo lançamento. */}
            <SearchableCombobox
              value={newEmployeeId}
              items={availableEmployeeItemsForEntry}
              placeholder="Pesquisar funcionário..."
              searchPlaceholder="Pesquisar funcionário..."
              emptyMessage="Nenhum funcionário encontrado"
              disabled={isSavingNewEntry || availableEmployeesForEntry.length === 0}
              onValueChange={setNewEmployeeId}
            />
            {availableEmployeesForEntry.length === 0 && (
              <p className="text-xs text-muted-foreground">Todos os funcionários ativos já possuem lançamento para esta competência.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setNewEntryOpen(false)} disabled={isSavingNewEntry}>
                Cancelar
              </Button>
              <Button onClick={handleCreatePayrollEntry} disabled={isSavingNewEntry || availableEmployeesForEntry.length === 0 || !newEmployeeId}>
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
