import React, { useState, useMemo, useCallback } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import PayrollHeader from "@/components/payroll/PayrollHeader";
import TotalsBar from "@/components/payroll/TotalsBar";
import PayrollFilters from "@/components/payroll/PayrollFilters";
import PayrollTable from "@/components/payroll/PayrollTable";
import EmployeeDrawer from "@/components/payroll/EmployeeDrawer";
import { PayrollEntry } from "@/types/payroll";

const Index = () => {
  const {
    payrollEntries, allEmployees, allDepartments, allJobRoles,
    departments, jobRoles, updatePayrollEntry,
  } = usePayroll();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<PayrollEntry | null>(null);
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
    setSelectedEntry(entry);
    setDrawerOpen(true);
  }, []);

  const handleSave = useCallback((id: string, updates: Partial<PayrollEntry>) => {
    updatePayrollEntry(id, updates);
  }, [updatePayrollEntry]);

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

      <PayrollHeader onNewEntry={() => {/* placeholder */}} />
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
    </div>
  );
};

export default Index;
