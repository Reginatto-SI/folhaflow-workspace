import React, { useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Employee } from "@/types/payroll";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Employees: React.FC = () => {
  const { employees, selectedCompany, addEmployee, updateEmployee, deleteEmployee } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: "", position: "", baseSalary: "", admissionDate: "", status: "active" as "active" | "inactive" });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", position: "", baseSalary: "", admissionDate: "", status: "active" });
    setOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    setForm({ name: e.name, position: e.position, baseSalary: String(e.baseSalary), admissionDate: e.admissionDate, status: e.status });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.position || !form.baseSalary) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    const data = { name: form.name, position: form.position, baseSalary: parseFloat(form.baseSalary), admissionDate: form.admissionDate, status: form.status as "active" | "inactive" };
    if (editing) {
      updateEmployee(editing.id, data);
      toast.success("Funcionário atualizado.");
    } else {
      addEmployee({ id: `e${Date.now()}`, companyId: selectedCompany?.id || "", ...data });
      toast.success("Funcionário adicionado.");
    }
    setOpen(false);
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
              <div><Label>Cargo</Label><Input value={form.position} onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))} /></div>
              <div><Label>Salário Base</Label><Input type="number" value={form.baseSalary} onChange={(e) => setForm((p) => ({ ...p, baseSalary: e.target.value }))} /></div>
              <div><Label>Data de Admissão</Label><Input type="date" value={form.admissionDate} onChange={(e) => setForm((p) => ({ ...p, admissionDate: e.target.value }))} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as "active" | "inactive" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cargo</th>
              <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Salário Base</th>
              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Admissão</th>
              <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.position}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(e.baseSalary)}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(e.admissionDate).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={e.status === "active" ? "default" : "secondary"} className={e.status === "active" ? "bg-success text-success-foreground" : ""}>
                    {e.status === "active" ? "Ativo" : "Inativo"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { deleteEmployee(e.id); toast.success("Removido."); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum funcionário cadastrado para esta empresa.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Employees;
