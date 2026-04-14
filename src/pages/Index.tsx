import React, { useState, useMemo, useCallback } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import PayrollHeader from "@/components/payroll/PayrollHeader";
import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollFilters from "@/components/payroll/PayrollFilters";
import PayrollTable from "@/components/payroll/PayrollTable";
import EmployeeDrawer from "@/components/payroll/EmployeeDrawer";
import { PayrollEntry } from "@/types/payroll";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Index = () => {
  const {
    payrollEntries, employees, allEmployees, allDepartments, allJobRoles,
    departments, jobRoles, updatePayrollEntry, addPayrollEntry, selectedCompany, selectedMonth,
  } = usePayroll();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [isSavingNewEntry, setIsSavingNewEntry] = useState(false);

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
    setSelectedEntry(entry);
    setDrawerOpen(true);
  }, []);

  const handleSave = useCallback((id: string, updates: Partial<PayrollEntry>) => {
    return updatePayrollEntry(id, updates);
  }, [updatePayrollEntry]);

  const availableEmployeesForEntry = useMemo(() => {
    const alreadyInPayroll = new Set(payrollEntries.map((entry) => entry.employeeId));
    return employees.filter((employee) => employee.isActive && !alreadyInPayroll.has(employee.id));
  }, [employees, payrollEntries]);

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

    const employee = employees.find((item) => item.id === newEmployeeId);
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
        baseSalary: employee.baseSalary,
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
  }, [addPayrollEntry, employees, newEmployeeId, selectedCompany, selectedMonth.month, selectedMonth.year]);

  const clearFilters = () => {
    setSearch("");
    setFilterDept("");
    setFilterRole("");
  };

  const selectedEmployee = selectedEntry
    ? allEmployees.find((e) => e.id === selectedEntry.employeeId) || null
    : null;

  const deptName = selectedEmployee?.departmentId
    ? allDepartments.find((d) => d.id === selectedEmployee.departmentId)?.name
    : selectedEmployee?.department || undefined;

  const roleName = selectedEmployee?.jobRoleId
    ? allJobRoles.find((j) => j.id === selectedEmployee.jobRoleId)?.name
    : selectedEmployee?.role || undefined;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold tracking-tight">Central de Folha</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione empresa e competência, clique em um funcionário para editar valores.
        </p>
      </div>

      <PayrollHeader onNewEntry={handleOpenNewEntry} />
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
        entry={selectedEntry}
        employee={selectedEmployee}
        departmentName={deptName}
        jobRoleName={roleName}
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
              <p className="text-xs text-muted-foreground">
                Todos os funcionários ativos já possuem lançamento para esta competência.
              </p>
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
