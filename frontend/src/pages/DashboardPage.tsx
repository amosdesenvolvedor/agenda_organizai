import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock, Eye, LogOut, Mail, Pencil, Search, Settings, Share2, Trash2, UsersRound, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type CalendarItem, type EventItem, getStoredUser } from "../lib/api";
import { Badge, Button, Card, IconButton, Input } from "../components/ui";

type TaskItem = {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  dueAt?: string;
  progress: number;
  priority: string;
  completedAt?: string;
  createdAt?: string;
  owner?: { id: string; name: string; email: string };
  assignee?: { id: string; name: string; email: string };
  summary?: string;
  tags?: string;
  color?: string;
  icon?: string;
  calendarId?: string;
  startsAt?: string;
  endsAt?: string;
  allDay?: boolean;
  noTime?: boolean;
  status?: string;
  privacy?: string;
  progressMode?: string;
  isDraft?: boolean;
  recurrence?: { frequency: string; interval: number; endsAt?: string };
};

type NotificationItem = {
  id: string;
  title: string;
  body?: string;
  readAt?: string;
  favorite: boolean;
  type?: string;
  createdAt?: string;
};

export function DashboardPage({ onLogout }: { onLogout: () => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [query, setQuery] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createTaskOnOpen, setCreateTaskOnOpen] = useState(false);
  const user = getStoredUser();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => api<{ events: EventItem[] }>("/api/events")
  });
  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api<{ calendars: CalendarItem[] }>("/api/calendars")
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api<{ tasks: TaskItem[] }>("/api/tasks")
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ notifications: NotificationItem[] }>("/api/notifications")
  });
  const markNotificationRead = useMutation({
    mutationFn: (notificationId: string) => api(`/api/notifications/${notificationId}/read`, { method: "PATCH" }),
    onSuccess: () => {
      setSelectedNotification(null);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const events = eventsQuery.data?.events ?? [];
  const tasks = tasksQuery.data?.tasks ?? [];
  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadNotifications = notifications.filter((item) => !item.readAt);
  const calendars = calendarsQuery.data?.calendars ?? [];

  const visibleEvents = useMemo(() => {
    const text = query.trim().toLowerCase();
    return text ? events.filter((event) => event.title.toLowerCase().includes(text) || event.location?.toLowerCase().includes(text)) : events;
  }, [events, query]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = addDays(startOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }), 41);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const todayEvents = events.filter((event) => isSameDay(new Date(event.startsAt), new Date()));
  const monthLabel = format(currentDate, "MMMM yyyy", { locale: ptBR });

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <CalendarPlus size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-950">Agenda OrganizaÍ</h1>
              <p className="truncate text-xs text-slate-500">{user?.name ?? "Usuario"}</p>
            </div>
          </div>
          <div className="hidden w-full max-w-md md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
              <Input className="pl-10" placeholder="Pesquisar eventos, locais e tags" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>
          <IconButton title="Configuracoes">
            <Settings size={18} />
          </IconButton>
          <IconButton title="Sair" onClick={onLogout}>
            <LogOut size={18} />
          </IconButton>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[260px_1fr_320px]">
        <aside className="space-y-4">
          <Button className="w-full" onClick={() => setEventDialogOpen(true)}>
            <CalendarPlus size={18} />
            Novo evento
          </Button>
          <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={() => {
            setSelectedTaskId(null);
            setCreateTaskOnOpen(true);
            setTaskDialogOpen(true);
          }}>
            <CheckCircle2 size={18} />
            Nova tarefa
          </Button>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Agendas</h2>
            <div className="space-y-2">
              {calendars.map((calendar) => (
                <label key={calendar.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="h-3 w-3 rounded-full" style={{ background: calendar.color }} />
                  <span className="truncate">{calendar.name}</span>
                </label>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Filtros</h2>
            <div className="grid gap-2">
              {["Hoje", "Esta semana", "Este mes", "Alta prioridade", "Compartilhados"].map((filter) => (
                <button key={filter} className="rounded-md px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100">
                  {filter}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Eventos hoje" value={todayEvents.length} icon={<Clock size={18} />} />
            <Metric label="Tarefas abertas" value={tasks.filter((task) => !task.completedAt).length} icon={<CheckCircle2 size={18} />} onClick={() => {
              setSelectedTaskId(null);
              setCreateTaskOnOpen(false);
              setTaskDialogOpen(true);
            }} />
            <Metric
              label="Notificações"
              value={unreadNotifications.length}
              icon={<Bell size={18} />}
              onClick={unreadNotifications[0] ? () => {
                markNotificationRead.reset();
                setSelectedNotification(unreadNotifications[0]);
              } : undefined}
            />
            <Metric label="Equipes" value="0" icon={<UsersRound size={18} />} />
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <h2 className="text-xl font-bold capitalize text-slate-950">{monthLabel}</h2>
                <p className="text-sm text-slate-500">Visualizacao mensal com eventos e tarefas relacionadas.</p>
              </div>
              <div className="flex items-center gap-2">
                <IconButton title="Mes anterior" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                  <ChevronLeft size={18} />
                </IconButton>
                <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => setCurrentDate(new Date())}>
                  Hoje
                </Button>
                <IconButton title="Proximo mes" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                  <ChevronRight size={18} />
                </IconButton>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 text-center text-xs font-bold uppercase text-slate-500">
              {["seg", "ter", "qua", "qui", "sex", "sab", "dom"].map((day) => (
                <div key={day} className="py-3">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayEvents = visibleEvents.filter((event) => isSameDay(new Date(event.startsAt), day)).slice(0, 3);
                const muted = day.getMonth() !== currentDate.getMonth();
                return (
                  <div key={day.toISOString()} className={`min-h-28 border-b border-r border-slate-100 p-2 ${muted ? "bg-slate-50 text-slate-400" : "bg-white"}`}>
                    <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isSameDay(day, new Date()) ? "bg-blue-600 text-white" : ""}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map((event) => (
                        <button type="button" onClick={() => setSelectedEvent(event)} title={`Visualizar ${event.title}`} key={event.id} className="block w-full truncate rounded px-2 py-1 text-left text-xs font-semibold text-white transition hover:brightness-90" style={{ background: event.color || "#2563eb" }}>
                          {format(new Date(event.startsAt), "HH:mm")} {event.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Proximas reunioes</h2>
            <div className="space-y-3">
              {visibleEvents.slice(0, 5).map((event) => (
                <button type="button" onClick={() => setSelectedEvent(event)} key={event.id} className="block w-full rounded-md border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <Badge>{event.priority}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{format(new Date(event.startsAt), "dd/MM HH:mm")}</p>
                </button>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Tarefas</h2>
            <div className="space-y-3">
              {tasks.slice(0, 5).map((task) => (
                <button type="button" key={task.id} className="block w-full rounded-md p-2 text-left transition hover:bg-slate-50" onClick={() => {
                  setSelectedTaskId(task.id);
                  setCreateTaskOnOpen(false);
                  setTaskDialogOpen(true);
                }}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">{task.title}</span>
                    <span className="text-xs text-slate-500">{task.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${task.progress}%` }} />
                  </div>
                </button>
              ))}
              {tasks.length === 0 && <p className="text-sm text-slate-500">Nenhuma tarefa disponível.</p>}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Notificacoes</h2>
            <div className="space-y-3">
              {unreadNotifications.slice(0, 4).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    markNotificationRead.reset();
                    setSelectedNotification(item);
                  }}
                  className="relative block w-full rounded-md border border-blue-100 bg-blue-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-100/70"
                  aria-label={`${item.title}, visualizar notificação`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-700">Nova</span>
                      </div>
                      {item.body && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{item.body}</p>}
                    </div>
                  </div>
                </button>
              ))}
              {unreadNotifications.length === 0 && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">Nenhuma notificação nova.</p>}
            </div>
          </Card>
        </aside>
      </div>
      {eventDialogOpen && calendars[0] && (
        <NewEventDialog
          defaultCalendarId={calendars[0].id}
          onClose={() => setEventDialogOpen(false)}
          onCreated={() => {
            setEventDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ["events"] });
          }}
        />
      )}
      {selectedEvent && (
        <EventDetailsDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onChanged={() => {
            setSelectedEvent(null);
            queryClient.invalidateQueries({ queryKey: ["events"] });
          }}
        />
      )}
      {selectedNotification && (
        <NotificationDialog
          notification={selectedNotification}
          isMarkingRead={markNotificationRead.isPending}
          error={markNotificationRead.error}
          onClose={() => {
            markNotificationRead.reset();
            setSelectedNotification(null);
          }}
          onMarkRead={() => markNotificationRead.mutate(selectedNotification.id)}
        />
      )}
      {taskDialogOpen && (
        <TaskDialog
          tasks={tasks}
          calendars={calendars}
          initialTaskId={selectedTaskId}
          initialCreating={createTaskOnOpen}
          onClose={() => {
            setTaskDialogOpen(false);
            setCreateTaskOnOpen(false);
          }}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["tasks"] })}
        />
      )}
    </main>
  );
}

function NotificationDialog({
  notification,
  isMarkingRead,
  error,
  onClose,
  onMarkRead
}: {
  notification: NotificationItem;
  isMarkingRead: boolean;
  error: Error | null;
  onClose: () => void;
  onMarkRead: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg overflow-hidden border-slate-300 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600"><Bell size={20} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">Notificação</p>
              <h2 id="notification-title" className="text-lg font-semibold">{notification.title}</h2>
            </div>
          </div>
          <IconButton title="Fechar" onClick={onClose}><X size={18} /></IconButton>
        </div>
        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {notification.body || "Esta notificação não possui informações adicionais."}
            </p>
            {notification.createdAt && (
              <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
                Recebida em {format(new Date(notification.createdAt), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            )}
          </div>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error.message || "Não foi possível marcar a notificação como lida."}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={onClose}>Fechar</Button>
            <Button type="button" disabled={isMarkingRead} onClick={onMarkRead}>
              <CheckCircle2 size={17} />
              {isMarkingRead ? "Atualizando..." : "Marcar como lida"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function TaskDialog({ tasks, calendars, initialTaskId, initialCreating, onClose, onChanged }: { tasks: TaskItem[]; calendars: CalendarItem[]; initialTaskId: string | null; initialCreating: boolean; onClose: () => void; onChanged: () => void }) {
  const [selectedId, setSelectedId] = useState(initialTaskId ?? tasks[0]?.id ?? null);
  const [creating, setCreating] = useState(initialCreating);
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <Card className="my-auto w-full max-w-5xl overflow-hidden border-slate-300 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="tasks-title">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600"><CheckCircle2 size={20} /></span>
            <div><h2 id="tasks-title" className="text-lg font-semibold">Todas as tarefas</h2><p className="text-xs text-slate-300">Consulte responsabilidades, prazos e progresso.</p></div>
          </div>
          <div className="flex items-center gap-2"><Button type="button" onClick={() => setCreating(true)}><CheckCircle2 size={17} />Nova tarefa</Button><IconButton title="Fechar" onClick={onClose}><X size={18} /></IconButton></div>
        </div>
        <div className="grid min-h-[420px] md:grid-cols-[300px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 md:border-b-0 md:border-r">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{tasks.length} tarefa(s)</p>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {tasks.map((task) => (
                <button type="button" key={task.id} onClick={() => setSelectedId(task.id)} className={`block w-full rounded-lg border p-3 text-left transition ${selectedId === task.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{task.priority}</span><span>{task.progress}%</span></div>
                </button>
              ))}
              {tasks.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Nenhuma tarefa disponível.</p>}
            </div>
          </aside>
          <section className="p-6">
            {creating
              ? <TaskCreateForm calendars={calendars} onCancel={() => setCreating(false)} onCreated={(taskId, createAnother) => { onChanged(); setSelectedId(taskId); setCreating(createAnother); }} />
              : selectedTask
                ? <TaskDetails key={selectedTask.id} task={selectedTask} onChanged={onChanged} />
                : <div className="grid h-full place-items-center text-sm text-slate-500">Selecione uma tarefa ou cadastre uma nova.</div>}
          </section>
        </div>
      </Card>
    </div>
  );
}

const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(180),
  summary: z.string().max(300),
  description: z.string().max(5000),
  tags: z.string(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().min(1).max(50),
  calendarId: z.string(),
  categoryId: z.string(),
  startDate: z.string(),
  startTime: z.string(),
  dueDate: z.string(),
  endTime: z.string(),
  allDay: z.boolean(),
  noTime: z.boolean(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "WAITING", "PAUSED", "COMPLETED", "CANCELED"]),
  privacy: z.enum(["PUBLIC", "PRIVATE", "PARTICIPANTS", "ADMINS"]),
  progressMode: z.enum(["MANUAL", "AUTOMATIC"]),
  progress: z.number().min(0).max(100),
  recurrenceMode: z.enum(["NONE", "DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]),
  recurrenceInterval: z.number().int().min(1).max(365),
  recurrenceEndsAt: z.string()
});

type TaskCreateValues = z.infer<typeof taskCreateSchema>;

function TaskCreateForm({ calendars, onCancel, onCreated }: { calendars: CalendarItem[]; onCancel: () => void; onCreated: (taskId: string, createAnother: boolean) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, reset, formState } = useForm<TaskCreateValues>({
    resolver: zodResolver(taskCreateSchema),
    defaultValues: {
      title: "", summary: "", description: "", tags: "", color: "#2563eb", icon: "check-circle",
      calendarId: calendars[0]?.id ?? "", categoryId: "", startDate: format(new Date(), "yyyy-MM-dd"), startTime: "09:00",
      dueDate: format(new Date(), "yyyy-MM-dd"), endTime: "10:00", allDay: false, noTime: false,
      priority: "NORMAL", status: "NOT_STARTED", privacy: "PRIVATE", progressMode: "MANUAL", progress: 0,
      recurrenceMode: "NONE", recurrenceInterval: 1, recurrenceEndsAt: ""
    }
  });
  const selectedCalendar = calendars.find((calendar) => calendar.id === watch("calendarId"));
  const noTime = watch("noTime");
  const allDay = watch("allDay");
  const recurrenceMode = watch("recurrenceMode");

  async function submit(values: TaskCreateValues, options: { draft: boolean; another: boolean }) {
    setServerError(null);
    try {
      const startsAt = values.startDate
        ? new Date(`${values.startDate}T${values.noTime || values.allDay ? "00:00" : values.startTime}:00`)
        : null;
      const endsAt = values.dueDate
        ? new Date(`${values.dueDate}T${values.noTime || values.allDay ? "23:59" : values.endTime}:00`)
        : null;
      if (startsAt && endsAt && endsAt <= startsAt) throw new Error("A conclusão prevista deve ser posterior ao início.");
      const response = await api<{ task: TaskItem }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: values.title, summary: values.summary || null, description: values.description || null,
          tags: values.tags.split(",").map((tag) => tag.trim()).filter(Boolean), color: values.color, icon: values.icon,
          calendarId: values.calendarId || null, categoryId: values.categoryId || undefined,
          startsAt: startsAt?.toISOString() ?? null, dueAt: endsAt?.toISOString() ?? null, endsAt: endsAt?.toISOString() ?? null,
          allDay: values.allDay, noTime: values.noTime, priority: values.priority, status: values.status,
          privacy: values.privacy, progressMode: values.progressMode, progress: values.progress, isDraft: options.draft,
          recurrence: values.recurrenceMode === "NONE" ? null : {
            frequency: values.recurrenceMode === "BIWEEKLY" ? "WEEKLY" : values.recurrenceMode,
            interval: values.recurrenceMode === "BIWEEKLY" ? 2 : values.recurrenceInterval,
            endsAt: values.recurrenceEndsAt ? new Date(`${values.recurrenceEndsAt}T23:59:59`).toISOString() : null
          }
        })
      });
      if (options.another) reset();
      onCreated(response.task.id, options.another);
    } catch (reason) {
      setServerError(reason instanceof Error ? reason.message : "Não foi possível cadastrar a tarefa.");
    }
  }

  const firstError = Object.values(formState.errors)[0]?.message;

  return (
    <form className="space-y-5" onSubmit={handleSubmit((values) => submit(values, { draft: false, another: false }))}>
      <div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Cadastro de tarefa</p><h3 className="mt-1 text-xl font-bold text-slate-950">Informações principais</h3><p className="mt-1 text-xs text-slate-500">A data de criação e o usuário criador são registrados automaticamente.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2"><span>Título *</span><Input autoFocus {...register("title")} placeholder="Informe o título da tarefa" /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2"><span>Resumo</span><Input {...register("summary")} placeholder="Resumo objetivo" /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2"><span>Descrição detalhada</span><textarea className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-sm" {...register("description")} placeholder="Contexto, instruções e resultado esperado" /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Etiquetas</span><Input {...register("tags")} placeholder="financeiro, mensal, revisão" /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Ícone</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("icon")}><option value="check-circle">Tarefa</option><option value="briefcase">Trabalho</option><option value="flag">Marco</option><option value="star">Destaque</option></select></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Cor</span><input type="color" className="h-10 w-full rounded-md border border-slate-300 bg-white p-1" {...register("color")} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Agenda</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("calendarId")}>{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</select></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Categoria</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("categoryId")}><option value="">Sem categoria</option>{selectedCalendar?.categories?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Prioridade</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("priority")}><option value="LOW">Baixa</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option><option value="CRITICAL">Crítica</option></select></label>
        <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Status</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("status")}><option value="NOT_STARTED">Não iniciada</option><option value="IN_PROGRESS">Em andamento</option><option value="WAITING">Aguardando terceiros</option><option value="PAUSED">Pausada</option><option value="COMPLETED">Concluída</option><option value="CANCELED">Cancelada</option></select></label>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="mb-3 text-sm font-bold text-slate-900">Datas e horários</p><div className="mb-4 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("allDay")} />Dia inteiro</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("noTime")} />Sem horário definido</label></div><div className="grid gap-3 sm:grid-cols-4"><label className="space-y-2 text-xs font-semibold"><span>Data inicial</span><Input type="date" {...register("startDate")} /></label><label className="space-y-2 text-xs font-semibold"><span>Hora inicial</span><Input type="time" disabled={noTime || allDay} {...register("startTime")} /></label><label className="space-y-2 text-xs font-semibold"><span>Conclusão prevista</span><Input type="date" {...register("dueDate")} /></label><label className="space-y-2 text-xs font-semibold"><span>Hora final</span><Input type="time" disabled={noTime || allDay} {...register("endTime")} /></label></div></div>
      <div className="grid gap-4 sm:grid-cols-3"><label className="space-y-2 text-sm font-semibold"><span>Privacidade</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("privacy")}><option value="PRIVATE">Privada</option><option value="PUBLIC">Pública</option><option value="PARTICIPANTS">Apenas participantes</option><option value="ADMINS">Apenas administradores</option></select></label><label className="space-y-2 text-sm font-semibold"><span>Cálculo do progresso</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("progressMode")}><option value="MANUAL">Manual</option><option value="AUTOMATIC">Automático</option></select></label><label className="space-y-2 text-sm font-semibold"><span>Progresso</span><Input type="number" min="0" max="100" {...register("progress", { valueAsNumber: true })} /></label></div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="mb-3 text-sm font-bold text-slate-900">Recorrência</p><div className="grid gap-3 sm:grid-cols-3"><label className="space-y-2 text-sm font-semibold"><span>Repetir</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3" {...register("recurrenceMode")}><option value="NONE">Não repetir</option><option value="DAILY">Todos os dias</option><option value="WEEKLY">Semanalmente</option><option value="BIWEEKLY">Quinzenalmente</option><option value="MONTHLY">Mensalmente</option><option value="YEARLY">Anualmente</option><option value="CUSTOM">Personalizada</option></select></label>{recurrenceMode !== "NONE" && <><label className="space-y-2 text-sm font-semibold"><span>Intervalo</span><Input type="number" min="1" max="365" disabled={recurrenceMode === "BIWEEKLY"} {...register("recurrenceInterval", { valueAsNumber: true })} /></label><label className="space-y-2 text-sm font-semibold"><span>Repetir até</span><Input type="date" {...register("recurrenceEndsAt")} /></label></>}</div>{recurrenceMode === "DAILY" && <p className="mt-3 text-xs text-blue-700">A tarefa será repetida todos os dias.</p>}</div>
      {(firstError || serverError) && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{firstError || serverError}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={onCancel}>Cancelar</Button><Button type="button" className="bg-slate-700 hover:bg-slate-800" disabled={formState.isSubmitting} onClick={handleSubmit((values) => submit(values, { draft: true, another: false }))}>Salvar como rascunho</Button><Button type="button" className="bg-blue-700 hover:bg-blue-800" disabled={formState.isSubmitting} onClick={handleSubmit((values) => submit(values, { draft: false, another: true }))}>Salvar e criar outra</Button><Button disabled={formState.isSubmitting}>{formState.isSubmitting ? "Salvando..." : "Salvar"}</Button></div>
    </form>
  );
}

function TaskDetails({ task, onChanged }: { task: TaskItem; onChanged: () => void }) {
  const user = getStoredUser();
  const canManage = task.ownerId === user?.id || user?.role === "ADMIN";
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueAt, setDueAt] = useState(task.dueAt ? format(new Date(task.dueAt), "yyyy-MM-dd") : "");
  const [priority, setPriority] = useState(task.priority);
  const [progress, setProgress] = useState(task.progress);
  const [shareEmail, setShareEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateTask = useMutation({
    mutationFn: () => api(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        dueAt: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : null,
        priority,
        progress,
        completed: progress === 100
      })
    }),
    onSuccess: () => { setEditing(false); setError(null); setMessage("Tarefa atualizada com sucesso."); onChanged(); },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a tarefa.")
  });

  const shareTask = useMutation({
    mutationFn: () => api(`/api/tasks/${task.id}/share`, { method: "POST", body: JSON.stringify({ email: shareEmail.trim() }) }),
    onSuccess: () => { setShareEmail(""); setError(null); setMessage("Tarefa compartilhada e atribuída com sucesso."); onChanged(); },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Não foi possível compartilhar a tarefa.")
  });

  return (
    <div className="space-y-5">
      {editing ? (
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-semibold text-slate-700"><span>Título</span><Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} /></label>
          <label className="block space-y-2 text-sm font-semibold text-slate-700"><span>Descrição</span><textarea className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Prazo</span><Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Prioridade</span><select className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="LOW">Baixa</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
            <label className="space-y-2 text-sm font-semibold text-slate-700"><span>Progresso: {progress}%</span><input className="h-10 w-full accent-blue-600" type="range" min="0" max="100" step="5" value={progress} onChange={(event) => setProgress(Number(event.target.value))} /></label>
          </div>
          <div className="flex justify-end gap-2"><Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => setEditing(false)}>Cancelar</Button><Button type="button" disabled={!title.trim() || updateTask.isPending} onClick={() => updateTask.mutate()}>{updateTask.isPending ? "Salvando..." : "Salvar alterações"}</Button></div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{task.priority}</p><h3 className="mt-1 text-xl font-bold text-slate-950">{task.title}</h3></div><Badge>{task.completedAt ? "Concluída" : `${task.progress}%`}</Badge></div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{task.description || "Sem descrição."}</p>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs font-bold uppercase text-slate-500">Criador</p><p className="mt-1 text-slate-800">{task.owner?.name ?? "Não informado"}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Responsável</p><p className="mt-1 text-slate-800">{task.assignee?.name ?? "Não atribuído"}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Prazo</p><p className="mt-1 text-slate-800">{task.dueAt ? format(new Date(task.dueAt), "dd/MM/yyyy") : "Sem prazo"}</p></div></div>
          {task.recurrence && <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Recorrência: {task.recurrence.frequency === "DAILY" ? "todos os dias" : task.recurrence.frequency === "WEEKLY" && task.recurrence.interval === 2 ? "quinzenalmente" : task.recurrence.frequency.toLowerCase()}{task.recurrence.endsAt ? ` até ${format(new Date(task.recurrence.endsAt), "dd/MM/yyyy")}` : ""}.</p>}
        </div>
      )}
      {canManage && !editing && <><div className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><Share2 size={17} className="text-blue-600" />Compartilhar e atribuir</div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative flex-1"><Mail className="absolute left-3 top-2.5 text-slate-400" size={18} /><Input className="pl-10" type="email" placeholder="usuario@exemplo.com" value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} /></div><Button type="button" disabled={!shareEmail.trim() || shareTask.isPending} onClick={() => shareTask.mutate()}>{shareTask.isPending ? "Compartilhando..." : "Compartilhar"}</Button></div></div><div className="flex justify-end"><Button type="button" className="bg-slate-900 hover:bg-slate-800" onClick={() => setEditing(true)}><Pencil size={17} />Editar tarefa</Button></div></>}
      {!canManage && <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Você pode visualizar esta tarefa. Somente o criador ou um administrador pode editar e compartilhar.</p>}
      {message && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
    </div>
  );
}

function EventDetailsDialog({ event, onClose, onChanged }: { event: EventItem; onClose: () => void; onChanged: () => void }) {
  const user = getStoredUser();
  const canManage = event.createdById === user?.id;
  const initialStart = new Date(event.startsAt);
  const initialEnd = new Date(event.endsAt);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(initialStart);
  const [start, setStart] = useState(format(initialStart, "HH:mm"));
  const [end, setEnd] = useState(format(initialEnd, "HH:mm"));
  const [shareEmail, setShareEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: () => {
      const day = format(date, "yyyy-MM-dd");
      const startsAt = new Date(`${day}T${start}:00`);
      const endsAt = new Date(`${day}T${end}:00`);
      if (endsAt <= startsAt) throw new Error("O horário final deve ser maior que o inicial.");
      return api(`/api/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: title.trim(), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() })
      });
    },
    onSuccess: onChanged,
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Não foi possível editar o evento.")
  });

  const shareMutation = useMutation({
    mutationFn: () => api(`/api/events/${event.id}/share`, {
      method: "POST",
      body: JSON.stringify({ email: shareEmail.trim() })
    }),
    onSuccess: () => {
      setShareEmail("");
      setError(null);
      setMessage("Compromisso compartilhado com sucesso.");
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Não foi possível compartilhar.")
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/api/events/${event.id}`, { method: "DELETE" }),
    onSuccess: onChanged,
    onError: (reason) => setError(reason instanceof Error ? reason.message : "Não foi possível excluir o evento.")
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <Card className="my-auto w-full max-w-2xl overflow-hidden border-slate-300 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="event-details-title">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600"><Eye size={20} /></span>
            <div>
              <h2 id="event-details-title" className="text-lg font-semibold">Detalhes do compromisso</h2>
              <p className="text-xs text-slate-300">Visualize e gerencie as informações da agenda.</p>
            </div>
          </div>
          <IconButton title="Fechar" onClick={onClose}><X size={18} /></IconButton>
        </div>

        <div className="space-y-5 p-6">
          {editing ? (
            <div className="space-y-4">
              <label className="block space-y-2 text-sm font-semibold text-slate-700">
                <span>Título</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={180} />
              </label>
              <EventDatePicker value={date} onChange={setDate} />
              <div className="grid grid-cols-2 gap-3">
                <TimeSelect label="Início" value={start} onChange={setStart} />
                <TimeSelect label="Término" value={end} onChange={setEnd} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={() => setEditing(false)}>Cancelar</Button>
                <Button type="button" disabled={!title.trim() || updateMutation.isPending} onClick={() => updateMutation.mutate()}>{updateMutation.isPending ? "Salvando..." : "Salvar alterações"}</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xl font-bold text-slate-950">{event.title}</h3>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold uppercase text-slate-500">Data</p><p className="mt-1 capitalize text-slate-900">{format(initialStart, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p></div>
                <div className="rounded-lg bg-white p-3"><p className="text-xs font-bold uppercase text-slate-500">Horário</p><p className="mt-1 font-semibold tabular-nums text-slate-900">{format(initialStart, "HH:mm")} às {format(initialEnd, "HH:mm")}</p></div>
              </div>
              {!canManage && <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">Evento compartilhado. Somente o criador pode editar ou excluir.</p>}
            </div>
          )}

          {canManage && !editing && (
            <>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900"><Share2 size={17} className="text-blue-600" />Compartilhar compromisso</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1"><Mail className="absolute left-3 top-2.5 text-slate-400" size={18} /><Input className="pl-10" type="email" placeholder="email@exemplo.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} /></div>
                  <Button type="button" disabled={!shareEmail.trim() || shareMutation.isPending} onClick={() => shareMutation.mutate()}>{shareMutation.isPending ? "Enviando..." : "Compartilhar"}</Button>
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
                <Button type="button" className="bg-red-600 hover:bg-red-700" disabled={deleteMutation.isPending} onClick={() => {
                  if (window.confirm(`Excluir definitivamente o compromisso “${event.title}”?`)) deleteMutation.mutate();
                }}><Trash2 size={17} />{deleteMutation.isPending ? "Excluindo..." : "Excluir"}</Button>
                <Button type="button" className="bg-slate-900 hover:bg-slate-800" onClick={() => setEditing(true)}><Pencil size={17} />Editar</Button>
              </div>
            </>
          )}

          {message && <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, icon, onClick }: { label: string; value: number | string; icon: React.ReactNode; onClick?: () => void }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-500">{label}</p>
        <span className="text-blue-600">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-soft transition hover:border-blue-300 hover:shadow-md" aria-label={`Abrir ${label.toLowerCase()}`}>
        {content}
      </button>
    );
  }

  return (
    <Card className="p-4">
      {content}
    </Card>
  );
}

function NewEventDialog({
  defaultCalendarId,
  onClose,
  onCreated
}: {
  defaultCalendarId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const dateValue = format(date, "yyyy-MM-dd");
      const startsAt = new Date(`${dateValue}T${start}:00`);
      const endsAt = new Date(`${dateValue}T${end}:00`);
      if (endsAt <= startsAt) throw new Error("O horario final deve ser maior que o inicial.");

      return api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          calendarId: defaultCalendarId,
          title,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          priority: "NORMAL",
          status: "SCHEDULED",
          visibility: "PRIVATE",
          tags: []
        })
      });
    },
    onSuccess: onCreated,
    onError: (err) => setError(err instanceof Error ? err.message : "Nao foi possivel criar o evento.")
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
      <Card className="my-auto w-full max-w-4xl overflow-hidden border-slate-300 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="new-event-title">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600">
              <CalendarPlus size={21} aria-hidden />
            </span>
            <div>
              <h2 id="new-event-title" className="text-lg font-semibold">Cadastrar evento</h2>
              <p className="mt-0.5 text-xs text-slate-300">Defina a data e o horário da sua agenda.</p>
            </div>
          </div>
          <IconButton title="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            mutation.mutate();
          }}
        >
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-slate-200 p-6 lg:border-b-0 lg:border-r">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Data do evento</p>
              <EventDatePicker value={date} onChange={setDate} />
            </div>

            <div className="space-y-5 bg-slate-50 p-6">
              <label className="block space-y-2 text-sm font-semibold text-slate-800">
                <span>Título do evento</span>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ex.: Reunião de planejamento"
                  autoFocus
                  required
                  maxLength={180}
                />
              </label>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock size={17} className="text-blue-600" aria-hidden />
                  Horário (formato 24 horas)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TimeSelect label="Início" value={start} onChange={(value) => {
                    setStart(value);
                    if (value >= end) setEnd(nextHour(value));
                  }} />
                  <TimeSelect label="Término" value={end} onChange={setEnd} />
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Resumo</p>
                <p className="mt-2 font-semibold capitalize text-slate-950">
                  {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                <p className="mt-1 text-sm text-slate-600">Das {start} às {end}</p>
              </div>

              {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <Button type="button" className="bg-slate-200 text-slate-900 hover:bg-slate-300" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={mutation.isPending}>{mutation.isPending ? "Salvando..." : "Cadastrar evento"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

function nextHour(time: string) {
  const index = TIME_OPTIONS.indexOf(time);
  return TIME_OPTIONS[Math.min(index + 4, TIME_OPTIONS.length - 1)];
}

function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <select
        className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold tabular-nums text-slate-950 shadow-sm transition focus:border-blue-500 focus:outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {TIME_OPTIONS.map((time) => <option key={time} value={time}>{time}</option>)}
      </select>
    </label>
  );
}

function EventDatePicker({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(value));
  const firstDay = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: firstDay, end: addDays(firstDay, 41) });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <IconButton type="button" title="Mês anterior" onClick={() => setVisibleMonth((month) => subMonths(month, 1))}>
          <ChevronLeft size={18} />
        </IconButton>
        <div className="text-center">
          <p className="font-bold capitalize text-slate-950">{format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}</p>
          <button type="button" className="mt-0.5 text-xs font-semibold text-blue-600 hover:text-blue-800" onClick={() => {
            const today = new Date();
            setVisibleMonth(startOfMonth(today));
            onChange(today);
          }}>Ir para hoje</button>
        </div>
        <IconButton type="button" title="Próximo mês" onClick={() => setVisibleMonth((month) => addMonths(month, 1))}>
          <ChevronRight size={18} />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((weekday) => <span key={weekday} className="py-2">{weekday}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const selected = isSameDay(day, value);
          const today = isSameDay(day, new Date());
          return (
            <button
              type="button"
              key={day.toISOString()}
              aria-label={format(day, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              aria-pressed={selected}
              onClick={() => onChange(day)}
              className={`relative grid aspect-square min-h-9 place-items-center rounded-md text-sm font-semibold transition ${
                selected
                  ? "bg-blue-700 text-white shadow-sm hover:bg-blue-800"
                  : isSameMonth(day, visibleMonth)
                    ? "text-slate-800 hover:bg-slate-100"
                    : "text-slate-300 hover:bg-slate-50"
              }`}
            >
              {format(day, "d")}
              {today && !selected && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600" />}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <CalendarDays size={16} className="text-blue-600" aria-hidden />
        <span className="capitalize">Selecionado: {format(value, "dd/MM/yyyy")}</span>
      </div>
    </div>
  );
}
