import React, { useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Employee } from "@/types/payroll";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type EmployeeFormState = Omit<Employee, "id">;

const getInitialForm = (companyId = ""): EmployeeFormState => ({
  companyId,
  name: "",
  cpf: "",
  admissionDate: "",
  registration: "",
  notes: "",
  department: "",
  role: "",
  isMonthly: false,
  isOnLeave: false,
  isActive: true,
  bankName: "",
  bankBranch: "",
  bankAccount: "",
  // Comentário: mantemos esse campo por compatibilidade com a Central de Folha nesta fase.
  baseSalary: 0,
});

const Employees: React.FC = () => {
  const { employees, selectedCompany, addEmployee, updateEmployee, deleteEmployee, isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(getInitialForm());

  const openNew = () => {
    setEditing(null);
    setForm(getInitialForm(selectedCompany?.id || ""));
    setOpen(true);
  };

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setForm({ ...employee });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCompany?.id && !form.companyId) {
      toast.error("Selecione uma empresa antes de cadastrar funcionário.");
      return;
    }

    if (!form.name || !form.cpf || !form.admissionDate) {
      toast.error("Preencha Nome, CPF e Data de Admissão.");
      return;
    }

    const payload: Omit<Employee, "id"> = {
      ...form,
      companyId: form.companyId || selectedCompany?.id || "",
    };

    try {
      if (editing) {
        await updateEmployee(editing.id, payload);
        toast.success("Funcionário atualizado.");
      } else {
        await addEmployee(payload);
        toast.success("Funcionário adicionado.");
      }
      setOpen(false);
    } catch {
      toast.error("Não foi possível salvar o funcionário.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteEmployee(id);
      toast.success("Funcionário removido.");
    } catch {
      toast.error("Não foi possível remover o funcionário.");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Funcionários</h2>
          <p className="text-sm text-muted-foreground">{selectedCompany?.name || "Selecione uma empresa"} — {employees.length} funcionários</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-2">
              {/* Comentário: agrupamento para manter o formulário compacto e previsível para operação. */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Dados pessoais / vínculo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label>Nome Completo</Label><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
                  <div><Label>CPF</Label><Input value={form.cpf} onChange={(event) => setForm((prev) => ({ ...prev, cpf: event.target.value }))} /></div>
                  <div><Label>Data de Admissão</Label><Input type="date" value={form.admissionDate} onChange={(event) => setForm((prev) => ({ ...prev, admissionDate: event.target.value }))} /></div>
                  <div><Label>Registro / Matrícula</Label><Input value={form.registration || ""} onChange={(event) => setForm((prev) => ({ ...prev, registration: event.target.value }))} /></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Dados funcionais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label>Setor</Label><Input value={form.department || ""} onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))} /></div>
                  <div><Label>Função / Cargo</Label><Input value={form.role || ""} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))} /></div>
                  <div><Label>Salário Base</Label><Input type="number" value={form.baseSalary} onChange={(event) => setForm((prev) => ({ ...prev, baseSalary: Number(event.target.value || 0) }))} /></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Dados bancários</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><Label>Banco</Label><Input value={form.bankName || ""} onChange={(event) => setForm((prev) => ({ ...prev, bankName: event.target.value }))} /></div>
                  <div><Label>Agência</Label><Input value={form.bankBranch || ""} onChange={(event) => setForm((prev) => ({ ...prev, bankBranch: event.target.value }))} /></div>
                  <div><Label>Conta</Label><Input value={form.bankAccount || ""} onChange={(event) => setForm((prev) => ({ ...prev, bankAccount: event.target.value }))} /></div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Status e observações</h3>
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.isMonthly} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isMonthly: checked === true }))} />
                    Mensalista
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.isOnLeave} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isOnLeave: checked === true }))} />
                    Afastado
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))} />
                    Ativo
                  </label>
                </div>
                <div>
                  <Label>Observação</Label>
                  <Textarea value={form.notes || ""} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </div>
              </div>

              <Button onClick={() => void handleSave()} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando funcionários...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">CPF</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Setor</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Função</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Salário Base</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Admissão</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{employee.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{employee.cpf}</td>
                  <td className="px-4 py-3 text-muted-foreground">{employee.department || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{employee.role || "-"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(employee.baseSalary)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(employee.admissionDate).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={employee.isActive ? "default" : "secondary"} className={employee.isActive ? "bg-success text-success-foreground" : ""}>
                      {employee.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(employee)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void handleDelete(employee.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum funcionário cadastrado para esta empresa.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Employees;
