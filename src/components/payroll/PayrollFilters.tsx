import React from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { Department, JobRole } from "@/types/payroll";

interface PayrollFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  departmentId: string;
  onDepartmentChange: (v: string) => void;
  jobRoleId: string;
  onJobRoleChange: (v: string) => void;
  departments: Department[];
  jobRoles: JobRole[];
  onClear: () => void;
}

const PayrollFilters: React.FC<PayrollFiltersProps> = ({
  search, onSearchChange,
  departmentId, onDepartmentChange,
  jobRoleId, onJobRoleChange,
  departments, jobRoles, onClear,
}) => {
  const hasFilters = search || departmentId || jobRoleId;

  return (
    <div className="bg-card border rounded-lg p-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={departmentId} onValueChange={onDepartmentChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Todos os setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {departments.filter((d) => d.isActive).map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={jobRoleId} onValueChange={onJobRoleChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Todas as funções" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as funções</SelectItem>
            {jobRoles.filter((j) => j.isActive).map((j) => (
              <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear} className="h-9">
            <X className="h-4 w-4 mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
};

export default PayrollFilters;
