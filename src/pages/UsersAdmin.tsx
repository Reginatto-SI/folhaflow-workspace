import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Check,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, type AppRole } from "@/contexts/AuthContext";

type Profile = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  role: AppRole | null;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  role: AppRole;
};

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrador",
  operacional: "Operacional",
  consulta: "Consulta",
};

const ROLE_BADGE: Record<AppRole, "default" | "secondary" | "outline"> = {
  admin: "default",
  operacional: "secondary",
  consulta: "outline",
};

const getInitialForm = (): FormState => ({ name: "", email: "", password: "", role: "operacional" });

const UsersAdmin: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<FormState>(getInitialForm());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const fetchProfiles = async () => {
    // Busca perfis e roles em paralelo, depois faz merge no cliente
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    if (profilesRes.error) {
      toast.error("Erro ao carregar usuários.");
      return;
    }
    const roleByUser = new Map<string, AppRole>();
    (rolesRes.data ?? []).forEach((r) => {
      roleByUser.set(r.user_id, r.role as AppRole);
    });

    const merged: Profile[] = (profilesRes.data ?? []).map((p) => ({
      ...(p as Omit<Profile, "role">),
      role: roleByUser.get((p as { id: string }).id) ?? null,
    }));
    setProfiles(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const filtered = useMemo(() => {
    if (!search) return profiles;
    const s = search.toLowerCase();
    return profiles.filter(
      (p) => p.name.toLowerCase().includes(s) || p.email.toLowerCase().includes(s)
    );
  }, [profiles, search]);

  const kpis = useMemo(() => {
    const total = profiles.length;
    const active = profiles.filter((p) => p.is_active).length;
    return { total, active, inactive: total - active };
  }, [profiles]);

  const openNew = () => {
    setEditing(null);
    setForm(getInitialForm());
    setOpen(true);
  };

  const openEdit = (profile: Profile) => {
    setEditing(profile);
    setForm({
      name: profile.name,
      email: profile.email,
      password: "",
      role: profile.role ?? "operacional",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const email = form.email.trim();

    if (!name || !email) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    if (!form.role) {
      toast.error("Selecione o papel do usuário.");
      return;
    }

    if (!editing && !form.password) {
      toast.error("Informe a senha inicial.");
      return;
    }

    if (form.password && form.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    // Salvaguarda no cliente: admin não pode rebaixar a si mesmo (também é validado no backend)
    if (editing && currentUser?.id === editing.id && editing.role === "admin" && form.role !== "admin") {
      toast.error("Você não pode remover seu próprio papel de administrador.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          userId: editing.id,
          name,
          email,
          role: form.role,
        };
        if (form.password) payload.password = form.password;

        const { data, error } = await supabase.functions.invoke("admin-update-user", {
          body: payload,
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        toast.success("Usuário atualizado.");
      } else {
        const { data, error } = await supabase.functions.invoke("admin-create-user", {
          body: { name, email, password: form.password, role: form.role },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        toast.success("Usuário criado.");
      }
      setOpen(false);
      await fetchProfiles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (profile: Profile) => {
    if (currentUser?.id === profile.id && profile.is_active) {
      toast.error("Você não pode inativar a si mesmo.");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { userId: profile.id, isActive: !profile.is_active },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(profile.is_active ? "Usuário inativado." : "Usuário ativado.");
      await fetchProfiles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao alterar status.";
      toast.error(message);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Usuários</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} de {profiles.length} usuários
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-xl">
                {editing ? "Editar usuário" : "Novo usuário"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Papel *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm((p) => ({ ...p, role: v as AppRole }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="consulta">Consulta</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {form.role === "admin" && "Acesso total ao sistema."}
                  {form.role === "operacional" && "Opera folha, empresas, funcionários e estrutura."}
                  {form.role === "consulta" && "Acesso somente leitura a empresas, funcionários e relatórios."}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>{editing ? "Nova senha (opcional)" : "Senha *"}</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder={editing ? "Deixe vazio para manter" : "Mínimo 6 caracteres"}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setOpen(false)}>
                <X className="mr-1 h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                <Save className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold tabular-nums">{kpis.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10">
            <Check className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-xl font-bold tabular-nums">{kpis.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inativos</p>
            <p className="text-xl font-bold tabular-nums">{kpis.inactive}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 rounded-lg border bg-card px-8 pb-8 pt-6">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Search className="h-3.5 w-3.5" /> Buscar
          </Label>
          <Input
            placeholder="Nome ou e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando usuários...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3">
                      {p.role ? (
                        <Badge variant={ROLE_BADGE[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Sem papel
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={p.is_active ? "default" : "secondary"}>
                        {p.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void toggleActive(p)}>
                            {p.is_active ? (
                              <>
                                <ShieldOff className="mr-2 h-4 w-4" /> Inativar
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="mr-2 h-4 w-4" /> Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersAdmin;
