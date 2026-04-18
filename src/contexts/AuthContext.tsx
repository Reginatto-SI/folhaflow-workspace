import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

type Profile = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
};

export type AppRole = "admin" | "operacional" | "consulta";
export type AppPermission =
  | "empresas.view"
  | "funcionarios.view"
  | "estrutura.view"
  | "rubricas.manage"
  | "folha.operar"
  | "relatorios.view"
  | "usuarios.manage"
  | "configuracoes.manage";

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: Set<AppPermission>;
  hasPermission: (perm: AppPermission) => boolean;
  isAdmin: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthBundle = {
  profile: Profile | null;
  role: AppRole | null;
  permissions: Set<AppPermission>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<Set<AppPermission>>(new Set());
  const [loading, setLoading] = useState(true);

  // Busca profile + role + permissões em paralelo (single roundtrip lógico)
  const fetchAuthBundle = async (userId: string): Promise<AuthBundle> => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    ]);

    const prof = (profileRes.data as Profile | null) ?? null;
    const r = (roleRes.data?.role as AppRole | undefined) ?? null;

    let perms = new Set<AppPermission>();
    if (r) {
      const { data: permData } = await supabase
        .from("role_permissions")
        .select("permission")
        .eq("role", r);
      perms = new Set(((permData ?? []) as { permission: AppPermission }[]).map((p) => p.permission));
    }
    return { profile: prof, role: r, permissions: perms };
  };

  useEffect(() => {
    let isMounted = true;

    const applySession = (session: Session | null, bundle: AuthBundle) => {
      if (!isMounted) return;

      if (bundle.profile && !bundle.profile.is_active) {
        supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setRole(null);
        setPermissions(new Set());
        setLoading(false);
        toast.error("Usuário inativo. Contate o administrador.");
        return;
      }

      setUser(session?.user ?? null);
      setProfile(bundle.profile);
      setRole(bundle.role);
      setPermissions(bundle.permissions);
      setLoading(false);
    };

    // Listener: SEM await — fire-and-forget para evitar deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setRole(null);
        setPermissions(new Set());
        setLoading(false);
        return;
      }
      fetchAuthBundle(session.user.id).then((b) => applySession(session, b));
    });

    // Hidratação inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (!session?.user) {
        setLoading(false);
        return;
      }
      fetchAuthBundle(session.user.id).then((b) => applySession(session, b));
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
    setPermissions(new Set());
  };

  const hasPermission = (perm: AppPermission) => permissions.has(perm);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        permissions,
        hasPermission,
        isAdmin: role === "admin",
        loading,
        isAuthenticated: !!user && !!profile,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
