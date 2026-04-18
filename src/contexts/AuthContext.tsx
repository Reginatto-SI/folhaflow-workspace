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

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) return null;
    return data as Profile;
  };

  useEffect(() => {
    let isMounted = true;

    const applySession = (session: Session | null, prof: Profile | null) => {
      if (!isMounted) return;

      if (prof && !prof.is_active) {
        supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setLoading(false);
        toast.error("Usuário inativo. Contate o administrador.");
        return;
      }

      setUser(session?.user ?? null);
      setProfile(prof);
      setLoading(false);
    };

    // Listener: SEM await — fire-and-forget para evitar deadlock no cliente Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      fetchProfile(session.user.id).then((prof) => applySession(session, prof));
    });

    // Hidratação inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      if (!session?.user) {
        setLoading(false);
        return;
      }
      fetchProfile(session.user.id).then((prof) => applySession(session, prof));
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
    // O listener onAuthStateChange tratará da sessão e atualizará o estado.
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
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
