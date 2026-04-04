import React, { useState } from "react";
import { usePayroll } from "@/contexts/PayrollContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Company } from "@/types/payroll";
import { toast } from "sonner";

const Companies: React.FC = () => {
  const { companies, addCompany, updateCompany, deleteCompany } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", address: "" });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", address: "" });
    setOpen(true);
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({ name: c.name, cnpj: c.cnpj, address: c.address || "" });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.cnpj) {
      toast.error("Preencha nome e CNPJ.");
      return;
    }
    if (editing) {
      updateCompany(editing.id, form);
      toast.success("Empresa atualizada.");
    } else {
      addCompany({ id: `c${Date.now()}`, ...form });
      toast.success("Empresa criada.");
    }
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteCompany(id);
    toast.success("Empresa removida.");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Empresas</h2>
          <p className="text-sm text-muted-foreground">Gerencie as empresas cadastradas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Empresa" : "Nova Empresa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <Button onClick={handleSave} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map((c) => (
          <Card key={c.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{c.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <p>CNPJ: {c.cnpj}</p>
              {c.address && <p>{c.address}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Companies;
