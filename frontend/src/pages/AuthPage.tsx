import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Lock, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authApi, storeSession } from "../lib/api";
import { Button, Card, Input } from "../components/ui";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email("Informe um email valido."),
  password: z.string().min(8, "Use pelo menos 8 caracteres."),
  remember: z.boolean().default(true)
});

type FormValues = z.infer<typeof schema>;

export function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const resetToken = new URLSearchParams(window.location.search).get("resetToken");
  const [mode, setMode] = useState<"login" | "register" | "forgot">(resetToken ? "login" : "login");
  const [error, setError] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { remember: true }
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      if (mode === "register") {
        const name = values.name?.trim();
        if (!name || name.length < 2) {
          setError("Informe um nome com pelo menos 2 caracteres.");
          return;
        }
        await authApi.register(name, values.email, values.password);
      }
      const session = await authApi.login(values.email, values.password, values.remember);
      storeSession(session);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel autenticar.");
    }
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    try { const result = await authApi.forgotPassword(forgotEmail); setMessage(result.message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível solicitar a recuperação."); }
  }

  async function submitNewPassword(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!resetToken) return;
    if (resetPassword.length < 8) return setError("Use pelo menos 8 caracteres.");
    if (resetPassword !== resetConfirmation) return setError("As senhas não coincidem.");
    try {
      const result = await authApi.resetPassword(resetToken, resetPassword);
      window.history.replaceState({}, "", window.location.pathname);
      setMessage(result.message); setResetPassword(""); setResetConfirmation(""); setMode("login");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível redefinir a senha."); }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_32%),linear-gradient(135deg,#f8fafc,#eef2ff_48%,#ecfeff)] px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg">
            <CalendarDays aria-hidden size={30} />
          </div>
          <div className="max-w-2xl space-y-4">
            <h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">Agenda OrganizaÍ</h1>
            <p className="text-lg leading-8 text-slate-700">
              Calendario, tarefas, lembretes, equipes, anexos e auditoria em um painel unico para organizar rotinas pessoais e operacoes de trabalho.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Calendario inteligente", "Tarefas com progresso", "Notificacoes e auditoria"].map((item) => (
              <div key={item} className="rounded-lg border border-white/70 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </div>

        <Card className="p-6">
          {resetToken ? (
            <form className="space-y-4" onSubmit={submitNewPassword}>
              <div><h2 className="text-xl font-bold text-slate-950">Criar nova senha</h2><p className="mt-1 text-sm text-slate-500">Informe e confirme sua nova senha.</p></div>
              <label className="block space-y-2 text-sm font-medium"><span>Nova senha</span><Input type="password" autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required /></label>
              <label className="block space-y-2 text-sm font-medium"><span>Confirmar senha</span><Input type="password" autoComplete="new-password" value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} required /></label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="w-full">Redefinir senha</Button>
            </form>
          ) : mode === "forgot" ? (
            <form className="space-y-4" onSubmit={requestPasswordReset}>
              <div><h2 className="text-xl font-bold text-slate-950">Recuperar senha</h2><p className="mt-1 text-sm text-slate-500">Enviaremos um link válido por 30 minutos.</p></div>
              <label className="block space-y-2 text-sm font-medium"><span>E-mail</span><Input type="email" autoComplete="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} required /></label>
              {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button className="w-full">Enviar link de recuperação</Button>
              <button type="button" className="w-full text-sm font-semibold text-blue-600" onClick={() => { setMode("login"); setMessage(null); }}>Voltar ao login</button>
            </form>
          ) : <>
          <div className="mb-6 flex rounded-md bg-slate-100 p-1">
            <button className={`h-10 flex-1 rounded-md text-sm font-semibold ${mode === "login" ? "bg-white shadow-sm" : "text-slate-600"}`} onClick={() => setMode("login")}>
              Login
            </button>
            <button className={`h-10 flex-1 rounded-md text-sm font-semibold ${mode === "register" ? "bg-white shadow-sm" : "text-slate-600"}`} onClick={() => setMode("register")}>
              Cadastro
            </button>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            {mode === "register" && (
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Nome</span>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
                  <Input className="pl-10" autoComplete="name" minLength={2} required {...register("name")} />
                </div>
              </label>
            )}
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input className="pl-10" type="email" autoComplete="email" {...register("email")} />
              </div>
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              <span>Senha</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
                <Input className="pl-10" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} {...register("password")} />
              </div>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register("remember")} />
              Lembrar login
            </label>
            {Object.values(formState.errors)[0]?.message && <p className="text-sm text-red-600">{Object.values(formState.errors)[0]?.message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
            <Button className="w-full" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Entrando..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
            {mode === "login" && <button type="button" className="w-full text-sm font-semibold text-blue-600 hover:text-blue-800" onClick={() => setMode("forgot")}>Esqueci minha senha</button>}
          </form>
          </>}
        </Card>
      </div>
    </main>
  );
}
