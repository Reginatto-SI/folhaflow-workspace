import React, { useState, useMemo, useCallback } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import PayrollHeader from "@/components/payroll/PayrollHeader";
import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollFilters from "@/components/payroll/PayrollFilters";
import PayrollTable from "@/components/payroll/PayrollTable";
import EmployeeDrawer from "@/components/payroll/EmployeeDrawer";
import { Employee, PayrollEntry } from "@/types/payroll";
import { toast } from "sonner";

const Index = () => {
  const {
    payrollEntries, allEmployees, allDepartments, allJobRoles,
    departments, jobRoles, selectedCompany, selectedMonth, rubrics, addPayrollEntry, updatePayrollEntry,
  } = usePayroll();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [drawerMode, setDrawerMode] = useState<"edit" | "create">("edit");
  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filteredEntries = useMemo(() => {
    return payrollEntries.filter((entry) => {
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
  }, [payrollEntries, allEmployees, search, filterDept, filterRole]);

  const handleRowClick = useCallback((entry: PayrollEntry) => {
    setDrawerMode("edit");
    setCreateEmployeeId("");
    setSelectedEntry(entry);
    setDrawerOpen(true);
  }, []);

  const handleNewEntry = useCallback(() => {
    if (!selectedCompany) {
      toast.error("Selecione uma empresa antes de criar um lançamento.");
      return;
    }
    setDrawerMode("create");
    setSelectedEntry(null);
    setCreateEmployeeId("");
    setDrawerOpen(true);
  }, [selectedCompany]);

  const handleSave = useCallback((id: string, updates: Partial<PayrollEntry>) => {
    updatePayrollEntry(id, updates);
  }, [updatePayrollEntry]);

  const handleCreate = useCallback((employeeId: string, updates: Pick<PayrollEntry, "baseSalary" | "earnings" | "deductions">) => {
    if (!selectedCompany) return;
    const duplicate = payrollEntries.some((entry) => entry.employeeId === employeeId);
    if (duplicate) {
      toast.error("Já existe lançamento para este funcionário na competência atual.");
      return;
    }
    addPayrollEntry({
      id: `p-${employeeId}-${selectedMonth.month}-${selectedMonth.year}`,
      employeeId,
      companyId: selectedCompany.id,
      month: selectedMonth.month,
      year: selectedMonth.year,
      baseSalary: updates.baseSalary,
      earnings: updates.earnings,
      deductions: updates.deductions,
      notes: "",
    });
  }, [addPayrollEntry, payrollEntries, selectedCompany, selectedMonth.month, selectedMonth.year]);

  const clearFilters = () => {
    setSearch("");
    setFilterDept("");
    setFilterRole("");
  };

  const selectedEmployee = selectedEntry
    ? allEmployees.find((e) => e.id === selectedEntry.employeeId) || null
    : null;
  const selectedCreateEmployee = createEmployeeId
    ? allEmployees.find((e) => e.id === createEmployeeId) || null
    : null;
  const drawerEmployee = drawerMode === "create" ? selectedCreateEmployee : selectedEmployee;

  // Comentário: no modo criação, seguimos o contexto atual (empresa/competência) e evitamos funcionário já lançado.
  const availableCreateEmployees: Employee[] = useMemo(() => {
    if (!selectedCompany) return [];
    const existingEmployeeIds = new Set(payrollEntries.map((entry) => entry.employeeId));
    return allEmployees.filter((employee) =>
      employee.companyId === selectedCompany.id &&
      employee.isActive &&
      !existingEmployeeIds.has(employee.id)
    );
  }, [allEmployees, payrollEntries, selectedCompany]);

  const deptName = drawerEmployee?.departmentId
    ? allDepartments.find((d) => d.id === drawerEmployee.departmentId)?.name
    : drawerEmployee?.department || undefined;

  const roleName = drawerEmployee?.jobRoleId
    ? allJobRoles.find((j) => j.id === drawerEmployee.jobRoleId)?.name
    : drawerEmployee?.role || undefined;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Central de Folha</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione empresa e competência, clique em um funcionário para editar valores.
        </p>
      </div>

      <PayrollHeader onNewEntry={handleNewEntry} />
      <TotalsBar />
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
        defaultRubrics={rubrics}
        departmentName={deptName}
        jobRoleName={roleName}
        onSave={handleSave}
        onCreate={handleCreate}
      />
    </div>
  );
};

export default Index;
