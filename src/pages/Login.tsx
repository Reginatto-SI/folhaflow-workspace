import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Layout principal ajustado para centralização real e leitura limpa em todas as telas.
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-8 sm:px-6">
      {/* Fundo institucional vermelho reaproveitando o token existente `primary`. */}
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.22)] sm:p-8">
        {/* Card branco central refinado sem borda aparente e com destaque suave. */}
        <div className="flex flex-col items-center gap-2 text-center">
          <img
            src="/logo_Vermelha_Laranja.svg"
            alt="FolhaFlow"
            className="h-14 w-auto"
          />
          <p className="text-sm text-slate-600">Acesse o sistema de folha de pagamento</p>
        </div>

        {/* Espaçamentos, inputs e botão refinados mantendo os componentes e tokens já existentes. */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-slate-800">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="h-11 border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:ring-primary/80"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-slate-800">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:ring-primary/80"
            />
          </div>
          <Button type="submit" className="mt-2 h-11 w-full" disabled={submitting}>
            <LogIn className="mr-2 h-4 w-4" />
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        {/* Rodapé institucional discreto com crédito de desenvolvimento */}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
          Uso interno — Grupo Delicious Fish
          <span className="mt-1 block">Desenvolvido por Edimar Reginato</span>
        </p>
      </div>
    </div>
  );
};

export default Login;
