import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, CheckCircle2, Clock, LogIn, Mail } from "lucide-react";
import { api } from "../lib/api";
import { Badge, Button, Card } from "../components/ui";

type PublicTask = {
  id: string;
  title: string;
  summary?: string;
  description?: string;
  priority: string;
  status: string;
  progress: number;
  startsAt?: string;
  dueAt?: string;
  endsAt?: string;
  completedAt?: string;
  owner: { name: string };
  team?: { name: string };
};

export function PublicTaskSharePage({ token, onEnter }: { token: string; onEnter: (provider: "google" | "microsoft" | "email") => void }) {
  const query = useQuery({ queryKey: ["public-task", token], queryFn: () => api<{ task: PublicTask; expiresAt: string }>(`/api/tasks/public/${encodeURIComponent(token)}`), retry: false });
  const task = query.data?.task;
  const deadline = task?.dueAt ?? task?.endsAt;
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <Card className="w-full max-w-2xl overflow-hidden shadow-xl">
        <header className="bg-slate-950 px-6 py-5 text-white"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600"><CheckCircle2 size={20} /></span><div><h1 className="font-bold">Tarefa compartilhada</h1><p className="text-xs text-slate-300">Acesso externo somente leitura</p></div></div></header>
        {query.isLoading && <p className="p-8 text-center text-sm text-slate-500">Carregando tarefa...</p>}
        {query.isError && <p className="m-6 rounded-lg border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700">Este link não existe, expirou ou foi revogado.</p>}
        {task && <div className="space-y-5 p-4 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-blue-700">{task.priority}</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{task.title}</h2>{task.summary && <p className="mt-1 text-sm text-slate-500">{task.summary}</p>}</div><Badge>{task.completedAt ? "Concluída" : `${task.progress}%`}</Badge></div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.description || "Sem descrição."}</p><div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-500"><CalendarDays size={14} className="mr-1 inline" />Responsável pelo envio</p><p className="mt-1">{task.owner.name}</p></div><div><p className="text-xs font-bold uppercase text-slate-500"><Clock size={14} className="mr-1 inline" />Prazo</p><p className="mt-1">{deadline ? format(new Date(deadline), "dd/MM/yyyy 'às' HH:mm") : "Sem prazo"}</p></div>{task.team && <div><p className="text-xs font-bold uppercase text-slate-500">Equipe</p><p className="mt-1">{task.team.name}</p></div>}</div><p className="text-xs text-slate-400">Este link externo permite visualizar somente esta tarefa e expira em {format(new Date(query.data!.expiresAt), "dd/MM/yyyy")}.</p><section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><div className="mb-3 flex items-center gap-2"><LogIn size={18} className="shrink-0 text-blue-700" /><div><h3 className="font-bold text-slate-950">Entrar no OrganizaÍ</h3><p className="text-xs text-slate-600">Qualquer pessoa pode entrar ou se cadastrar. No dashboard, esta tarefa aparecerá somente para quem estiver atribuído ou fizer parte da equipe vinculada.</p></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2"><Button type="button" className="min-h-12 w-full bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50" onClick={() => onEnter("google")}><GoogleLogo />Gmail / Google</Button><Button type="button" className="min-h-12 w-full bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50" onClick={() => onEnter("microsoft")}><span className="grid shrink-0 grid-cols-2 gap-0.5"><i className="h-2 w-2 bg-red-500" /><i className="h-2 w-2 bg-green-500" /><i className="h-2 w-2 bg-blue-500" /><i className="h-2 w-2 bg-yellow-500" /></span>Hotmail / Outlook</Button><Button type="button" className="min-h-12 w-full" onClick={() => onEnter("email")}><Mail size={18} />Entrar ou cadastrar</Button></div></section></div>}
      </Card>
    </main>
  );
}

function GoogleLogo() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path fill="#EA4335" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z" />
      <path fill="#4285F4" d="M9 18c2.43 0 4.468-.806 5.956-2.181l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.167.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.038l3.007-2.332Z" />
      <path fill="#34A853" d="M9 3.58c1.322 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.43 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z" />
    </svg>
  );
}
