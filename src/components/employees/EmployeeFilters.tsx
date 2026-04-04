import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, SlidersHorizontal, Building2, BriefcaseBusiness, ChevronDown, ChevronUp, X } from "lucide-react";
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
  // Comentário: preserva um estado inicial compacto para acelerar o uso diário da listagem.
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const hasActiveFilters = filters.search || filters.status || filters.departmentId || filters.jobRoleId;

  const update = (patch: Partial<EmployeeFilterState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  return (
    <div className="rounded-lg border bg-card px-8 pb-6 pt-6">
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
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" />
            Nome ou CPF
          </Label>
          <Input placeholder="Buscar por nome ou CPF" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        </div>

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
      </div>

      <div className="mt-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowAdvancedFilters((prev) => !prev)}
        >
          {showAdvancedFilters ? (
            <>
              <ChevronUp className="mr-1 h-3.5 w-3.5" />
              Ver menos filtros
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
              Ver mais filtros
            </>
          )}
        </Button>
      </div>

      <div
        aria-hidden={!showAdvancedFilters}
        className={`overflow-hidden transition-all duration-200 ease-out ${showAdvancedFilters ? "mt-4 max-h-[520px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div
          className={`grid gap-4 ${showAdvancedFilters ? "pointer-events-auto" : "pointer-events-none"}`}
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
        >
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
    </div>
  );
};

export default EmployeeFilters;
