import React, { useMemo, useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BriefcaseBusiness, Building2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { JobRole } from "@/types/payroll";
import { toast } from "sonner";

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

type FormState = {
  name: string;
  companyId: string;
  isActive: boolean;
};

const getInitialForm = (companyId = ""): FormState => ({
  name: "",
  companyId,
  isActive: true,
});

const JobRoles: React.FC = () => {
  const { companies, selectedCompany, jobRoles, addJobRole, updateJobRole, deleteJobRole, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobRole | null>(null);
  const [form, setForm] = useState<FormState>(getInitialForm());

  // Comentário: funções/cargos por empresa evitam conflito de nomenclatura e permitem governança operacional por CNPJ de registro.
  const companyNameMap = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies]
  );

  const openNew = () => {
    setEditing(null);
    setForm(getInitialForm(selectedCompany?.id || ""));
    setOpen(true);
  };

  const openEdit = (jobRole: JobRole) => {
    setEditing(jobRole);
    setForm({ name: jobRole.name, companyId: jobRole.companyId, isActive: jobRole.isActive });
    setOpen(true);
  };

  const handleSave = async () => {
    const normalizedName = normalizeText(form.name);

    if (!normalizedName) {
      toast.error("Informe o nome da função/cargo.");
      return;
    }

    if (!form.companyId) {
      toast.error("Selecione a empresa vinculada.");
      return;
    }

    try {
      if (editing) {
        await updateJobRole(editing.id, { name: normalizedName, companyId: form.companyId, isActive: form.isActive });
        toast.success("Função/cargo atualizado.");
      } else {
        await addJobRole({ name: normalizedName, companyId: form.companyId, isActive: form.isActive });
        toast.success("Função/cargo criada.");
      }
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar a função/cargo.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJobRole(id);
      toast.success("Função/cargo removida.");
    } catch {
      toast.error("Não foi possível remover a função/cargo.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Funções/Cargos</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro administrativo oficial de funções/cargos por empresa — {jobRoles.length} registros na empresa selecionada.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Nova Função/Cargo
            </Button>
          </DialogTrigger>
          <DialogContent className="flex h-[65vh] max-h-[65vh] max-w-2xl flex-col overflow-hidden">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-xl">{editing ? "Editar função/cargo" : "Nova função/cargo"}</DialogTitle>
              <p className="text-sm text-muted-foreground">Modal administrativo com estrutura fixa seguindo padrão da tela piloto.</p>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1">
              <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold">Dados da função/cargo</h3>
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Empresa vinculada *</Label>
                  <Select value={form.companyId} onValueChange={(value) => setForm((prev) => ({ ...prev, companyId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.isActive ? "ativo" : "inativo"} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value === "ativo" }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </section>

              {/* Comentário: integração futura com funcionários deve filtrar funções ativas pela empresa registrada do colaborador. */}
              <p className="text-xs text-muted-foreground">Futuro no cadastro de funcionário: campo de função/cargo consumirá somente funções/cargos ativos da empresa registrada.</p>
            </div>

            <DialogFooter className="border-t pt-3 sm:justify-between">
              <p className="text-xs text-muted-foreground">Estrutura mínima séria para padronização dos próximos cadastros administrativos.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
                <Button onClick={() => void handleSave()}>
                  <Save className="mr-1 h-4 w-4" /> Salvar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando funções/cargos...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Função/Cargo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa vinculada</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {jobRoles.map((jobRole) => (
                <tr key={jobRole.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <BriefcaseBusiness className="h-3.5 w-3.5" /> {jobRole.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {companyNameMap[jobRole.companyId] || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={jobRole.isActive ? "default" : "secondary"} className={jobRole.isActive ? "bg-success text-success-foreground" : ""}>
                      {jobRole.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(jobRole)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(jobRole.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {jobRoles.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhuma função/cargo cadastrada para esta empresa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default JobRoles;
