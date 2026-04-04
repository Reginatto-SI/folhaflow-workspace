import React, { useMemo, useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Department } from "@/types/payroll";
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

const Departments: React.FC = () => {
  const { companies, selectedCompany, departments, addDepartment, updateDepartment, deleteDepartment, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<FormState>(getInitialForm());

  // Comentário: decisão funcional - setor é cadastrado por empresa para refletir estruturas organizacionais diferentes no contexto multiempresa.
  const companyNameMap = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies]
  );

  const openNew = () => {
    setEditing(null);
    setForm(getInitialForm(selectedCompany?.id || ""));
    setOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditing(department);
    setForm({ name: department.name, companyId: department.companyId, isActive: department.isActive });
    setOpen(true);
  };

  const handleSave = async () => {
    const normalizedName = normalizeText(form.name);

    if (!normalizedName) {
      toast.error("Informe o nome do setor.");
      return;
    }

    if (!form.companyId) {
      toast.error("Selecione a empresa vinculada.");
      return;
    }

    try {
      if (editing) {
        await updateDepartment(editing.id, { name: normalizedName, companyId: form.companyId, isActive: form.isActive });
        toast.success("Setor atualizado.");
      } else {
        await addDepartment({ name: normalizedName, companyId: form.companyId, isActive: form.isActive });
        toast.success("Setor criado.");
      }
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar o setor.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDepartment(id);
      toast.success("Setor removido.");
    } catch {
      toast.error("Não foi possível remover o setor.");
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Setores</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro administrativo oficial de setores por empresa — {departments.length} registros na empresa selecionada.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Novo Setor
            </Button>
          </DialogTrigger>
          <DialogContent className="flex h-[65vh] max-h-[65vh] max-w-2xl flex-col overflow-hidden">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-xl">{editing ? "Editar setor" : "Novo setor"}</DialogTitle>
              <p className="text-sm text-muted-foreground">Modal administrativo com estrutura fixa seguindo padrão da tela piloto.</p>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-3 pr-1">
              <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                <h3 className="text-sm font-semibold">Dados do setor</h3>
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

              {/* Comentário: base preparada para futura integração no cadastro de funcionário, substituindo campo livre por seleção estruturada. */}
              <p className="text-xs text-muted-foreground">
                Futuro no cadastro de funcionário: campo de setor passará a consumir somente setores ativos da empresa registrada.
              </p>
            </div>

            <DialogFooter className="border-t pt-3 sm:justify-between">
              <p className="text-xs text-muted-foreground">Cadastro enxuto e consistente para operação RH/Financeiro.</p>
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
        <div className="text-sm text-muted-foreground">Carregando setores...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa vinculada</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {departments.map((department) => (
                <tr key={department.id} className="border-b transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{department.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {companyNameMap[department.companyId] || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={department.isActive ? "default" : "secondary"} className={department.isActive ? "bg-success text-success-foreground" : ""}>
                      {department.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(department)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(department.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {departments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhum setor cadastrado para esta empresa.
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

export default Departments;
