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
  const oauthError = new URLSearchParams(window.location.search).get("oauthError");
  const inviteToken = new URLSearchParams(window.location.search).get("invite") || sessionStorage.getItem("agenda_network_invite");
  const organizationInvite = new URLSearchParams(window.location.search).get("organizationInvite") || sessionStorage.getItem("agenda_organization_invite");
  const [mode, setMode] = useState<"login" | "register" | "forgot">(resetToken ? "login" : "login");
  const [error, setError] = useState<string | null>(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPasswords, setShowResetPasswords] = useState(false);
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
            <p className="text-sm font-bold uppercase tracking-widest text-blue-700">SaaS livre, gratuito e em evolução</p>
            <h1 className="text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">OrganizaI — Agenda profissional gratuita para equipes</h1>
            <p className="text-lg leading-8 text-slate-700">
              Organize agenda, tarefas, equipes e reuniões online em um único painel. Planeje o trabalho, compartilhe responsabilidades e acompanhe cada entrega gratuitamente.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Agenda compartilhada", "Tarefas em equipe", "Reuniões e produtividade"].map((item) => (
              <div key={item} className="rounded-lg border border-white/70 bg-white/70 p-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                {item}
              </div>
            ))}
          </div>
        </div>

        <Card className="p-6">
          {inviteToken && <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800"><strong>Você recebeu um convite para a rede OrganizaÍ.</strong><span className="mt-1 block">Cadastre-se ou entre para aceitar automaticamente.</span></div>}
          {organizationInvite && <div className="mb-5 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800"><strong>Você recebeu um convite para uma organização.</strong><span className="mt-1 block">Entre ou cadastre-se para visualizar, aceitar ou recusar.</span></div>}
          {resetToken ? (
            <form className="space-y-4" onSubmit={submitNewPassword}>
              <div><h2 className="text-xl font-bold text-slate-950">Criar nova senha</h2><p className="mt-1 text-sm text-slate-500">Informe e confirme sua nova senha.</p></div>
              <label className="block space-y-2 text-sm font-medium"><span>Nova senha</span><Input type={showResetPasswords ? "text" : "password"} autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required /></label>
              <label className="block space-y-2 text-sm font-medium"><span>Confirmar senha</span><Input type={showResetPasswords ? "text" : "password"} autoComplete="new-password" value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} required /></label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" checked={showResetPasswords} onChange={(event) => setShowResetPasswords(event.target.checked)} />Mostrar senhas</label>
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
            <button type="button" onClick={() => window.location.assign("/api/auth/oauth/google")} className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-slate-50">
              <GoogleLogo />
              Continuar com Google
            </button>
            <button type="button" onClick={() => window.location.assign("/api/auth/oauth/microsoft")} className="flex h-11 w-full items-center justify-center gap-3 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-slate-50">
              <MicrosoftLogo />
              Continuar com Microsoft
            </button>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>ou use seu e-mail</span><span className="h-px flex-1 bg-slate-200" /></div>
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
                <Input className="pl-10" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} {...register("password")} />
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-blue-600" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
              Mostrar senha
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register("remember")} />
              Lembrar login
            </label>
            {Object.values(formState.errors)[0]?.message && <p className="text-sm text-red-600">{Object.values(formState.errors)[0]?.message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {oauthError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{oauthError}</p>}
            {message && <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
            <Button className="w-full" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Entrando..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
            {mode === "login" && <button type="button" className="w-full text-sm font-semibold text-blue-600 hover:text-blue-800" onClick={() => setMode("forgot")}>Esqueci minha senha</button>}
          </form>
          </>}
        </Card>
      </div>
      <section className="mx-auto mt-16 max-w-6xl border-t border-slate-200 pt-12" aria-labelledby="sobre-organizai">
        <div className="max-w-3xl">
          <h2 id="sobre-organizai" className="text-3xl font-bold text-slate-950">Agenda online gratuita para organizar seu trabalho</h2>
          <p className="mt-4 text-base leading-7 text-slate-700">O OrganizaI reúne calendário, tarefas, equipes e reuniões em uma ferramenta de produtividade simples. É uma alternativa gratuita para profissionais e equipes que precisam planejar compromissos, distribuir atividades e acompanhar resultados sem depender de várias plataformas.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm"><h3 className="font-bold text-slate-950">Agenda e calendário para equipes</h3><p className="mt-2 text-sm leading-6 text-slate-600">Cadastre eventos, compartilhe compromissos, vincule equipes e mantenha reuniões online organizadas com data, horário e link de videoconferência.</p></article>
          <article className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm"><h3 className="font-bold text-slate-950">Gestão de tarefas gratuita</h3><p className="mt-2 text-sm leading-6 text-slate-600">Crie tarefas, defina responsáveis e prazos, acompanhe o progresso e preserve relatórios das atividades concluídas.</p></article>
          <article className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm"><h3 className="font-bold text-slate-950">Produtividade em qualquer dispositivo</h3><p className="mt-2 text-sm leading-6 text-slate-600">Use pelo navegador no computador ou celular, receba notificações e mantenha sua rotina profissional acessível onde estiver.</p></article>
        </div>
        <div className="mt-10 rounded-2xl bg-slate-950 p-6 text-white sm:p-8"><h2 className="text-2xl font-bold">Um SaaS gratuito e em evolução</h2><p className="mt-3 max-w-3xl leading-7 text-slate-300">O OrganizaI continua evoluindo para oferecer uma agenda profissional completa, livre para começar e adequada a rotinas pessoais, equipes e projetos.</p></div>
      </section>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#EA4335" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z" />
      <path fill="#4285F4" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.167.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
      <path fill="#34A853" d="M9 3.58c1.322 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.43 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
      <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
      <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
      <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
    </svg>
  );
}
