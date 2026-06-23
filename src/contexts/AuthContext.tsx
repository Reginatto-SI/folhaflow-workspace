import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

type Profile = {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
};

export type AppRole = "admin" | "operacional" | "consulta" | "desenvolvedor";
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
  roles: AppRole[];
  permissions: Set<AppPermission>;
  hasPermission: (perm: AppPermission) => boolean;
  hasRole: (role: AppRole) => boolean;
  getDefaultAuthenticatedPath: () => string;
  isAdmin: boolean;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAIN_ROLE_PRIORITY: AppRole[] = ["admin", "operacional", "consulta", "desenvolvedor"];
const DEFAULT_PATHS: { permission: AppPermission; path: string }[] = [
  { permission: "relatorios.view", path: "/dashboard" },
  { permission: "folha.operar", path: "/central-de-folha" },
  { permission: "empresas.view", path: "/empresas" },
  { permission: "funcionarios.view", path: "/funcionarios" },
  { permission: "estrutura.view", path: "/setores" },
  { permission: "usuarios.manage", path: "/usuarios" },
  { permission: "configuracoes.manage", path: "/configuracoes" },
  { permission: "rubricas.manage", path: "/rubricas" },
];

type AuthBundle = {
  profile: Profile | null;
  role: AppRole | null;
  roles: AppRole[];
  permissions: Set<AppPermission>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<AppPermission>>(new Set());
  const [loading, setLoading] = useState(true);

  // Busca profile + todas as roles e agrega as permissões vinculadas a cada role.
  const fetchAuthBundle = async (userId: string): Promise<AuthBundle> => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const prof = (profileRes.data as Profile | null) ?? null;
    const userRoles = Array.from(new Set(((roleRes.data ?? []) as { role: AppRole }[]).map((item) => item.role)));
    const mainRole = MAIN_ROLE_PRIORITY.find((candidate) => userRoles.includes(candidate)) ?? null;

    let perms = new Set<AppPermission>();
    if (userRoles.length > 0) {
      const { data: permData } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", userRoles);
      perms = new Set(((permData ?? []) as { permission: AppPermission }[]).map((p) => p.permission));
    }
    return { profile: prof, role: mainRole, roles: userRoles, permissions: perms };
  };

  useEffect(() => {
    let isMounted = true;

    const clearAuthState = () => {
      setUser(null);
      setProfile(null);
      setRole(null);
      setRoles([]);
      setPermissions(new Set());
    };

    const applySession = (session: Session | null, bundle: AuthBundle) => {
      if (!isMounted) return;

      if (bundle.profile && !bundle.profile.is_active) {
        supabase.auth.signOut();
        clearAuthState();
        setLoading(false);
        toast.error("Usuário inativo. Contate o administrador.");
        return;
      }

      setUser(session?.user ?? null);
      setProfile(bundle.profile);
      setRole(bundle.role);
      setRoles(bundle.roles);
      setPermissions(bundle.permissions);
      setLoading(false);
    };

    // Listener: SEM await — fire-and-forget para evitar deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        clearAuthState();
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
    setRoles([]);
    setPermissions(new Set());
  };

  const contextValue = useMemo(() => {
    const hasPermission = (perm: AppPermission) => permissions.has(perm);
    const hasRole = (candidate: AppRole) => roles.includes(candidate);
    const getDefaultAuthenticatedPath = () => DEFAULT_PATHS.find((item) => permissions.has(item.permission))?.path ?? "/";

    return {
      user,
      profile,
      role,
      roles,
      permissions,
      hasPermission,
      hasRole,
      getDefaultAuthenticatedPath,
      isAdmin: roles.includes("admin"),
      loading,
      isAuthenticated: !!user && !!profile,
      signIn,
      signOut,
    };
  }, [loading, permissions, profile, role, roles, user]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
