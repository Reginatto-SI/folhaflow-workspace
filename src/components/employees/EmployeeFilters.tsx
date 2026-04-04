import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Building2, BriefcaseBusiness, X } from "lucide-react";
import { Department, JobRole } from "@/types/payroll";

export interface EmployeeFilterState {
  search: string;
  status: string;
  departmentId: string;
  jobRoleId: string;
}

export const getInitialFilters = (): EmployeeFilterState => ({
  search: "",
  status: "",
  departmentId: "",
  jobRoleId: "",
});

interface EmployeeFiltersProps {
  filters: EmployeeFilterState;
  onFiltersChange: (filters: EmployeeFilterState) => void;
  departments: Department[];
  jobRoles: JobRole[];
}

const EmployeeFilters: React.FC<EmployeeFiltersProps> = ({ filters, onFiltersChange, departments, jobRoles }) => {
  const hasActiveFilters = filters.search || filters.status || filters.departmentId || filters.jobRoleId;

  const update = (patch: Partial<EmployeeFilterState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="rounded-lg border bg-card px-8 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Filtrar por:</p>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onFiltersChange(getInitialFilters())}>
            <X className="mr-1 h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {/* Search */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Nome ou CPF
          </Label>
          <Input
            placeholder="Buscar por nome ou CPF"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Status
          </Label>
          <Select value={filters.status || "__all__"} onValueChange={(v) => update({ status: v === "__all__" ? "" : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="on_leave">Afastado</SelectItem>
              <SelectItem value="monthly">Mensalista</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Department */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            Setor
          </Label>
          <Select value={filters.departmentId || "__all__"} onValueChange={(v) => update({ departmentId: v === "__all__" ? "" : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os setores</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Job Role */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            Função / Cargo
          </Label>
          <Select value={filters.jobRoleId || "__all__"} onValueChange={(v) => update({ jobRoleId: v === "__all__" ? "" : v })}>
            <SelectTrigger>
              <SelectValue placeholder="Todas as funções" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as funções</SelectItem>
              {jobRoles.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default EmployeeFilters;
