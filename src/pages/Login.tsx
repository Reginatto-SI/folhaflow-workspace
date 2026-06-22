import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Code2, Lock, LogIn, Mail, ShieldCheck } from "lucide-react";

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success("Bem-vindo!");
      navigate("/", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <section className="relative hidden min-h-screen w-[42%] overflow-hidden bg-gradient-to-br from-red-700 via-primary to-red-900 lg:block">
        <div className="absolute -left-32 top-1/2 z-0 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full border-[5rem] border-white/5" />
        <div className="absolute -bottom-48 -right-28 z-0 h-[46rem] w-[46rem] rounded-full bg-white/8" />
        <div className="absolute -right-44 top-0 z-0 h-[62rem] w-[34rem] -rotate-12 rounded-[50%] bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.10),transparent_28%),radial-gradient(circle_at_15%_78%,rgba(255,255,255,0.08),transparent_34%)]" />

        <div className="absolute -right-56 top-0 z-0 h-full w-[28rem] rounded-l-[100%] bg-slate-50/95" />

        <div className="absolute bottom-24 left-12 z-10 flex max-w-md gap-7 xl:left-16">
          <div className="mt-1 h-44 w-0.5 rounded-full bg-amber-400" />
          <div className="text-white">
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight xl:text-[2.7rem]">
              Folha de pagamento
              <br />
              com controle, agilidade
              <br />e confiança.
            </h1>
            <p className="mt-5 text-xl font-medium leading-snug text-white/90">
              Cálculos organizados para
              <br />
              uma operação mais segura.
            </p>
          </div>
        </div>
      </section>

      <main className="relative flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-8 sm:px-8 lg:px-10 xl:px-16">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 hidden h-[28rem] w-[34rem] rounded-[50%] bg-white lg:block" />
          <div className="absolute right-0 top-0 h-72 w-72 rounded-full border border-slate-200/70 opacity-70" />
          <div className="absolute right-10 top-10 h-56 w-56 rounded-full border border-slate-200/60 opacity-60" />
          <div className="absolute bottom-12 right-16 h-24 w-24 rounded-full bg-red-50/70 blur-2xl" />
        </div>

        <div className="relative z-10 flex w-full max-w-[42rem] flex-col items-center lg:ml-8 xl:ml-16">
          <div className="mb-5 flex w-full items-center justify-center gap-4 rounded-3xl bg-gradient-to-r from-red-700 to-primary p-4 text-white shadow-lg shadow-red-900/15 lg:hidden">
            <div className="h-12 w-0.5 rounded-full bg-amber-400" />
            <div>
              <p className="text-base font-bold leading-tight">Folha de pagamento com agilidade.</p>
              <p className="text-sm text-white/85">Cálculos organizados para uma operação segura.</p>
            </div>
          </div>

          <div className="w-full rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-[0_28px_80px_rgba(15,23,42,0.16)] backdrop-blur sm:p-9 lg:p-12">
            <div className="flex flex-col items-center text-center">
              <img src="/logo_Vermelha_Laranja.svg" alt="Delicious Fish" className="h-16 w-auto sm:h-20" />
              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">Acessar sistema</h2>
              <p className="mt-3 text-base text-slate-500 sm:text-lg">Sistema de folha de pagamento</p>
              <div className="mt-5 h-0.5 w-12 rounded-full bg-amber-400" />
            </div>

            {/* Sistema interno: mantém somente o login para usuários criados pelo administrador. */}
            <form onSubmit={handleSignIn} className="mt-9 space-y-6">
              <div className="space-y-2.5">
                <Label htmlFor="email" className="text-base font-medium text-slate-800">
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="h-14 rounded-xl border-slate-300 bg-white pl-14 text-base shadow-sm transition focus-visible:ring-red-200"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="password" className="text-base font-medium text-slate-800">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-14 rounded-xl border-slate-300 bg-white pl-14 text-base shadow-sm transition focus-visible:ring-red-200"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="h-14 w-full rounded-xl bg-primary text-base font-semibold shadow-[0_16px_30px_rgba(220,38,38,0.25)] transition hover:bg-red-700"
                disabled={submitting}
              >
                <LogIn className="mr-3 h-5 w-5" />
                {submitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="mt-8 flex items-center gap-4 text-slate-300">
              <div className="h-px flex-1 bg-slate-200" />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-500 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>
            <p className="mt-3 text-center text-sm leading-relaxed text-slate-500">
              Acesso interno • usuários cadastrados pelo administrador
            </p>
          </div>

          <footer className="mt-10 flex items-start justify-center gap-4 text-center text-sm leading-relaxed text-slate-500">
            <div className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-100 bg-white text-primary shadow-sm sm:flex">
              <Code2 className="h-4 w-4" />
            </div>
            <div>
              <p>Desenvolvido por Reginatto Sistemas</p>
              <p>reginattosistemas.com.br • (65) 9 9210-2030</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Login;
