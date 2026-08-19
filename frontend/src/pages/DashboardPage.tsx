import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarPlus,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  Globe2,
  Heart,
  LogOut,
  Mail,
  MessageCircle,
  Newspaper,
  Pencil,
  Phone,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  api,
  apiBlob,
  apiForm,
  type CalendarItem,
  type EventItem,
  getStoredUser,
  updateStoredUser,
} from "../lib/api";
import { Badge, Button, Card, IconButton, Input } from "../components/ui";
import {
  FeedDialogEnhanced,
  OrganizationInviteDialog,
  SocialProfileDialog,
} from "./SocialFeatures";

type TaskItem = {
  id: string;
  ownerId: string;
  assigneeId?: string;
  title: string;
  description?: string;
  dueAt?: string;
  progress: number;
  priority: string;
  completedAt?: string;
  startedAt?: string;
  executionReport?: string;
  createdAt?: string;
  owner?: { id: string; name: string; email: string };
  assignee?: { id: string; name: string; email: string };
  teamId?: string;
  team?: { id: string; name: string };
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
  subtasks?: Array<{
    id: string;
    title: string;
    completedAt?: string;
    sortOrder: number;
  }>;
  observers?: Array<{
    id: string;
    userId: string;
    user: { id: string; name: string; email: string };
  }>;
  personas?: Array<{
    id: string;
    name: string;
    role: string;
    createdAt: string;
  }>;
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

type TaskMessageItem = {
  id: string;
  body?: string;
  imageUrl?: string;
  imageName?: string;
  createdAt: string;
  author: { id: string; name: string };
};

type TeamItem = {
  id: string;
  name: string;
  description?: string;
  members: Array<{
    id: string;
    userId: string;
    role: string;
    user: { id: string; name: string; email: string };
  }>;
};

type NetworkUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  company?: string;
  position?: string;
};

const DASHBOARD_FILTERS = [
  "Atrasados",
  "Hoje",
  "Esta semana",
  "Este mês",
  "Alta prioridade",
  "Compartilhados",
] as const;

export function DashboardPage({ onLogout }: { onLogout: () => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [query, setQuery] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationItem | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createTaskOnOpen, setCreateTaskOnOpen] = useState(false);
  const [taskShowOpenOnly, setTaskShowOpenOnly] = useState(false);
  const [eventsListDialogOpen, setEventsListDialogOpen] = useState(false);
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [organizationInviteToken, setOrganizationInviteToken] = useState(
    () =>
      new URLSearchParams(window.location.search).get("organizationInvite") ||
      sessionStorage.getItem("agenda_organization_invite"),
  );
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [completedTasksDialogOpen, setCompletedTasksDialogOpen] =
    useState(false);
  const [completedEventsDialogOpen, setCompletedEventsDialogOpen] =
    useState(false);
  const [mobileFilterDialogOpen, setMobileFilterDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [pushStatus, setPushStatus] = useState<
    "idle" | "enabling" | "enabled" | "denied" | "unsupported"
  >("idle");
  const user = getStoredUser();
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => api<{ events: EventItem[] }>("/api/events"),
  });
  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api<{ calendars: CalendarItem[] }>("/api/calendars"),
  });
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api<{ tasks: TaskItem[] }>("/api/tasks"),
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api<{ notifications: NotificationItem[] }>("/api/notifications"),
  });
  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => api<{ teams: TeamItem[] }>("/api/teams"),
  });
  const usersQuery = useQuery({
    queryKey: ["network-users"],
    queryFn: () => api<{ users: NetworkUser[] }>("/api/users"),
  });
  const markNotificationRead = useMutation({
    mutationFn: (notificationId: string) =>
      api(`/api/notifications/${notificationId}/read`, { method: "PATCH" }),
    onSuccess: () => {
      setSelectedNotification(null);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const events = eventsQuery.data?.events ?? [];
  const tasks = tasksQuery.data?.tasks ?? [];
  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadNotifications = notifications.filter((item) => !item.readAt);
  const calendars = calendarsQuery.data?.calendars ?? [];
  const teams = teamsQuery.data?.teams ?? [];
  const networkUsers = usersQuery.data?.users ?? [];
  const openTasks = tasks.filter((task) => !task.completedAt);
  const completedTasks = tasks.filter((task) => Boolean(task.completedAt));
  const openEvents = events.filter((event) => event.status !== "DONE");
  const completedEvents = events.filter((event) => event.status === "DONE");

  const visibleEvents = useMemo(() => {
    const text = query.trim().toLowerCase();
    const searched = text
      ? openEvents.filter(
          (event) =>
            event.title.toLowerCase().includes(text) ||
            event.location?.toLowerCase().includes(text),
        )
      : openEvents;
    const now = new Date();
    if (activeFilter === "Hoje")
      return searched.filter((event) =>
        isSameDay(new Date(event.startsAt), now),
      );
    if (activeFilter === "Esta semana") {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = addDays(start, 7);
      return searched.filter((event) => {
        const date = new Date(event.startsAt);
        return date >= start && date < end;
      });
    }
    if (activeFilter === "Este mês")
      return searched.filter((event) =>
        isSameMonth(new Date(event.startsAt), now),
      );
    if (activeFilter === "Alta prioridade")
      return searched.filter((event) =>
        ["HIGH", "URGENT", "CRITICAL"].includes(event.priority),
      );
    if (activeFilter === "Compartilhados")
      return searched.filter((event) => event.createdById !== user?.id);
    if (activeFilter === "Atrasados")
      return searched.filter(
        (event) =>
          !["DONE", "CANCELED"].includes(event.status) &&
          new Date(event.endsAt) < now,
      );
    return searched;
  }, [activeFilter, openEvents, query, user?.id]);

  const visibleTasks = useMemo(() => {
    const text = query.trim().toLowerCase();
    const searched = text
      ? tasks.filter(
          (task) =>
            task.title.toLowerCase().includes(text) ||
            task.description?.toLowerCase().includes(text),
        )
      : tasks;
    const now = new Date();
    const taskDate = (task: TaskItem) =>
      task.dueAt ?? task.endsAt ?? task.startsAt;
    if (activeFilter === "Hoje")
      return searched.filter((task) => {
        const date = taskDate(task);
        return date ? isSameDay(new Date(date), now) : false;
      });
    if (activeFilter === "Esta semana") {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = addDays(start, 7);
      return searched.filter((task) => {
        const value = taskDate(task);
        if (!value) return false;
        const date = new Date(value);
        return date >= start && date < end;
      });
    }
    if (activeFilter === "Este mês")
      return searched.filter((task) => {
        const date = taskDate(task);
        return date ? isSameMonth(new Date(date), now) : false;
      });
    if (activeFilter === "Alta prioridade")
      return searched.filter((task) =>
        ["HIGH", "URGENT", "CRITICAL"].includes(task.priority),
      );
    if (activeFilter === "Compartilhados")
      return searched.filter((task) => task.ownerId !== user?.id);
    if (activeFilter === "Atrasados")
      return searched.filter((task) => {
        const date = taskDate(task);
        return !task.completedAt && date ? new Date(date) < now : false;
      });
    return searched;
  }, [activeFilter, query, tasks, user?.id]);

  const eventFilterCounts = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);
    const activeEvents = events.filter(
      (event) => !["DONE", "CANCELED"].includes(event.status),
    );
    return {
      Atrasados: activeEvents.filter((event) => new Date(event.endsAt) < now)
        .length,
      Hoje: activeEvents.filter((event) =>
        isSameDay(new Date(event.startsAt), now),
      ).length,
      "Esta semana": activeEvents.filter((event) => {
        const date = new Date(event.startsAt);
        return date >= weekStart && date < weekEnd;
      }).length,
      "Este mês": activeEvents.filter((event) =>
        isSameMonth(new Date(event.startsAt), now),
      ).length,
      "Alta prioridade": activeEvents.filter((event) =>
        ["HIGH", "URGENT", "CRITICAL"].includes(event.priority),
      ).length,
      Compartilhados: activeEvents.filter(
        (event) => event.createdById !== user?.id,
      ).length,
    } satisfies Record<(typeof DASHBOARD_FILTERS)[number], number>;
  }, [events, user?.id]);

  const taskFilterCounts = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 7);
    const activeTasks = tasks.filter(
      (task) => !task.completedAt && task.status !== "CANCELED",
    );
    const taskDate = (task: TaskItem) =>
      task.dueAt ?? task.endsAt ?? task.startsAt;
    return {
      Atrasados: activeTasks.filter((task) => {
        const date = taskDate(task);
        return date ? new Date(date) < now : false;
      }).length,
      Hoje: activeTasks.filter((task) => {
        const date = taskDate(task);
        return date ? isSameDay(new Date(date), now) : false;
      }).length,
      "Esta semana": activeTasks.filter((task) => {
        const value = taskDate(task);
        if (!value) return false;
        const date = new Date(value);
        return date >= weekStart && date < weekEnd;
      }).length,
      "Este mês": activeTasks.filter((task) => {
        const date = taskDate(task);
        return date ? isSameMonth(new Date(date), now) : false;
      }).length,
      "Alta prioridade": activeTasks.filter((task) =>
        ["HIGH", "URGENT", "CRITICAL"].includes(task.priority),
      ).length,
      Compartilhados: activeTasks.filter((task) => task.ownerId !== user?.id)
        .length,
    } satisfies Record<(typeof DASHBOARD_FILTERS)[number], number>;
  }, [tasks, user?.id]);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      return setPushStatus("unsupported");
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription) setPushStatus("enabled");
        else if (Notification.permission === "denied") setPushStatus("denied");
      })
      .catch(() => setPushStatus("unsupported"));
  }, []);

  async function enablePushNotifications() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    )
      return setPushStatus("unsupported");
    setPushStatus("enabling");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setPushStatus("denied");
      const registration = await navigator.serviceWorker.register("/sw.js");
      const { publicKey } = await api<{ publicKey: string }>(
        "/api/notifications/push/public-key",
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await api("/api/notifications/push/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      setPushStatus("enabled");
    } catch {
      setPushStatus(Notification.permission === "denied" ? "denied" : "idle");
    }
  }

  function selectDashboardFilter(filter: (typeof DASHBOARD_FILTERS)[number]) {
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    setActiveFilter(
      mobile ? filter : activeFilter === filter ? "Todos" : filter,
    );
    if (filter === "Hoje") setCurrentDate(new Date());
    if (mobile) setMobileFilterDialogOpen(true);
  }

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = addDays(
      startOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
      41,
    );
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const monthLabel = format(currentDate, "MMMM yyyy", { locale: ptBR });

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-slate-50 pb-20">
      <header className="safe-top sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <CalendarPlus size={22} aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-950">
                Agenda OrganizaÍ
              </h1>
              <p className="truncate text-xs text-slate-500">
                {user?.name ?? "Usuario"}
              </p>
            </div>
          </div>
          <div className="hidden w-full max-w-md md:block">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
                size={18}
              />
              <Input
                className="pl-10"
                placeholder="Pesquisar eventos, locais e tags"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <IconButton
            title="Configurações e perfil"
            onClick={() => setProfileDialogOpen(true)}
          >
            <Settings size={18} />
          </IconButton>
          <IconButton title="Sair" onClick={onLogout}>
            <LogOut size={18} />
          </IconButton>
        </div>
      </header>

      <div className="safe-bottom mx-auto grid max-w-7xl gap-3 px-2 py-3 sm:gap-4 sm:px-4 sm:py-4 lg:grid-cols-[260px_1fr_320px]">
        <aside className="space-y-4">
          <Button className="w-full" onClick={() => setEventDialogOpen(true)}>
            <CalendarPlus size={18} />
            Novo evento
          </Button>
          <Button
            className="w-full bg-slate-900 hover:bg-slate-800"
            onClick={() => {
              setSelectedTaskId(null);
              setCreateTaskOnOpen(true);
              setTaskShowOpenOnly(false);
              setTaskDialogOpen(true);
            }}
          >
            <CheckCircle2 size={18} />
            Nova tarefa
          </Button>
          <Button
            className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300"
            onClick={() => setCompletedTasksDialogOpen(true)}
          >
            <Archive size={18} />
            Tarefas concluídas ({completedTasks.length})
          </Button>
          <Button
            className="w-full bg-slate-200 text-slate-700 hover:bg-slate-300"
            onClick={() => setCompletedEventsDialogOpen(true)}
          >
            <Archive size={18} />
            Eventos concluídos ({completedEvents.length})
          </Button>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Agendas</h2>
            <div className="space-y-2">
              {calendars.map((calendar) => (
                <label
                  key={calendar.id}
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: calendar.color }}
                  />
                  <span className="truncate">{calendar.name}</span>
                </label>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Filtros</h2>
            <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3 text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1 text-blue-700">
                <CalendarDays size={13} />
                Eventos
              </span>
              <span className="flex items-center gap-1 text-emerald-700">
                <CheckCircle2 size={13} />
                Tarefas
              </span>
            </div>
            <div className="grid gap-2">
              {DASHBOARD_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => selectDashboardFilter(filter)}
                  className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition ${activeFilter === filter ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-100"}`}
                >
                  <span>{filter}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span
                      className={`flex min-w-8 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${activeFilter === filter ? "bg-blue-600 text-white" : eventFilterCounts[filter] > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}
                      title={`${eventFilterCounts[filter]} evento(s)`}
                    >
                      <CalendarDays size={11} />
                      {eventFilterCounts[filter]}
                    </span>
                    <span
                      className={`flex min-w-8 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${activeFilter === filter ? "bg-emerald-600 text-white" : taskFilterCounts[filter] > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
                      title={`${taskFilterCounts[filter]} tarefa(s)`}
                    >
                      <CheckCircle2 size={11} />
                      {taskFilterCounts[filter]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5">
            <Metric
              label="Eventos"
              value={openEvents.length}
              icon={<Clock size={18} />}
              onClick={() => setEventsListDialogOpen(true)}
            />
            <Metric
              label="Tarefas abertas"
              value={openTasks.length}
              icon={<CheckCircle2 size={18} />}
              onClick={() => {
                setSelectedTaskId(null);
                setCreateTaskOnOpen(false);
                setTaskShowOpenOnly(true);
                setTaskDialogOpen(true);
              }}
            />
            <Metric
              label="Notificações"
              value={unreadNotifications.length}
              icon={<Bell size={18} />}
              onClick={() => setNotificationsDialogOpen(true)}
            />
            <Metric
              label="Equipes"
              value={teams.length}
              icon={<UsersRound size={18} />}
              onClick={() => setTeamsDialogOpen(true)}
            />
            <Metric
              label="Usuários"
              value={networkUsers.length}
              icon={<UserRound size={18} />}
              onClick={() => setUsersDialogOpen(true)}
            />
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 sm:p-4">
              <div>
                <h2 className="text-xl font-bold capitalize text-slate-950">
                  {monthLabel}
                </h2>
                <p className="text-sm text-slate-500">
                  Visualizacao mensal com eventos e tarefas relacionadas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <IconButton
                  title="Mes anterior"
                  onClick={() =>
                    setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() - 1,
                        1,
                      ),
                    )
                  }
                >
                  <ChevronLeft size={18} />
                </IconButton>
                <Button
                  className="bg-slate-900 hover:bg-slate-800"
                  onClick={() => setCurrentDate(new Date())}
                >
                  Hoje
                </Button>
                <IconButton
                  title="Proximo mes"
                  onClick={() =>
                    setCurrentDate(
                      new Date(
                        currentDate.getFullYear(),
                        currentDate.getMonth() + 1,
                        1,
                      ),
                    )
                  }
                >
                  <ChevronRight size={18} />
                </IconButton>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 text-center text-xs font-bold uppercase text-slate-500">
              {["seg", "ter", "qua", "qui", "sex", "sab", "dom"].map((day) => (
                <div key={day} className="py-3">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayEvents = visibleEvents
                  .filter(
                    (event) =>
                      event.status !== "DONE" &&
                      isSameDay(new Date(event.startsAt), day),
                  )
                  .slice(0, 3);
                const muted = day.getMonth() !== currentDate.getMonth();
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-20 min-w-0 border-b border-r border-slate-100 p-1 sm:min-h-28 sm:p-2 ${muted ? "bg-slate-50 text-slate-400" : "bg-white"}`}
                  >
                    <div
                      className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isSameDay(day, new Date()) ? "bg-blue-600 text-white" : ""}`}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.map((event) => (
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          title={`Visualizar ${event.title}`}
                          key={event.id}
                          className="block w-full min-w-0 truncate rounded px-1 py-1 text-left text-[10px] font-semibold text-white transition hover:brightness-90 sm:px-2 sm:text-xs"
                          style={{ background: event.color || "#2563eb" }}
                        >
                          {format(new Date(event.startsAt), "HH:mm")}{" "}
                          {event.title}
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
            <h2 className="mb-3 text-sm font-bold text-slate-900">
              Proximas reunioes
            </h2>
            <div className="space-y-3">
              {visibleEvents
                .filter((event) => event.status !== "DONE")
                .slice(0, 5)
                .map((event) => (
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    key={event.id}
                    className="block w-full rounded-md border border-slate-100 p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {event.title}
                      </p>
                      <Badge>{event.priority}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {format(new Date(event.startsAt), "dd/MM HH:mm")}
                    </p>
                  </button>
                ))}
            </div>
          </Card>
          <Card className="hidden p-4 lg:block">
            <h2 className="mb-3 text-sm font-bold text-slate-900">Tarefas</h2>
            <div className="space-y-3">
              {visibleTasks.slice(0, 5).map((task) => (
                <button
                  type="button"
                  key={task.id}
                  className="block w-full rounded-md p-2 text-left transition hover:bg-slate-50"
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setCreateTaskOnOpen(false);
                    setTaskShowOpenOnly(false);
                    setTaskDialogOpen(true);
                  }}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">
                      {task.title}
                    </span>
                    <span className="text-xs text-slate-500">
                      {task.progress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </button>
              ))}
              {visibleTasks.length === 0 && (
                <p className="text-sm text-slate-500">
                  Nenhuma tarefa encontrada neste filtro.
                </p>
              )}
            </div>
          </Card>
          <Card className="hidden p-4 lg:block">
            <h2 className="mb-3 text-sm font-bold text-slate-900">
              Notificacoes
            </h2>
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
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                          Nova
                        </span>
                      </div>
                      {item.body && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                          {item.body}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {unreadNotifications.length === 0 && (
                <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
                  Nenhuma notificação nova.
                </p>
              )}
            </div>
          </Card>
        </aside>
      </div>
      {eventDialogOpen && calendars[0] && (
        <NewEventDialog
          defaultCalendarId={calendars[0].id}
          teams={teams}
          users={networkUsers}
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
          teams={teams}
          users={networkUsers}
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
          onMarkRead={() =>
            markNotificationRead.mutate(selectedNotification.id)
          }
        />
      )}
      {eventsListDialogOpen && (
        <EventsListDialog
          events={openEvents}
          onClose={() => setEventsListDialogOpen(false)}
          onSelect={(event) => {
            setEventsListDialogOpen(false);
            setSelectedEvent(event);
          }}
        />
      )}
      {mobileFilterDialogOpen && (
        <MobileFilterResultsDialog
          filter={activeFilter}
          events={visibleEvents.filter(
            (event) => !["DONE", "CANCELED"].includes(event.status),
          )}
          tasks={visibleTasks}
          onClose={() => setMobileFilterDialogOpen(false)}
          onSelectEvent={(event) => {
            setMobileFilterDialogOpen(false);
            setSelectedEvent(event);
          }}
          onSelectTask={(task) => {
            setMobileFilterDialogOpen(false);
            setSelectedTaskId(task.id);
            setCreateTaskOnOpen(false);
            setTaskShowOpenOnly(false);
            setTaskDialogOpen(true);
          }}
        />
      )}
      {completedEventsDialogOpen && (
        <CompletedEventsDialog
          events={completedEvents}
          onClose={() => setCompletedEventsDialogOpen(false)}
          onSelect={(event) => {
            setCompletedEventsDialogOpen(false);
            setSelectedEvent(event);
          }}
        />
      )}
      {completedTasksDialogOpen && (
        <CompletedTasksDialog
          tasks={completedTasks}
          onClose={() => setCompletedTasksDialogOpen(false)}
          onSelect={(task) => {
            setCompletedTasksDialogOpen(false);
            setSelectedTaskId(task.id);
            setCreateTaskOnOpen(false);
            setTaskShowOpenOnly(false);
            setTaskDialogOpen(true);
          }}
        />
      )}
      {notificationsDialogOpen && (
        <NotificationsListDialog
          notifications={notifications}
          pushStatus={pushStatus}
          onEnablePush={enablePushNotifications}
          onClose={() => setNotificationsDialogOpen(false)}
          onSelect={(notification) => {
            setNotificationsDialogOpen(false);
            markNotificationRead.reset();
            setSelectedNotification(notification);
          }}
        />
      )}
      {teamsDialogOpen && (
        <TeamsDialog
          teams={teams}
          onClose={() => setTeamsDialogOpen(false)}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["teams"] })
          }
        />
      )}
      {usersDialogOpen && (
        <UsersDialog
          users={networkUsers}
          onClose={() => setUsersDialogOpen(false)}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["network-users"] })
          }
          onOpenProfile={(userId) => {
            setUsersDialogOpen(false);
            setProfileUserId(userId);
          }}
        />
      )}
      {conversationsOpen && (
        <ConversationsDialog
          users={networkUsers}
          onClose={() => setConversationsOpen(false)}
          onOpenProfile={(userId) => {
            setConversationsOpen(false);
            setProfileUserId(userId);
          }}
        />
      )}
      {feedOpen && (
        <FeedDialogEnhanced
          onClose={() => setFeedOpen(false)}
          onOpenProfile={(userId) => {
            setFeedOpen(false);
            setProfileUserId(userId);
          }}
        />
      )}
      {profileUserId && (
        <SocialProfileDialog
          userId={profileUserId}
          networkUsers={networkUsers}
          onClose={() => setProfileUserId(null)}
        />
      )}
      {organizationInviteToken && (
        <OrganizationInviteDialog
          token={organizationInviteToken}
          onClose={() => {
            sessionStorage.removeItem("agenda_organization_invite");
            setOrganizationInviteToken(null);
            window.history.replaceState({}, "", "/");
          }}
        />
      )}
      {profileDialogOpen && (
        <ProfileSettingsDialog onClose={() => setProfileDialogOpen(false)} />
      )}
      {taskDialogOpen && (
        <TaskDialog
          tasks={taskShowOpenOnly ? openTasks : tasks}
          calendars={calendars}
          teams={teams}
          users={networkUsers}
          initialTaskId={selectedTaskId}
          initialCreating={createTaskOnOpen}
          openOnly={taskShowOpenOnly}
          onClose={() => {
            setTaskDialogOpen(false);
            setCreateTaskOnOpen(false);
          }}
          onChanged={() =>
            queryClient.invalidateQueries({ queryKey: ["tasks"] })
          }
        />
      )}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur"
        aria-label="Menu principal"
      >
        <div className="mx-auto grid max-w-3xl grid-cols-5 px-1 py-1.5">
          <button
            type="button"
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-700"
            onClick={() => {
              setFeedOpen(false);
              setConversationsOpen(true);
            }}
          >
            <MessageCircle size={21} />
            <span>Conversas</span>
          </button>
          <button
            type="button"
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-blue-50 text-[11px] font-semibold text-blue-700"
            onClick={() => {
              setFeedOpen(false);
              setConversationsOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <CalendarDays size={21} />
            <span>Agenda</span>
          </button>
          <button
            type="button"
            className="relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-700"
            onClick={() => setNotificationsDialogOpen(true)}
          >
            <Bell size={21} />
            <span>Notificações</span>
            {unreadNotifications.length > 0 && (
              <span className="absolute right-[calc(50%-20px)] top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] text-white">
                {Math.min(unreadNotifications.length, 99)}
              </span>
            )}
          </button>
          <button
            type="button"
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-700"
            onClick={() => {
              setConversationsOpen(false);
              setFeedOpen(true);
            }}
          >
            <Newspaper size={21} />
            <span>Feed</span>
          </button>
          <button
            type="button"
            className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-700"
            onClick={() => {
              setFeedOpen(false);
              setConversationsOpen(false);
              setProfileUserId(user?.id ?? "me");
            }}
          >
            <UserRound size={21} />
            <span>Perfil</span>
          </button>
        </div>
      </nav>
    </main>
  );
}

function DialogShell({
  title,
  subtitle,
  icon,
  onClose,
  children,
  maxWidth = "max-w-3xl",
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/60 p-0 backdrop-blur-sm sm:overflow-y-auto sm:p-4">
      <Card
        className={`safe-bottom h-[100dvh] w-full ${maxWidth} overflow-y-auto rounded-none border-slate-300 shadow-2xl sm:my-auto sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="safe-top sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-950 px-4 py-3 text-white sm:relative sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600">
              {icon}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold sm:text-lg">
                {title}
              </h2>
              <p className="truncate text-xs text-slate-300">{subtitle}</p>
            </div>
          </div>
          <IconButton title="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </Card>
    </div>
  );
}

type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  phone?: string;
  company?: string;
  position?: string;
  language: string;
  timezone: string;
  theme: "LIGHT" | "DARK" | "SYSTEM";
  createdAt: string;
  settings?: {
    dateFormat: string;
    timeFormat: string;
    firstDayOfWeek: number;
    emailNotifications: boolean;
    popupNotifications: boolean;
    soundNotifications: boolean;
  };
};

function ProfileSettingsDialog({ onClose }: { onClose: () => void }) {
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<{ user: ProfileUser }>("/api/auth/me"),
  });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [timezone, setTimezone] = useState("America/Porto_Velho");
  const [theme, setTheme] = useState<"LIGHT" | "DARK" | "SYSTEM">("SYSTEM");
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(1);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [popupNotifications, setPopupNotifications] = useState(true);
  const [soundNotifications, setSoundNotifications] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const profile = profileQuery.data?.user;
    if (!profile) return;
    setName(profile.name);
    setPhone(profile.phone ?? "");
    setCompany(profile.company ?? "");
    setPosition(profile.position ?? "");
    setTimezone(profile.timezone);
    setTheme(profile.theme);
    setFirstDayOfWeek(profile.settings?.firstDayOfWeek ?? 1);
    setEmailNotifications(profile.settings?.emailNotifications ?? true);
    setPopupNotifications(profile.settings?.popupNotifications ?? true);
    setSoundNotifications(profile.settings?.soundNotifications ?? false);
  }, [profileQuery.data?.user]);

  const saveProfile = useMutation({
    mutationFn: () =>
      api<{ user: ProfileUser }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          company: company.trim() || null,
          position: position.trim() || null,
          language: "pt-BR",
          timezone,
          theme,
          settings: {
            dateFormat: "dd/MM/yyyy",
            timeFormat: "HH:mm",
            firstDayOfWeek,
            emailNotifications,
            popupNotifications,
            soundNotifications,
          },
        }),
      }),
    onSuccess: ({ user }) => {
      updateStoredUser({ name: user.name, avatarUrl: user.avatarUrl });
      setMessage("Perfil atualizado com sucesso.");
      profileQuery.refetch();
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: () => {
      if (!avatarFile) throw new Error("Selecione uma foto.");
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      return apiForm<{ user: ProfileUser }>("/api/auth/me/avatar", formData);
    },
    onSuccess: ({ user }) => {
      updateStoredUser({ avatarUrl: user.avatarUrl });
      setAvatarFile(null);
      setMessage("Foto de perfil atualizada com sucesso.");
      profileQuery.refetch();
    },
  });

  const profile = profileQuery.data?.user;
  const error = profileQuery.error ?? saveProfile.error ?? uploadAvatar.error;
  const initials = (profile?.name ?? getStoredUser()?.name ?? "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <DialogShell
      title="Perfil e configurações"
      subtitle="Identidade profissional e preferências da conta"
      icon={<UserRound size={20} />}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      {profileQuery.isLoading ? (
        <div className="grid min-h-72 place-items-center text-sm font-semibold text-slate-500">
          Carregando perfil...
        </div>
      ) : profile ? (
        <form
          className="max-h-[75vh] overflow-y-auto"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            saveProfile.mutate();
          }}
        >
          <div className="border-b border-slate-200 bg-slate-50 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={`Foto de ${profile.name}`}
                    className="h-20 w-20 rounded-2xl border-4 border-white object-cover shadow"
                  />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-2xl bg-blue-700 text-2xl font-bold text-white shadow">
                    {initials}
                  </div>
                )}
                <label
                  title="Selecionar foto"
                  className="absolute -bottom-2 -right-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full border-2 border-white bg-blue-700 text-white shadow transition hover:bg-blue-800"
                >
                  <Camera size={16} />
                  <input
                    className="hidden"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setAvatarFile(event.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-slate-950">
                  {profile.name}
                </p>
                <p className="mt-1 truncate text-sm text-slate-600">
                  {profile.email}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge>
                    {profile.role === "ADMIN" ? "Administrador" : "Usuário"}
                  </Badge>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <ShieldCheck size={13} />
                    Conta ativa
                  </span>
                </div>
                {avatarFile && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="max-w-52 truncate text-xs text-slate-600">
                      {avatarFile.name}
                    </span>
                    <Button
                      type="button"
                      disabled={
                        avatarFile.size > 3 * 1024 * 1024 ||
                        uploadAvatar.isPending
                      }
                      onClick={() => uploadAvatar.mutate()}
                    >
                      <Camera size={15} />
                      {uploadAvatar.isPending
                        ? "Enviando..."
                        : "Atualizar foto"}
                    </Button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                      onClick={() => setAvatarFile(null)}
                    >
                      Cancelar
                    </button>
                    {avatarFile.size > 3 * 1024 * 1024 && (
                      <span className="w-full text-xs font-semibold text-red-600">
                        A foto deve ter no máximo 3 MB.
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  JPEG, PNG ou WebP, até 3 MB.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-7 p-6">
            <section>
              <div className="mb-4">
                <h3 className="font-bold text-slate-950">
                  Informações profissionais
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Dados utilizados para identificar você nas equipes, tarefas e
                  eventos.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>Nome completo *</span>
                  <div className="relative">
                    <UserRound
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <Input
                      className="pl-10"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      minLength={2}
                      maxLength={120}
                      required
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>E-mail da conta</span>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <Input
                      className="bg-slate-100 pl-10 text-slate-500"
                      value={profile.email}
                      readOnly
                    />
                  </div>
                  <span className="block text-xs font-normal text-slate-500">
                    Identidade de acesso preenchida automaticamente.
                  </span>
                </label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>Telefone</span>
                  <div className="relative">
                    <Phone
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <Input
                      className="pl-10"
                      type="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="(00) 00000-0000"
                      maxLength={30}
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>Cargo ou função</span>
                  <div className="relative">
                    <Briefcase
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <Input
                      className="pl-10"
                      value={position}
                      onChange={(event) => setPosition(event.target.value)}
                      placeholder="Ex.: Gestor de projetos"
                      maxLength={120}
                    />
                  </div>
                </label>
                <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2">
                  <span>Empresa ou organização</span>
                  <div className="relative">
                    <Building2
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <Input
                      className="pl-10"
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      placeholder="Nome da empresa ou equipe"
                      maxLength={120}
                    />
                  </div>
                </label>
              </div>
            </section>
            <section className="border-t border-slate-200 pt-6">
              <div className="mb-4">
                <h3 className="font-bold text-slate-950">
                  Localização e aparência
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Padrões regionais usados em toda a sua agenda.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>Idioma</span>
                  <div className="relative">
                    <Globe2
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <select
                      className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3"
                      value="pt-BR"
                      disabled
                    >
                      <option value="pt-BR">Português (Brasil)</option>
                    </select>
                  </div>
                </label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>Fuso horário</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  >
                    <option value="America/Porto_Velho">
                      Porto Velho (UTC−4)
                    </option>
                    <option value="America/Manaus">Manaus (UTC−4)</option>
                    <option value="America/Rio_Branco">
                      Rio Branco (UTC−5)
                    </option>
                    <option value="America/Sao_Paulo">
                      Brasília / São Paulo (UTC−3)
                    </option>
                    <option value="America/Fortaleza">Fortaleza (UTC−3)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>Tema</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
                    value={theme}
                    onChange={(event) =>
                      setTheme(
                        event.target.value as "LIGHT" | "DARK" | "SYSTEM",
                      )
                    }
                  >
                    <option value="SYSTEM">Seguir dispositivo</option>
                    <option value="LIGHT">Claro</option>
                    <option value="DARK">Escuro</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm font-semibold text-slate-700">
                  <span>Início da semana</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
                    value={firstDayOfWeek}
                    onChange={(event) =>
                      setFirstDayOfWeek(Number(event.target.value))
                    }
                  >
                    <option value={1}>Segunda-feira</option>
                    <option value={0}>Domingo</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm sm:grid-cols-2">
                <p>
                  <strong>Data:</strong> dd/mm/aaaa
                </p>
                <p>
                  <strong>Horário:</strong> 24 horas
                </p>
              </div>
            </section>
            <section className="border-t border-slate-200 pt-6">
              <div className="mb-4">
                <h3 className="font-bold text-slate-950">Notificações</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Escolha como deseja acompanhar seus compromissos e tarefas.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <PreferenceToggle
                  label="Notificações por e-mail"
                  description="Avisos importantes no e-mail da conta."
                  checked={emailNotifications}
                  onChange={setEmailNotifications}
                />
                <PreferenceToggle
                  label="Alertas no dispositivo"
                  description="Notificações no navegador e celular."
                  checked={popupNotifications}
                  onChange={setPopupNotifications}
                />
                <PreferenceToggle
                  label="Sons de alerta"
                  description="Sinal sonoro junto às notificações."
                  checked={soundNotifications}
                  onChange={setSoundNotifications}
                />
              </div>
            </section>
            {message && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                {message}
              </p>
            )}
            {error && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                role="alert"
              >
                {error instanceof Error
                  ? error.message
                  : "Não foi possível carregar ou salvar o perfil."}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
              <p className="text-xs text-slate-500">
                Conta criada em{" "}
                {format(new Date(profile.createdAt), "dd/MM/yyyy")}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="bg-slate-200 text-slate-900 hover:bg-slate-300"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                <Button
                  disabled={name.trim().length < 2 || saveProfile.isPending}
                >
                  {saveProfile.isPending ? "Salvando..." : "Salvar perfil"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-6">
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar seu perfil.
          </p>
        </div>
      )}
    </DialogShell>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-xl border p-4 transition ${checked ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-bold text-slate-900">
            {label}
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            {description}
          </span>
        </span>
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 accent-blue-600"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
      </span>
    </label>
  );
}

function EventsListDialog({
  events,
  onClose,
  onSelect,
}: {
  events: EventItem[];
  onClose: () => void;
  onSelect: (event: EventItem) => void;
}) {
  const orderedEvents = [...events].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  return (
    <DialogShell
      title="Eventos"
      subtitle="Todos os eventos criados"
      icon={<Clock size={20} />}
      onClose={onClose}
    >
      <div className="max-h-[65vh] space-y-3 overflow-y-auto p-6">
        {orderedEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event)}
            className="flex w-full items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
          >
            <span
              className="h-12 w-1 shrink-0 rounded-full"
              style={{ background: event.color || "#2563eb" }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-950">{event.title}</p>
              <p className="mt-1 text-sm text-slate-500">
                {format(new Date(event.startsAt), "dd/MM/yyyy 'das' HH:mm")} às{" "}
                {format(new Date(event.endsAt), "HH:mm")}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>
            <Badge
              className={
                event.status === "DONE"
                  ? "bg-emerald-100 text-emerald-700"
                  : event.status !== "CANCELED" &&
                      new Date(event.endsAt) < new Date()
                    ? "bg-red-100 text-red-700"
                    : ""
              }
            >
              {event.status === "DONE"
                ? "Concluído"
                : event.status !== "CANCELED" &&
                    new Date(event.endsAt) < new Date()
                  ? "Atrasado"
                  : event.status}
            </Badge>
          </button>
        ))}
        {events.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            Nenhum evento foi criado ainda.
          </p>
        )}
      </div>
    </DialogShell>
  );
}

function MobileFilterResultsDialog({
  filter,
  events,
  tasks,
  onClose,
  onSelectEvent,
  onSelectTask,
}: {
  filter: string;
  events: EventItem[];
  tasks: TaskItem[];
  onClose: () => void;
  onSelectEvent: (event: EventItem) => void;
  onSelectTask: (task: TaskItem) => void;
}) {
  const orderedEvents = [...events].sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
  );
  const orderedTasks = [...tasks].sort(
    (left, right) =>
      new Date(left.dueAt ?? left.endsAt ?? left.startsAt ?? 0).getTime() -
      new Date(right.dueAt ?? right.endsAt ?? right.startsAt ?? 0).getTime(),
  );
  return (
    <div className="lg:hidden">
      <DialogShell
        title={filter}
        subtitle={`${events.length} evento(s) e ${tasks.length} tarefa(s)`}
        icon={<CalendarDays size={20} />}
        onClose={onClose}
        maxWidth="max-w-xl"
      >
        <div className="max-h-[72vh] space-y-6 overflow-y-auto p-4 sm:p-6">
          <section>
            <h3 className="mb-3 flex items-center justify-between font-bold text-slate-950">
              <span>Eventos</span>
              <Badge>{events.length}</Badge>
            </h3>
            <div className="space-y-2">
              {orderedEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onSelectEvent(event)}
                  className="block w-full rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-left"
                >
                  <p className="font-semibold text-slate-950">{event.title}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {format(new Date(event.startsAt), "dd/MM/yyyy 'às' HH:mm")}{" "}
                    – {format(new Date(event.endsAt), "HH:mm")}
                  </p>
                  {event.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                      {event.description}
                    </p>
                  )}
                </button>
              ))}
              {events.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  Nenhum evento neste filtro.
                </p>
              )}
            </div>
          </section>
          <section>
            <h3 className="mb-3 flex items-center justify-between font-bold text-slate-950">
              <span>Tarefas</span>
              <Badge>{tasks.length}</Badge>
            </h3>
            <div className="space-y-2">
              {orderedTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className="block w-full rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-950">{task.title}</p>
                    <Badge>{task.progress}%</Badge>
                  </div>
                  {(task.dueAt ?? task.endsAt ?? task.startsAt) && (
                    <p className="mt-1 text-sm text-slate-600">
                      Prazo:{" "}
                      {format(
                        new Date(task.dueAt ?? task.endsAt ?? task.startsAt!),
                        "dd/MM/yyyy 'às' HH:mm",
                      )}
                    </p>
                  )}
                  {task.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">
                      {task.description}
                    </p>
                  )}
                </button>
              ))}
              {tasks.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  Nenhuma tarefa neste filtro.
                </p>
              )}
            </div>
          </section>
        </div>
      </DialogShell>
    </div>
  );
}

function CompletedEventsDialog({
  events,
  onClose,
  onSelect,
}: {
  events: EventItem[];
  onClose: () => void;
  onSelect: (event: EventItem) => void;
}) {
  const orderedEvents = [...events].sort(
    (left, right) =>
      new Date(right.completedAt ?? right.endsAt).getTime() -
      new Date(left.completedAt ?? left.endsAt).getTime(),
  );
  return (
    <DialogShell
      title="Eventos concluídos"
      subtitle="Histórico para estudos e comparações futuras"
      icon={<Archive size={20} />}
      onClose={onClose}
    >
      <div className="max-h-[65vh] space-y-3 overflow-y-auto p-6">
        {orderedEvents.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => onSelect(event)}
            className="block w-full rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{event.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Realizado em{" "}
                  {format(new Date(event.startsAt), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700">
                Concluído
              </Badge>
            </div>
            {event.feedback && (
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                {event.feedback}
              </p>
            )}
          </button>
        ))}
        {events.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            Nenhum evento foi finalizado ainda.
          </p>
        )}
      </div>
    </DialogShell>
  );
}

function CompletedTasksDialog({
  tasks,
  onClose,
  onSelect,
}: {
  tasks: TaskItem[];
  onClose: () => void;
  onSelect: (task: TaskItem) => void;
}) {
  const orderedTasks = [...tasks].sort(
    (left, right) =>
      new Date(right.completedAt ?? 0).getTime() -
      new Date(left.completedAt ?? 0).getTime(),
  );
  return (
    <DialogShell
      title="Tarefas concluídas"
      subtitle="Histórico das tarefas finalizadas"
      icon={<CheckCircle2 size={20} />}
      onClose={onClose}
    >
      <div className="max-h-[65vh] space-y-3 overflow-y-auto p-6">
        {orderedTasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => onSelect(task)}
            className="block w-full rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">{task.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Finalizada em{" "}
                  {format(new Date(task.completedAt!), "dd/MM/yyyy 'às' HH:mm")}
                </p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700">
                Concluída
              </Badge>
            </div>
            {task.executionReport && (
              <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                {task.executionReport}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Criador: {task.owner?.name ?? "Não informado"}</span>
              {task.assignee?.name && (
                <span>Responsável: {task.assignee.name}</span>
              )}
            </div>
          </button>
        ))}
        {tasks.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            Nenhuma tarefa foi finalizada ainda.
          </p>
        )}
      </div>
    </DialogShell>
  );
}

function NotificationsListDialog({
  notifications,
  pushStatus,
  onEnablePush,
  onClose,
  onSelect,
}: {
  notifications: NotificationItem[];
  pushStatus: "idle" | "enabling" | "enabled" | "denied" | "unsupported";
  onEnablePush: () => void;
  onClose: () => void;
  onSelect: (notification: NotificationItem) => void;
}) {
  return (
    <DialogShell
      title="Notificações"
      subtitle="Todas as notificações da sua conta"
      icon={<Bell size={20} />}
      onClose={onClose}
    >
      <div className="max-h-[65vh] space-y-3 overflow-y-auto p-6">
        <div
          className={`rounded-xl border p-4 ${pushStatus === "enabled" ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50"}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-slate-950">
                Avisos no celular e desktop
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {pushStatus === "enabled"
                  ? "As notificações deste dispositivo estão ativas."
                  : pushStatus === "denied"
                    ? "A permissão foi bloqueada. Libere notificações nas configurações do navegador."
                    : pushStatus === "unsupported"
                      ? "Este navegador não oferece suporte a notificações push."
                      : "Ative uma vez neste dispositivo para receber os lembretes mesmo com o app fechado."}
              </p>
            </div>
            {(pushStatus === "idle" || pushStatus === "enabling") && (
              <Button
                type="button"
                disabled={pushStatus === "enabling"}
                onClick={onEnablePush}
              >
                <Bell size={16} />
                {pushStatus === "enabling"
                  ? "Ativando..."
                  : "Ativar neste dispositivo"}
              </Button>
            )}
          </div>
        </div>
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            onClick={() => onSelect(notification)}
            className={`block w-full rounded-xl border p-4 text-left transition hover:border-blue-300 ${notification.readAt ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-950">
                {notification.title}
              </p>
              {!notification.readAt && (
                <Badge className="bg-blue-100 text-blue-700">Nova</Badge>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
              {notification.body || "Sem informações adicionais."}
            </p>
            {notification.createdAt && (
              <p className="mt-2 text-xs text-slate-400">
                {format(
                  new Date(notification.createdAt),
                  "dd/MM/yyyy 'às' HH:mm",
                )}
              </p>
            )}
          </button>
        ))}
        {notifications.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            Você não possui notificações cadastradas.
          </p>
        )}
      </div>
    </DialogShell>
  );
}

type DirectMessageItem = {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  readAt?: string;
  createdAt: string;
};
type FeedPostItem = {
  id: string;
  body: string;
  visibility: "PUBLIC" | "NETWORK" | "PRIVATE";
  createdAt: string;
  likedByMe: boolean;
  likeCount: number;
  media?: Array<{
    id: string;
    type: "IMAGE" | "VIDEO";
    url: string;
    mimeType: string;
    size: number;
  }>;
  author: { id: string; name: string; avatarUrl?: string; position?: string };
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; name: string; avatarUrl?: string };
  }>;
};

function ConversationsDialog({
  users,
  onClose,
  onOpenProfile,
}: {
  users: NetworkUser[];
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}) {
  const queryClient = useQueryClient();
  const currentUser = getStoredUser();
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: () =>
      api<{
        conversations: Array<{
          user: NetworkUser;
          lastMessage?: DirectMessageItem;
          unread: number;
        }>;
      }>("/api/social/conversations"),
    refetchInterval: 5000,
  });
  const messagesQuery = useQuery({
    queryKey: ["conversation-messages", selectedId],
    queryFn: () =>
      api<{ messages: DirectMessageItem[] }>(
        `/api/social/conversations/${selectedId}/messages`,
      ),
    enabled: Boolean(selectedId),
    refetchInterval: 4000,
  });
  const sendMessage = useMutation({
    mutationFn: () =>
      api(`/api/social/conversations/${selectedId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({
        queryKey: ["conversation-messages", selectedId],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const conversations =
    conversationsQuery.data?.conversations ??
    users.map((user) => ({ user, unread: 0, lastMessage: undefined }));
  const selected = conversations.find(
    (item) => item.user.id === selectedId,
  )?.user;
  return (
    <DialogShell
      title="Conversas"
      subtitle="Mensagens privadas com sua rede"
      icon={<MessageCircle size={20} />}
      onClose={onClose}
      maxWidth="max-w-5xl"
    >
      <div className="grid min-h-[70dvh] md:grid-cols-[290px_1fr]">
        <aside className="border-b border-slate-200 bg-slate-50 p-3 md:border-b-0 md:border-r">
          <p className="mb-2 text-xs font-bold uppercase text-slate-500">
            Contatos
          </p>
          <div className="flex gap-2 overflow-x-auto md:block md:space-y-2">
            {conversations.map((item) => (
              <button
                key={item.user.id}
                type="button"
                onClick={() => setSelectedId(item.user.id)}
                className={`w-48 shrink-0 rounded-xl border p-3 text-left md:w-full ${selectedId === item.user.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                    {item.user.name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {item.user.name}
                    </strong>
                    <span className="block truncate text-xs text-slate-500">
                      {item.lastMessage?.body ?? "Iniciar conversa"}
                    </span>
                  </span>
                  {item.unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] text-white">
                      {item.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="p-4 text-sm text-slate-500">
                Convide usuários para iniciar conversas.
              </p>
            )}
          </div>
        </aside>
        <section className="flex min-h-[55dvh] min-w-0 flex-col p-3 sm:p-5">
          {selected ? (
            <>
              <div className="border-b border-slate-200 pb-3">
                <button
                  type="button"
                  className="font-bold text-slate-950 hover:text-blue-700 hover:underline"
                  onClick={() => onOpenProfile(selected.id)}
                >
                  {selected.name}
                </button>
                <p className="text-xs text-slate-500">Conversa privada</p>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto py-4">
                {messagesQuery.data?.messages.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.senderId === currentUser?.id ? "ml-auto bg-emerald-100 text-slate-900" : "bg-slate-100 text-slate-800"}`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {item.body}
                    </p>
                    <span className="mt-1 block text-right text-[10px] text-slate-500">
                      {format(new Date(item.createdAt), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t border-slate-200 pt-3">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Digite uma mensagem"
                  maxLength={5000}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      draft.trim()
                    ) {
                      event.preventDefault();
                      sendMessage.mutate();
                    }
                  }}
                />
                <Button
                  type="button"
                  className="shrink-0 px-3"
                  disabled={!draft.trim() || sendMessage.isPending}
                  onClick={() => sendMessage.mutate()}
                >
                  <Send size={18} />
                  <span className="hidden sm:inline">Enviar</span>
                </Button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-slate-500">
              Selecione uma conversa.
            </div>
          )}
        </section>
      </div>
    </DialogShell>
  );
}

function _FeedDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [postBody, setPostBody] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const feedQuery = useQuery({
    queryKey: ["feed"],
    queryFn: () => api<{ posts: FeedPostItem[] }>("/api/social/feed"),
  });
  const createPost = useMutation({
    mutationFn: () =>
      api("/api/social/feed", {
        method: "POST",
        body: JSON.stringify({ body: postBody.trim() }),
      }),
    onSuccess: () => {
      setPostBody("");
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  const toggleLike = useMutation({
    mutationFn: (postId: string) =>
      api(`/api/social/feed/${postId}/like`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feed"] }),
  });
  const addComment = useMutation({
    mutationFn: (postId: string) =>
      api(`/api/social/feed/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comments[postId]?.trim() }),
      }),
    onSuccess: (_data, postId) => {
      setComments((current) => ({ ...current, [postId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["feed"] });
    },
  });
  return (
    <DialogShell
      title="Feed de Notícias"
      subtitle="Atualizações públicas da comunidade OrganizaÍ"
      icon={<Newspaper size={20} />}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 bg-slate-50 p-3 sm:p-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <textarea
            className="min-h-24 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm"
            value={postBody}
            onChange={(event) => setPostBody(event.target.value)}
            placeholder="Compartilhe uma atualização com a comunidade..."
            maxLength={10000}
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              disabled={!postBody.trim() || createPost.isPending}
              onClick={() => createPost.mutate()}
            >
              <Send size={17} />
              Publicar
            </Button>
          </div>
        </div>
        {feedQuery.data?.posts.map((post) => (
          <article
            key={post.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                {post.author.name[0]}
              </span>
              <div>
                <strong className="text-sm text-slate-900">
                  {post.author.name}
                </strong>
                <p className="text-xs text-slate-500">
                  {post.author.position || "Usuário OrganizaÍ"} ·{" "}
                  {format(new Date(post.createdAt), "dd/MM 'às' HH:mm")}
                </p>
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
              {post.body}
            </p>
            <div className="mt-4 flex items-center gap-4 border-y border-slate-100 py-2">
              <button
                type="button"
                className={`flex items-center gap-1.5 text-sm font-semibold ${post.likedByMe ? "text-red-600" : "text-slate-600"}`}
                onClick={() => toggleLike.mutate(post.id)}
              >
                <Heart
                  size={18}
                  fill={post.likedByMe ? "currentColor" : "none"}
                />
                {post.likeCount} Curtir
              </button>
              <span className="flex items-center gap-1.5 text-sm text-slate-600">
                <MessageCircle size={18} />
                {post.comments.length} Comentários
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <strong>{comment.author.name}</strong>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={comments[post.id] ?? ""}
                onChange={(event) =>
                  setComments((current) => ({
                    ...current,
                    [post.id]: event.target.value,
                  }))
                }
                placeholder="Escreva um comentário"
                maxLength={3000}
              />
              <Button
                type="button"
                className="shrink-0 px-3"
                disabled={!comments[post.id]?.trim() || addComment.isPending}
                onClick={() => addComment.mutate(post.id)}
              >
                <Send size={17} />
              </Button>
            </div>
          </article>
        ))}
        {feedQuery.data?.posts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Ainda não há publicações. Seja o primeiro a compartilhar uma
            atualização.
          </p>
        )}
      </div>
    </DialogShell>
  );
}

function UsersDialog({
  users,
  onClose,
  onChanged,
  onOpenProfile,
}: {
  users: NetworkUser[];
  onClose: () => void;
  onChanged: () => void;
  onOpenProfile: (userId: string) => void;
}) {
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createInvite = useMutation({
    mutationFn: () =>
      api<{ invite: { url: string; expiresAt: string } }>(
        "/api/users/invites",
        { method: "POST" },
      ),
    onSuccess: async ({ invite }) => {
      setInviteUrl(invite.url);
      setError(null);
      onChanged();
      const data = {
        title: "Convite para o Agenda OrganizaÍ",
        text: "Entre para minha rede no Agenda OrganizaÍ e vamos organizar tarefas, equipes e eventos juntos.",
        url: invite.url,
      };
      try {
        if (navigator.share) {
          await navigator.share(data);
          setMessage("Convite aberto nos aplicativos do dispositivo.");
        } else {
          await navigator.clipboard.writeText(invite.url);
          setMessage("Link do convite copiado.");
        }
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError")
          setMessage("Compartilhamento cancelado. O link continua disponível.");
        else setMessage("O link foi gerado e está disponível para copiar.");
      }
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o convite.",
      ),
  });

  return (
    <DialogShell
      title="Usuários"
      subtitle={`${users.length} pessoa(s) na sua rede`}
      icon={<UsersRound size={20} />}
      onClose={onClose}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 p-4 sm:p-6">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h3 className="font-bold text-slate-950">
            Convide pessoas para sua rede
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            O link abre o cadastro ou login e conecta a pessoa à sua rede. Ele é
            individual, válido por 30 dias e pode ser usado uma vez.
          </p>
          <Button
            type="button"
            className="mt-4 w-full sm:w-auto"
            disabled={createInvite.isPending}
            onClick={() => createInvite.mutate()}
          >
            <Share2 size={17} />
            {createInvite.isPending ? "Criando convite..." : "Convidar usuário"}
          </Button>
          {inviteUrl && (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={inviteUrl} />
              <Button
                type="button"
                onClick={() =>
                  navigator.clipboard
                    .writeText(inviteUrl)
                    .then(() => setMessage("Link copiado."))
                }
              >
                Copiar
              </Button>
            </div>
          )}
        </div>
        <div>
          <h3 className="mb-3 font-bold text-slate-950">Minha rede</h3>
          <div className="space-y-2">
            {users.map((networkUser) => (
              <button
                type="button"
                key={networkUser.id}
                className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                onClick={() => onOpenProfile(networkUser.id)}
              >
                {networkUser.avatarUrl ? (
                  <img
                    src={networkUser.avatarUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-blue-100 font-bold text-blue-700">
                    {networkUser.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {networkUser.name}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {networkUser.email}
                  </p>
                  {(networkUser.position || networkUser.company) && (
                    <p className="truncate text-xs text-slate-500">
                      {[networkUser.position, networkUser.company]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
              </button>
            ))}
            {users.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Sua rede ainda está vazia. Use “Convidar usuário” para adicionar
                a primeira pessoa.
              </p>
            )}
          </div>
        </div>
        {message && (
          <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </DialogShell>
  );
}

function TeamsDialog({
  teams,
  onClose,
  onChanged,
}: {
  teams: TeamItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const user = getStoredUser();
  const [selectedId, setSelectedId] = useState<string | null>(
    teams[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = teams.find((team) => team.id === selectedId) ?? null;
  const myMembership = selected?.members.find(
    (member) => member.userId === user?.id,
  );
  const canManage = myMembership?.role === "ADMIN";

  const saveTeam = useMutation({
    mutationFn: () =>
      api<{ team: TeamItem }>(
        creating ? "/api/teams" : `/api/teams/${selected!.id}`,
        {
          method: creating ? "POST" : "PATCH",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        },
      ),
    onSuccess: ({ team }) => {
      setSelectedId(team.id);
      setCreating(false);
      setEditing(false);
      setError(null);
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar a equipe.",
      ),
  });
  const addMember = useMutation({
    mutationFn: () =>
      api(`/api/teams/${selected!.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: memberEmail.trim() }),
      }),
    onSuccess: () => {
      setMemberEmail("");
      setError(null);
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível adicionar o integrante.",
      ),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api(`/api/teams/${selected!.id}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível remover o integrante.",
      ),
  });
  const removeTeam = useMutation({
    mutationFn: () => api(`/api/teams/${selected!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      setSelectedId(null);
      setError(null);
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível concluir a ação.",
      ),
  });

  function beginCreate() {
    setCreating(true);
    setEditing(false);
    setName("");
    setDescription("");
    setError(null);
  }
  function beginEdit() {
    if (!selected) return;
    setEditing(true);
    setCreating(false);
    setName(selected.name);
    setDescription(selected.description ?? "");
    setError(null);
  }

  return (
    <DialogShell
      title="Equipes"
      subtitle="Equipes às quais você está vinculado"
      icon={<UsersRound size={20} />}
      onClose={onClose}
      maxWidth="max-w-5xl"
    >
      <div className="grid min-h-[440px] md:grid-cols-[280px_1fr]">
        <aside className="border-b border-slate-200 bg-slate-50 p-4 md:border-b-0 md:border-r">
          <Button type="button" className="mb-4 w-full" onClick={beginCreate}>
            <Plus size={17} />
            Criar equipe
          </Button>
          <div className="space-y-2">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  setSelectedId(team.id);
                  setCreating(false);
                  setEditing(false);
                  setError(null);
                }}
                className={`w-full rounded-lg border p-3 text-left ${selectedId === team.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <p className="truncate text-sm font-semibold text-slate-900">
                  {team.name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {team.members.length} integrante(s)
                </p>
              </button>
            ))}
            {teams.length === 0 && !creating && (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                Você não possui equipe cadastrada.
              </p>
            )}
          </div>
        </aside>
        <section className="p-6">
          {creating || editing ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  {creating ? "Nova equipe" : "Editar equipe"}
                </p>
                <h3 className="mt-1 text-xl font-bold text-slate-950">
                  Dados da equipe
                </h3>
              </div>
              <label className="block space-y-2 text-sm font-semibold">
                <span>Nome *</span>
                <Input
                  autoFocus
                  value={name}
                  maxLength={120}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block space-y-2 text-sm font-semibold">
                <span>Descrição</span>
                <textarea
                  className="min-h-28 w-full rounded-md border border-slate-300 p-3 text-sm"
                  value={description}
                  maxLength={500}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  className="bg-slate-200 text-slate-900 hover:bg-slate-300"
                  onClick={() => {
                    setCreating(false);
                    setEditing(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!name.trim() || saveTeam.isPending}
                  onClick={() => saveTeam.mutate()}
                >
                  {saveTeam.isPending ? "Salvando..." : "Salvar equipe"}
                </Button>
              </div>
            </div>
          ) : selected ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-950">
                    {selected.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {selected.description || "Sem descrição."}
                  </p>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    className="bg-slate-900 hover:bg-slate-800"
                    onClick={beginEdit}
                  >
                    <Pencil size={17} />
                    Editar
                  </Button>
                )}
              </div>
              {canManage && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="mb-3 text-sm font-bold text-slate-900">
                    Adicionar integrante
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="usuario@exemplo.com"
                      value={memberEmail}
                      onChange={(event) => setMemberEmail(event.target.value)}
                    />
                    <Button
                      type="button"
                      disabled={!memberEmail.trim() || addMember.isPending}
                      onClick={() => addMember.mutate()}
                    >
                      <Plus size={17} />
                      Adicionar
                    </Button>
                  </div>
                </div>
              )}
              <div>
                <p className="mb-3 text-sm font-bold text-slate-900">
                  Integrantes
                </p>
                <div className="space-y-2">
                  {selected.members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {member.user.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {member.user.email} ·{" "}
                          {member.role === "ADMIN"
                            ? "Administrador"
                            : "Integrante"}
                        </p>
                      </div>
                      {canManage && member.userId !== user?.id && (
                        <IconButton
                          title="Remover integrante"
                          disabled={removeMember.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Remover ${member.user.name} da equipe?`,
                              )
                            )
                              removeMember.mutate(member.userId);
                          }}
                        >
                          <UserMinus size={17} />
                        </IconButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end border-t border-slate-200 pt-4">
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700"
                  disabled={removeTeam.isPending}
                  onClick={() => {
                    const action = canManage
                      ? "desfazer esta equipe para todos"
                      : "sair desta equipe";
                    if (window.confirm(`Deseja realmente ${action}?`))
                      removeTeam.mutate();
                  }}
                >
                  <Trash2 size={17} />
                  {canManage ? "Desfazer equipe" : "Sair da equipe"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-center text-sm text-slate-500">
              <div>
                <UsersRound className="mx-auto mb-3" size={32} />
                <p>Selecione uma equipe ou crie uma nova.</p>
              </div>
            </div>
          )}
          {error && (
            <p
              className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
        </section>
      </div>
    </DialogShell>
  );
}

function NotificationDialog({
  notification,
  isMarkingRead,
  error,
  onClose,
  onMarkRead,
}: {
  notification: NotificationItem;
  isMarkingRead: boolean;
  error: Error | null;
  onClose: () => void;
  onMarkRead: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <Card
        className="w-full max-w-lg overflow-hidden border-slate-300 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600">
              <Bell size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Notificação
              </p>
              <h2 id="notification-title" className="text-lg font-semibold">
                {notification.title}
              </h2>
            </div>
          </div>
          <IconButton title="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="space-y-5 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {notification.body ||
                "Esta notificação não possui informações adicionais."}
            </p>
            {notification.createdAt && (
              <p className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500">
                Recebida em{" "}
                {format(
                  new Date(notification.createdAt),
                  "dd/MM/yyyy 'às' HH:mm",
                )}
              </p>
            )}
          </div>
          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error.message ||
                "Não foi possível marcar a notificação como lida."}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              className="bg-slate-200 text-slate-900 hover:bg-slate-300"
              onClick={onClose}
            >
              Fechar
            </Button>
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

function TaskDialog({
  tasks,
  calendars,
  teams,
  users,
  initialTaskId,
  initialCreating,
  openOnly,
  onClose,
  onChanged,
}: {
  tasks: TaskItem[];
  calendars: CalendarItem[];
  teams: TeamItem[];
  users: NetworkUser[];
  initialTaskId: string | null;
  initialCreating: boolean;
  openOnly: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [selectedId, setSelectedId] = useState(
    initialTaskId ?? tasks[0]?.id ?? null,
  );
  const [creating, setCreating] = useState(initialCreating);
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;
  const sidebarTasks = creating
    ? tasks.filter((task) => !task.completedAt)
    : tasks;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-slate-950/60 p-0 backdrop-blur-sm sm:p-4">
      <Card
        className="safe-bottom flex h-[100dvh] w-full min-w-0 max-w-5xl flex-col overflow-hidden rounded-none border-slate-300 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tasks-title"
      >
        <div className="safe-top flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-950 px-3 py-2.5 text-white sm:gap-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600">
              <CheckCircle2 size={20} />
            </span>
            <div className="min-w-0">
              <h2
                id="tasks-title"
                className="truncate text-base font-semibold sm:text-lg"
              >
                {openOnly ? "Tarefas abertas" : "Todas as tarefas"}
              </h2>
              <p className="hidden text-xs text-slate-300 sm:block">
                Consulte responsabilidades, prazos e progresso.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              className="px-2.5 sm:px-4"
              onClick={() => setCreating(true)}
            >
              <CheckCircle2 size={17} />
              <span className="hidden min-[390px]:inline">Nova tarefa</span>
              <span className="min-[390px]:hidden">Nova</span>
            </Button>
            <IconButton title="Fechar" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden md:grid-cols-[300px_1fr] md:grid-rows-1">
          <aside className="min-w-0 border-b border-slate-200 bg-slate-50 p-2.5 sm:p-4 md:overflow-y-auto md:border-b-0 md:border-r">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:mb-3 sm:text-xs">
              {sidebarTasks.length} tarefa(s){creating ? " aberta(s)" : ""}
            </p>
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1 md:block md:max-h-none md:space-y-2 md:overflow-x-hidden md:overflow-y-auto md:pr-1">
              {sidebarTasks.map((task) => (
                <button
                  type="button"
                  key={task.id}
                  onClick={() => {
                    setSelectedId(task.id);
                    setCreating(false);
                  }}
                  className={`block w-44 shrink-0 rounded-lg border p-2.5 text-left transition sm:w-56 md:w-full md:p-3 ${selectedId === task.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {task.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{task.priority}</span>
                    <span>{task.progress}%</span>
                  </div>
                </button>
              ))}
              {sidebarTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                  {creating || openOnly
                    ? "Não há tarefas abertas."
                    : "Nenhuma tarefa disponível."}
                </p>
              )}
            </div>
          </aside>
          <section className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6">
            {creating ? (
              <TaskCreateForm
                calendars={calendars}
                teams={teams}
                users={users}
                onCancel={() => setCreating(false)}
                onCreated={(taskId, createAnother) => {
                  onChanged();
                  setSelectedId(taskId);
                  setCreating(createAnother);
                }}
              />
            ) : selectedTask ? (
              <TaskDetails
                key={selectedTask.id}
                task={selectedTask}
                teams={teams}
                users={users}
                onChanged={onChanged}
              />
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-500">
                Selecione uma tarefa ou cadastre uma nova.
              </div>
            )}
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
  teamId: z.string(),
  assigneeEmail: z.string(),
  observerEmails: z.string(),
  categoryId: z.string(),
  startDate: z.string(),
  startTime: z.string(),
  dueDate: z.string(),
  endTime: z.string(),
  allDay: z.boolean(),
  noTime: z.boolean(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT", "CRITICAL"]),
  status: z.enum([
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING",
    "PAUSED",
    "COMPLETED",
    "CANCELED",
  ]),
  privacy: z.enum(["PUBLIC", "PRIVATE", "PARTICIPANTS", "ADMINS"]),
  progressMode: z.enum(["MANUAL", "AUTOMATIC"]),
  progress: z.number().min(0).max(100),
  recurrenceMode: z.enum([
    "NONE",
    "DAILY",
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY",
    "YEARLY",
    "CUSTOM",
  ]),
  recurrenceInterval: z.number().int().min(1).max(365),
  recurrenceEndsAt: z.string(),
});

type TaskCreateValues = z.infer<typeof taskCreateSchema>;

function maskPtBrDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)]
    .filter(Boolean)
    .join("/");
}

function parsePtBrDate(value: string, time = "00:00") {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hours,
    minutes,
  );
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
    ? date
    : null;
}

function TaskCreateForm({
  calendars,
  teams,
  users,
  onCancel,
  onCreated,
}: {
  calendars: CalendarItem[];
  teams: TeamItem[];
  users: NetworkUser[];
  onCancel: () => void;
  onCreated: (taskId: string, createAnother: boolean) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [personas, setPersonas] = useState<
    Array<{ name: string; role: string }>
  >([]);
  const [personaName, setPersonaName] = useState("");
  const [personaRole, setPersonaRole] = useState("");
  const { register, handleSubmit, watch, reset, setValue, formState } =
    useForm<TaskCreateValues>({
      resolver: zodResolver(taskCreateSchema),
      defaultValues: {
        title: "",
        summary: "",
        description: "",
        tags: "",
        color: "#2563eb",
        icon: "check-circle",
        calendarId: calendars[0]?.id ?? "",
        teamId: "",
        assigneeEmail: "",
        observerEmails: "",
        categoryId: "",
        startDate: format(new Date(), "dd/MM/yyyy"),
        startTime: "09:00",
        dueDate: format(new Date(), "dd/MM/yyyy"),
        endTime: "10:00",
        allDay: false,
        noTime: false,
        priority: "NORMAL",
        status: "NOT_STARTED",
        privacy: "PRIVATE",
        progressMode: "MANUAL",
        progress: 0,
        recurrenceMode: "NONE",
        recurrenceInterval: 1,
        recurrenceEndsAt: "",
      },
    });
  const selectedCalendar = calendars.find(
    (calendar) => calendar.id === watch("calendarId"),
  );
  const noTime = watch("noTime");
  const allDay = watch("allDay");
  const startDate = watch("startDate");
  const dueDate = watch("dueDate");
  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const recurrenceMode = watch("recurrenceMode");
  const recurrenceEndsAt = watch("recurrenceEndsAt");

  async function submit(
    values: TaskCreateValues,
    options: { draft: boolean; another: boolean },
  ) {
    setServerError(null);
    try {
      const startsAt = values.startDate
        ? parsePtBrDate(
            values.startDate,
            values.noTime || values.allDay ? "00:00" : values.startTime,
          )
        : null;
      const endsAt = values.dueDate
        ? parsePtBrDate(
            values.dueDate,
            values.noTime || values.allDay ? "23:59" : values.endTime,
          )
        : null;
      if (values.startDate && !startsAt)
        throw new Error("Informe a data inicial no formato dd/mm/aaaa.");
      if (values.dueDate && !endsAt)
        throw new Error("Informe a conclusão prevista no formato dd/mm/aaaa.");
      const recurrenceEndsAt = values.recurrenceEndsAt
        ? parsePtBrDate(values.recurrenceEndsAt, "23:59")
        : null;
      if (
        values.recurrenceMode !== "NONE" &&
        values.recurrenceEndsAt &&
        !recurrenceEndsAt
      )
        throw new Error("Informe o fim da recorrência no formato dd/mm/aaaa.");
      if (startsAt && endsAt && endsAt <= startsAt)
        throw new Error("A conclusão prevista deve ser posterior ao início.");
      const response = await api<{ task: TaskItem }>("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          summary: values.summary || null,
          description: values.description || null,
          tags: values.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          color: values.color,
          icon: values.icon,
          calendarId: values.calendarId || null,
          categoryId: values.categoryId || undefined,
          teamId: values.teamId || null,
          assigneeEmail: values.assigneeEmail.trim() || null,
          observerEmails: values.observerEmails
            .split(",")
            .map((email) => email.trim())
            .filter(Boolean),
          checklist,
          personas,
          startsAt: startsAt?.toISOString() ?? null,
          dueAt: endsAt?.toISOString() ?? null,
          endsAt: endsAt?.toISOString() ?? null,
          allDay: values.allDay,
          noTime: values.noTime,
          priority: values.priority,
          status: values.status,
          privacy: values.privacy,
          progressMode: values.progressMode,
          progress: values.progress,
          isDraft: options.draft,
          recurrence:
            values.recurrenceMode === "NONE"
              ? null
              : {
                  frequency:
                    values.recurrenceMode === "BIWEEKLY"
                      ? "WEEKLY"
                      : values.recurrenceMode,
                  interval:
                    values.recurrenceMode === "BIWEEKLY"
                      ? 2
                      : values.recurrenceInterval,
                  endsAt: recurrenceEndsAt?.toISOString() ?? null,
                },
        }),
      });
      if (options.another) {
        reset();
        setChecklist([]);
        setChecklistDraft("");
        setPersonas([]);
        setPersonaName("");
        setPersonaRole("");
      }
      onCreated(response.task.id, options.another);
    } catch (reason) {
      setServerError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível cadastrar a tarefa.",
      );
    }
  }

  const firstError = Object.values(formState.errors)[0]?.message;

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((values) =>
        submit(values, { draft: false, another: false }),
      )}
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
          Cadastro de tarefa
        </p>
        <h3 className="mt-1 text-xl font-bold text-slate-950">
          Informações principais
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          A data de criação e o usuário criador são registrados automaticamente.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <span>Título *</span>
          <Input
            autoFocus
            {...register("title")}
            placeholder="Informe o título da tarefa"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <span>Resumo</span>
          <Input {...register("summary")} placeholder="Resumo objetivo" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <span>Descrição detalhada</span>
          <textarea
            className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
            {...register("description")}
            placeholder="Contexto, instruções e resultado esperado"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Etiquetas</span>
          <Input
            {...register("tags")}
            placeholder="financeiro, mensal, revisão"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Ícone</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("icon")}
          >
            <option value="check-circle">Tarefa</option>
            <option value="briefcase">Trabalho</option>
            <option value="flag">Marco</option>
            <option value="star">Destaque</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Cor</span>
          <input
            type="color"
            className="h-10 w-full rounded-md border border-slate-300 bg-white p-1"
            {...register("color")}
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Agenda</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("calendarId")}
          >
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Equipe vinculada</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("teamId")}
          >
            <option value="">Sem equipe</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Responsável pela tarefa</span>
          <Input
            type="email"
            {...register("assigneeEmail")}
            placeholder="responsavel@exemplo.com"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Observadores</span>
          <Input
            {...register("observerEmails")}
            placeholder="email1@exemplo.com, email2@exemplo.com"
          />
          <span className="block text-xs font-normal text-slate-500">
            Separe múltiplos e-mails por vírgula.
          </span>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2">
          <span>Adicionar usuários da minha rede</span>
          <select
            className="h-11 w-full rounded-md border border-slate-300 bg-white px-3"
            defaultValue=""
            onChange={(event) => {
              const selected = users.find(
                (item) => item.id === event.target.value,
              );
              if (!selected) return;
              const current = watch("observerEmails")
                .split(",")
                .map((email) => email.trim())
                .filter(Boolean);
              if (!current.includes(selected.email))
                setValue(
                  "observerEmails",
                  [...current, selected.email].join(", "),
                  { shouldDirty: true },
                );
              event.target.value = "";
            }}
          >
            <option value="">Selecione um usuário conectado</option>
            {users.map((networkUser) => (
              <option key={networkUser.id} value={networkUser.id}>
                {networkUser.name} — {networkUser.email}
              </option>
            ))}
          </select>
          <span className="block text-xs font-normal text-slate-500">
            O usuário será incluído como observador da tarefa.
          </span>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Categoria</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("categoryId")}
          >
            <option value="">Sem categoria</option>
            {selectedCalendar?.categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Prioridade</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("priority")}
          >
            <option value="LOW">Baixa</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
            <option value="CRITICAL">Crítica</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-slate-700">
          <span>Status</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("status")}
          >
            <option value="NOT_STARTED">Não iniciada</option>
            <option value="IN_PROGRESS">Em andamento</option>
            <option value="WAITING">Aguardando terceiros</option>
            <option value="PAUSED">Pausada</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELED">Cancelada</option>
          </select>
        </label>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="mb-3">
          <p className="text-sm font-bold text-slate-900">
            Checklist da tarefa
          </p>
          <p className="text-xs text-slate-600">
            Monte as etapas necessárias antes de salvar.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={checklistDraft}
            onChange={(event) => setChecklistDraft(event.target.value)}
            placeholder="Ex.: Conferir documentos"
            maxLength={300}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (checklistDraft.trim()) {
                  setChecklist((items) => [...items, checklistDraft.trim()]);
                  setChecklistDraft("");
                }
              }
            }}
          />
          <Button
            type="button"
            disabled={!checklistDraft.trim()}
            onClick={() => {
              setChecklist((items) => [...items, checklistDraft.trim()]);
              setChecklistDraft("");
            }}
          >
            <Plus size={16} />
            Adicionar
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {checklist.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm"
            >
              <span>
                <CheckCircle2
                  size={15}
                  className="mr-2 inline text-slate-400"
                />
                {item}
              </span>
              <button
                type="button"
                className="text-red-600"
                onClick={() =>
                  setChecklist((items) =>
                    items.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {checklist.length === 0 && (
            <p className="text-xs text-slate-500">Nenhum item adicionado.</p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-3">
          <p className="text-sm font-bold text-slate-900">Personas da tarefa</p>
          <p className="text-xs text-slate-600">
            Cadastre participantes que não possuem conta na Agenda, como
            ministrantes ou convidados.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={personaName}
            onChange={(event) => setPersonaName(event.target.value)}
            placeholder="Nome da pessoa"
            maxLength={180}
          />
          <Input
            value={personaRole}
            onChange={(event) => setPersonaRole(event.target.value)}
            placeholder="Função (ex.: Ministrante)"
            maxLength={180}
          />
          <Button
            type="button"
            disabled={!personaName.trim() || !personaRole.trim()}
            onClick={() => {
              setPersonas((items) => [
                ...items,
                { name: personaName.trim(), role: personaRole.trim() },
              ]);
              setPersonaName("");
              setPersonaRole("");
            }}
          >
            <UserRound size={16} />
            Adicionar
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {personas.map((persona, index) => (
            <div
              key={`${persona.name}-${persona.role}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm"
            >
              <span>
                <strong>{persona.name}</strong>
                <span className="ml-2 text-slate-500">{persona.role}</span>
              </span>
              <button
                type="button"
                className="text-red-600"
                onClick={() =>
                  setPersonas((items) =>
                    items.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {personas.length === 0 && (
            <p className="text-xs text-slate-500">
              Nenhuma persona adicionada.
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-bold text-slate-900">
          Datas e horários
        </p>
        <div className="mb-4 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("allDay")} />
            Dia inteiro
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("noTime")} />
            Sem horário definido
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="space-y-2 text-xs font-semibold">
            <span>Data inicial</span>
            <input type="hidden" {...register("startDate")} />
            <DatePickerInput
              value={startDate}
              onChange={(value) =>
                setValue("startDate", value, { shouldDirty: true })
              }
            />
          </label>
          <div>
            <label className="space-y-2 text-xs font-semibold sm:hidden">
              <span>Hora inicial</span>
              <Input
                type="time"
                disabled={noTime || allDay}
                {...register("startTime")}
              />
            </label>
            <div className="hidden sm:block">
              <TimeInput
                label="Hora inicial (24h)"
                value={startTime}
                disabled={noTime || allDay}
                onChange={(value) =>
                  setValue("startTime", value, { shouldDirty: true })
                }
              />
            </div>
          </div>
          <label className="space-y-2 text-xs font-semibold">
            <span>Conclusão prevista</span>
            <input type="hidden" {...register("dueDate")} />
            <DatePickerInput
              value={dueDate}
              onChange={(value) =>
                setValue("dueDate", value, { shouldDirty: true })
              }
            />
          </label>
          <div>
            <label className="space-y-2 text-xs font-semibold sm:hidden">
              <span>Hora final</span>
              <Input
                type="time"
                disabled={noTime || allDay}
                {...register("endTime")}
              />
            </label>
            <div className="hidden sm:block">
              <TimeInput
                label="Hora final (24h)"
                value={endTime}
                disabled={noTime || allDay}
                onChange={(value) =>
                  setValue("endTime", value, { shouldDirty: true })
                }
              />
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm font-semibold">
          <span>Privacidade</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("privacy")}
          >
            <option value="PRIVATE">Privada</option>
            <option value="PUBLIC">Pública</option>
            <option value="PARTICIPANTS">Apenas participantes</option>
            <option value="ADMINS">Apenas administradores</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Cálculo do progresso</span>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            {...register("progressMode")}
          >
            <option value="MANUAL">Manual</option>
            <option value="AUTOMATIC">Automático</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Progresso</span>
          <Input
            type="number"
            min="0"
            max="100"
            {...register("progress", { valueAsNumber: true })}
          />
        </label>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-bold text-slate-900">Recorrência</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-2 text-sm font-semibold">
            <span>Repetir</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
              {...register("recurrenceMode")}
            >
              <option value="NONE">Não repetir</option>
              <option value="DAILY">Todos os dias</option>
              <option value="WEEKLY">Semanalmente</option>
              <option value="BIWEEKLY">Quinzenalmente</option>
              <option value="MONTHLY">Mensalmente</option>
              <option value="YEARLY">Anualmente</option>
              <option value="CUSTOM">Personalizada</option>
            </select>
          </label>
          {recurrenceMode !== "NONE" && (
            <>
              <label className="space-y-2 text-sm font-semibold">
                <span>Intervalo</span>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  disabled={recurrenceMode === "BIWEEKLY"}
                  {...register("recurrenceInterval", { valueAsNumber: true })}
                />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                <span>Repetir até</span>
                <input type="hidden" {...register("recurrenceEndsAt")} />
                <DatePickerInput
                  value={recurrenceEndsAt}
                  onChange={(value) =>
                    setValue("recurrenceEndsAt", value, { shouldDirty: true })
                  }
                />
              </label>
            </>
          )}
        </div>
        {recurrenceMode === "DAILY" && (
          <p className="mt-3 text-xs text-blue-700">
            A tarefa será repetida todos os dias.
          </p>
        )}
      </div>
      {(firstError || serverError) && (
        <p
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {firstError || serverError}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 sm:flex sm:flex-wrap sm:justify-end">
        <Button
          type="button"
          className="bg-slate-200 px-2 text-slate-900 hover:bg-slate-300 sm:px-4"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          className="bg-slate-700 px-2 hover:bg-slate-800 sm:px-4"
          disabled={formState.isSubmitting}
          onClick={handleSubmit((values) =>
            submit(values, { draft: true, another: false }),
          )}
        >
          Salvar rascunho
        </Button>
        <Button
          type="button"
          className="px-2 sm:px-4"
          disabled={formState.isSubmitting}
          onClick={handleSubmit((values) =>
            submit(values, { draft: false, another: true }),
          )}
        >
          Salvar e criar outra
        </Button>
        <Button className="px-2 sm:px-4" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function TaskDetails({
  task,
  teams,
  users,
  onChanged,
}: {
  task: TaskItem;
  teams: TeamItem[];
  users: NetworkUser[];
  onChanged: () => void;
}) {
  const user = getStoredUser();
  const queryClient = useQueryClient();
  const canManage = task.ownerId === user?.id || user?.role === "ADMIN";
  const canDiscuss =
    canManage ||
    task.assigneeId === user?.id ||
    teams.some(
      (team) =>
        team.id === task.teamId &&
        team.members.some((member) => member.userId === user?.id),
    );
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [dueAt, setDueAt] = useState(
    task.dueAt ? format(new Date(task.dueAt), "dd/MM/yyyy") : "",
  );
  const [priority, setPriority] = useState(task.priority);
  const [progress, setProgress] = useState(task.progress);
  const [teamId, setTeamId] = useState(task.teamId ?? "");
  const [shareEmail, setShareEmail] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [executionReport, setExecutionReport] = useState(
    task.executionReport ?? "",
  );
  const [chatBody, setChatBody] = useState("");
  const [chatImage, setChatImage] = useState<File | null>(null);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [observerEmail, setObserverEmail] = useState("");
  const [personaName, setPersonaName] = useState("");
  const [personaRole, setPersonaRole] = useState("");

  const taskMessagesQuery = useQuery({
    queryKey: ["task-messages", task.id],
    queryFn: () =>
      api<{ messages: TaskMessageItem[] }>(`/api/tasks/${task.id}/messages`),
    enabled: canDiscuss,
  });

  const updateTask = useMutation({
    mutationFn: () => {
      const parsedDueAt = dueAt ? parsePtBrDate(dueAt, "12:00") : null;
      if (dueAt && !parsedDueAt)
        throw new Error("Informe o prazo no formato dd/mm/aaaa.");
      return api(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          dueAt: parsedDueAt?.toISOString() ?? null,
          priority,
          teamId: teamId || null,
          progress,
        }),
      });
    },
    onSuccess: () => {
      setEditing(false);
      setError(null);
      setMessage("Tarefa atualizada com sucesso.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível atualizar a tarefa.",
      ),
  });

  const shareTask = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task.id}/share`, {
        method: "POST",
        body: JSON.stringify({ email: shareEmail.trim() }),
      }),
    onSuccess: () => {
      setShareEmail("");
      setError(null);
      setMessage("Tarefa compartilhada e atribuída com sucesso.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível compartilhar a tarefa.",
      ),
  });
  const externalShare = useMutation({
    mutationFn: () =>
      api<{ share: { url: string } }>(`/api/tasks/${task.id}/external-shares`, {
        method: "POST",
        body: JSON.stringify({ expiresInDays: 30 }),
      }),
    onSuccess: async ({ share }) => {
      setExternalUrl(share.url);
      setError(null);
      const shareData = {
        title: `Tarefa: ${task.title}`,
        text: `Acesse a tarefa compartilhada no Agenda OrganizaÍ: ${task.title}`,
        url: share.url,
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
          setMessage("Compartilhamento aberto no dispositivo.");
        } else {
          await navigator.clipboard.writeText(share.url);
          setMessage(
            "Este dispositivo não abriu o menu de compartilhamento; o link foi copiado.",
          );
        }
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          setMessage(
            "Compartilhamento cancelado. O link permanece disponível para copiar.",
          );
        } else {
          await navigator.clipboard.writeText(share.url).catch(() => undefined);
          setMessage(
            "Não foi possível abrir os aplicativos; o link ficou disponível e foi copiado quando permitido.",
          );
        }
      }
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível gerar o link externo.",
      ),
  });
  const revokeExternalShares = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task.id}/external-shares`, { method: "DELETE" }),
    onSuccess: () => {
      setExternalUrl("");
      setMessage("Todos os links públicos desta tarefa foram revogados.");
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível revogar os links.",
      ),
  });
  const assumeTask = useMutation({
    mutationFn: () => api(`/api/tasks/${task.id}/assume`, { method: "POST" }),
    onSuccess: () => {
      setMessage("Tarefa assumida por você.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível assumir a tarefa.",
      ),
  });
  const executeTask = useMutation({
    mutationFn: () => api(`/api/tasks/${task.id}/execute`, { method: "POST" }),
    onSuccess: () => {
      setMessage("Execução iniciada.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível iniciar a execução.",
      ),
  });
  const finishTask = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task.id}/finish`, {
        method: "POST",
        body: JSON.stringify({ report: executionReport.trim() }),
      }),
    onSuccess: () => {
      setFinalizing(false);
      setMessage("Tarefa finalizada e relatório salvo.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível finalizar a tarefa.",
      ),
  });
  const sendTaskMessage = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      if (chatBody.trim()) formData.append("body", chatBody.trim());
      if (chatImage) formData.append("image", chatImage);
      return apiForm(`/api/tasks/${task.id}/messages`, formData);
    },
    onSuccess: () => {
      setChatBody("");
      setChatImage(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["task-messages", task.id] });
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar a mensagem.",
      ),
  });
  const addChecklistItem = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task.id}/checklist`, {
        method: "POST",
        body: JSON.stringify({ title: checklistDraft.trim() }),
      }),
    onSuccess: () => {
      setChecklistDraft("");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível adicionar o item.",
      ),
  });
  const toggleChecklistItem = useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      api(`/api/tasks/${task.id}/checklist/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      }),
    onSuccess: onChanged,
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível atualizar o checklist.",
      ),
  });
  const deleteChecklistItem = useMutation({
    mutationFn: (id: string) =>
      api(`/api/tasks/${task.id}/checklist/${id}`, { method: "DELETE" }),
    onSuccess: onChanged,
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível excluir o item.",
      ),
  });
  const addObserver = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task.id}/observers`, {
        method: "POST",
        body: JSON.stringify({ email: observerEmail.trim() }),
      }),
    onSuccess: () => {
      setObserverEmail("");
      setMessage("Observador adicionado.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível adicionar o observador.",
      ),
  });
  const removeObserver = useMutation({
    mutationFn: (userId: string) =>
      api(`/api/tasks/${task.id}/observers/${userId}`, { method: "DELETE" }),
    onSuccess: onChanged,
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível remover o observador.",
      ),
  });
  const addPersona = useMutation({
    mutationFn: () =>
      api(`/api/tasks/${task.id}/personas`, {
        method: "POST",
        body: JSON.stringify({
          name: personaName.trim(),
          role: personaRole.trim(),
        }),
      }),
    onSuccess: () => {
      setPersonaName("");
      setPersonaRole("");
      setMessage("Persona adicionada à tarefa.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível adicionar a persona.",
      ),
  });
  const removePersona = useMutation({
    mutationFn: (personaId: string) =>
      api(`/api/tasks/${task.id}/personas/${personaId}`, { method: "DELETE" }),
    onSuccess: () => {
      setMessage("Persona removida da tarefa.");
      onChanged();
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível remover a persona.",
      ),
  });

  return (
    <div className="space-y-5">
      {editing ? (
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-semibold text-slate-700">
            <span>Título</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={180}
            />
          </label>
          <label className="block space-y-2 text-sm font-semibold text-slate-700">
            <span>Descrição</span>
            <textarea
              className="min-h-28 w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Prazo</span>
              <DatePickerInput value={dueAt} onChange={setDueAt} />
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Prioridade</span>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="LOW">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span>Progresso: {progress}%</span>
              <input
                className="h-10 w-full accent-blue-600"
                type="range"
                min="0"
                max="95"
                step="5"
                value={Math.min(progress, 95)}
                onChange={(event) => setProgress(Number(event.target.value))}
              />
            </label>
          </div>
          <label className="block space-y-2 text-sm font-semibold text-slate-700">
            <span>Equipe vinculada</span>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">Sem equipe</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              className="bg-slate-200 text-slate-900 hover:bg-slate-300"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!title.trim() || updateTask.isPending}
              onClick={() => updateTask.mutate()}
            >
              {updateTask.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {task.priority}
              </p>
              <h3 className="mt-1 text-xl font-bold text-slate-950">
                {task.title}
              </h3>
            </div>
            <Badge>
              {task.completedAt ? "Concluída" : `${task.progress}%`}
            </Badge>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {task.description || "Sem descrição."}
          </p>
          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Criador
              </p>
              <p className="mt-1 text-slate-800">
                {task.owner?.name ?? "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Responsável
              </p>
              <p className="mt-1 text-slate-800">
                {task.assignee?.name ?? "Não atribuído"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Equipe
              </p>
              <p className="mt-1 text-slate-800">
                {task.team?.name ?? "Sem equipe"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Prazo
              </p>
              <p className="mt-1 text-slate-800">
                {task.dueAt
                  ? format(new Date(task.dueAt), "dd/MM/yyyy")
                  : "Sem prazo"}
              </p>
            </div>
          </div>
          {task.recurrence && (
            <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Recorrência:{" "}
              {task.recurrence.frequency === "DAILY"
                ? "todos os dias"
                : task.recurrence.frequency === "WEEKLY" &&
                    task.recurrence.interval === 2
                  ? "quinzenalmente"
                  : task.recurrence.frequency.toLowerCase()}
              {task.recurrence.endsAt
                ? ` até ${format(new Date(task.recurrence.endsAt), "dd/MM/yyyy")}`
                : ""}
              .
            </p>
          )}
          {task.startedAt && (
            <p className="mt-3 text-xs text-slate-500">
              Execução iniciada em{" "}
              {format(new Date(task.startedAt), "dd/MM/yyyy 'às' HH:mm")}.
            </p>
          )}
          {task.executionReport && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase text-emerald-700">
                Relatório final
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {task.executionReport}
              </p>
            </div>
          )}
        </div>
      )}
      {!editing && !task.completedAt && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3">
            <p className="font-bold text-slate-950">Execução da tarefa</p>
            <p className="text-xs text-slate-600">
              Assuma a responsabilidade, inicie a execução e finalize com o
              relatório.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!task.assigneeId && (
              <Button
                type="button"
                disabled={assumeTask.isPending}
                onClick={() => assumeTask.mutate()}
              >
                <UsersRound size={17} />
                {assumeTask.isPending ? "Assumindo..." : "Assumir"}
              </Button>
            )}
            {task.assigneeId === user?.id && !task.startedAt && (
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={executeTask.isPending}
                onClick={() => executeTask.mutate()}
              >
                <Play size={17} />
                {executeTask.isPending ? "Iniciando..." : "Executar"}
              </Button>
            )}
            {(canManage ||
              (task.startedAt && task.assigneeId === user?.id)) && (
              <Button
                type="button"
                className="bg-emerald-700 hover:bg-emerald-800"
                onClick={() => setFinalizing(true)}
              >
                <CheckCircle2 size={17} />
                Finalizar
              </Button>
            )}
          </div>
          {task.assignee && task.assigneeId !== user?.id && (
            <p className="mt-3 text-xs text-slate-600">
              Assumida por <strong>{task.assignee.name}</strong>.
            </p>
          )}
          {finalizing && (
            <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-white p-4">
              <label className="block space-y-2 text-sm font-semibold text-slate-700">
                <span>Relatório completo da tarefa *</span>
                <textarea
                  className="min-h-36 w-full rounded-md border border-slate-300 p-3 text-sm"
                  value={executionReport}
                  onChange={(event) => setExecutionReport(event.target.value)}
                  maxLength={10000}
                  placeholder="Descreva o que foi realizado, resultados, dificuldades e observações."
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  className="bg-slate-200 text-slate-900 hover:bg-slate-300"
                  onClick={() => setFinalizing(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-700 hover:bg-emerald-800"
                  disabled={
                    executionReport.trim().length < 10 || finishTask.isPending
                  }
                  onClick={() => finishTask.mutate()}
                >
                  {finishTask.isPending
                    ? "Finalizando..."
                    : "Salvar relatório e finalizar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
          <p className="font-bold text-slate-950">Checklist</p>
          <p className="text-xs text-slate-500">
            {task.subtasks?.filter((item) => item.completedAt).length ?? 0} de{" "}
            {task.subtasks?.length ?? 0} concluídos
          </p>
        </div>
        {canManage && (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <Input
              value={checklistDraft}
              onChange={(event) => setChecklistDraft(event.target.value)}
              placeholder="Adicionar nova etapa"
              maxLength={300}
            />
            <Button
              type="button"
              disabled={!checklistDraft.trim() || addChecklistItem.isPending}
              onClick={() => addChecklistItem.mutate()}
            >
              <Plus size={16} />
              Adicionar
            </Button>
          </div>
        )}
        <div className="space-y-2">
          {task.subtasks?.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-600"
                checked={Boolean(item.completedAt)}
                onChange={(event) =>
                  toggleChecklistItem.mutate({
                    id: item.id,
                    completed: event.target.checked,
                  })
                }
              />
              <span
                className={`flex-1 text-sm ${item.completedAt ? "text-slate-400 line-through" : "text-slate-800"}`}
              >
                {item.title}
              </span>
              {canManage && (
                <button
                  type="button"
                  className="text-red-600"
                  onClick={() => deleteChecklistItem.mutate(item.id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {!task.subtasks?.length && (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Nenhum item no checklist.
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="mb-3">
          <p className="font-bold text-slate-950">Personas da tarefa</p>
          <p className="text-xs text-slate-600">
            Participantes sem conta na Agenda, como ministrantes, palestrantes
            ou convidados.
          </p>
        </div>
        {canManage && (
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={personaName}
              onChange={(event) => setPersonaName(event.target.value)}
              placeholder="Nome da pessoa"
              maxLength={180}
            />
            <Input
              value={personaRole}
              onChange={(event) => setPersonaRole(event.target.value)}
              placeholder="Função na tarefa"
              maxLength={180}
            />
            <Button
              type="button"
              disabled={
                !personaName.trim() ||
                !personaRole.trim() ||
                addPersona.isPending
              }
              onClick={() => addPersona.mutate()}
            >
              <UserRound size={16} />
              Adicionar
            </Button>
          </div>
        )}
        <div className="space-y-2">
          {task.personas?.map((persona) => (
            <div
              key={persona.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <UserRound size={18} />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-slate-900">
                    {persona.name}
                  </strong>
                  <span className="block truncate text-xs text-slate-500">
                    {persona.role}
                  </span>
                </span>
              </div>
              {canManage && (
                <button
                  type="button"
                  title="Remover persona"
                  className="text-red-600"
                  disabled={removePersona.isPending}
                  onClick={() => removePersona.mutate(persona.id)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {!task.personas?.length && (
            <p className="rounded-lg border border-dashed border-amber-300 p-4 text-center text-sm text-slate-500">
              Nenhuma persona adicionada.
            </p>
          )}
        </div>
      </div>
      {canManage && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
          <p className="font-bold text-slate-950">
            Usuários e observadores da tarefa
          </p>
          <p className="mb-3 text-xs text-slate-600">
            Adicione alguém da sua rede ou informe um e-mail cadastrado.
            Observadores podem acompanhar a tarefa, sem executar ou conversar.
          </p>
          <select
            className="mb-2 h-11 w-full rounded-md border border-violet-200 bg-white px-3"
            value=""
            onChange={(event) => {
              const selected = users.find(
                (item) => item.id === event.target.value,
              );
              if (selected) setObserverEmail(selected.email);
            }}
          >
            <option value="">Selecionar usuário da minha rede</option>
            {users
              .filter(
                (networkUser) =>
                  !task.observers?.some(
                    (observer) => observer.userId === networkUser.id,
                  ),
              )
              .map((networkUser) => (
                <option key={networkUser.id} value={networkUser.id}>
                  {networkUser.name} — {networkUser.email}
                </option>
              ))}
          </select>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              value={observerEmail}
              onChange={(event) => setObserverEmail(event.target.value)}
              placeholder="observador@exemplo.com"
            />
            <Button
              type="button"
              disabled={!observerEmail.trim() || addObserver.isPending}
              onClick={() => addObserver.mutate()}
            >
              <Eye size={16} />
              Adicionar
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {task.observers?.map((observer) => (
              <div
                key={observer.id}
                className="flex items-center justify-between rounded-lg bg-white p-3 text-sm"
              >
                <span className="min-w-0">
                  <strong className="block truncate sm:inline">
                    {observer.user.name}
                  </strong>
                  <span className="block truncate text-slate-500 sm:ml-2 sm:inline">
                    {observer.user.email}
                  </span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-red-600"
                  onClick={() => removeObserver.mutate(observer.userId)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            {!task.observers?.length && (
              <p className="text-xs text-slate-500">
                Nenhum observador adicionado.
              </p>
            )}
          </div>
        </div>
      )}
      {canDiscuss && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4">
            <p className="font-bold text-slate-950">Mensagens e fotos</p>
            <p className="text-xs text-slate-500">
              Conversa da equipe, executor e administradores sobre esta tarefa.
            </p>
          </div>
          <div className="mb-4 max-h-80 space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-3">
            {taskMessagesQuery.data?.messages.map((item) => (
              <div
                key={item.id}
                className={`max-w-[90%] rounded-lg border p-3 ${item.author.id === user?.id ? "ml-auto border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-700">
                    {item.author.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {format(new Date(item.createdAt), "dd/MM HH:mm")}
                  </p>
                </div>
                {item.body && (
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {item.body}
                  </p>
                )}
                {item.imageUrl && (
                  <AuthenticatedTaskImage
                    path={item.imageUrl}
                    alt={item.imageName ?? "Foto da tarefa"}
                  />
                )}
              </div>
            ))}
            {taskMessagesQuery.data?.messages.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">
                Nenhuma mensagem ainda.
              </p>
            )}
          </div>
          <textarea
            className="min-h-20 w-full rounded-md border border-slate-300 p-3 text-sm"
            value={chatBody}
            onChange={(event) => setChatBody(event.target.value)}
            maxLength={5000}
            placeholder="Escreva uma mensagem sobre a tarefa"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800">
                <Camera size={17} />
                Tirar foto
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) =>
                    setChatImage(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Plus size={17} />
                {chatImage ? chatImage.name : "Subir foto"}
                <input
                  className="hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setChatImage(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            </div>
            <Button
              type="button"
              disabled={
                (!chatBody.trim() && !chatImage) || sendTaskMessage.isPending
              }
              onClick={() => sendTaskMessage.mutate()}
            >
              <Send size={17} />
              {sendTaskMessage.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      )}
      {canManage && !editing && (
        <>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
              <Share2 size={17} className="text-blue-600" />
              Atribuir a uma pessoa
            </div>
            <p className="mb-3 text-xs text-slate-500">
              A pessoa precisa ter uma conta com este e-mail.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail
                  className="absolute left-3 top-2.5 text-slate-400"
                  size={18}
                />
                <Input
                  className="pl-10"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  value={shareEmail}
                  onChange={(event) => setShareEmail(event.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={!shareEmail.trim() || shareTask.isPending}
                onClick={() => shareTask.mutate()}
              >
                {shareTask.isPending ? "Atribuindo..." : "Atribuir"}
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
              <Share2 size={17} className="text-amber-700" />
              Compartilhamento público
            </div>
            <p className="mb-3 text-xs text-slate-600">
              Gera o link e abre os aplicativos de compartilhamento do celular.
              O acesso é somente leitura e válido por 30 dias.
            </p>
            <Button
              type="button"
              className="bg-amber-700 hover:bg-amber-800"
              disabled={externalShare.isPending}
              onClick={() => externalShare.mutate()}
            >
              <Share2 size={17} />
              {externalShare.isPending ? "Preparando..." : "Compartilhar"}
            </Button>
            {externalUrl && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={externalUrl} />
                <Button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(externalUrl)}
                >
                  Copiar link
                </Button>
              </div>
            )}
            <p className="mt-3 text-xs text-slate-600">
              Entrar no sistema não atribui a tarefa. No dashboard ela só
              aparece para o responsável ou para integrantes da equipe
              vinculada.
            </p>
            <button
              type="button"
              className="mt-3 block text-xs font-semibold text-red-700 hover:underline"
              disabled={revokeExternalShares.isPending}
              onClick={() => revokeExternalShares.mutate()}
            >
              Revogar todos os links públicos
            </button>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              className="bg-slate-900 hover:bg-slate-800"
              onClick={() => setEditing(true)}
            >
              <Pencil size={17} />
              Editar tarefa
            </Button>
          </div>
        </>
      )}
      {!canManage && (
        <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Você pode visualizar esta tarefa. Somente o criador ou um
          administrador pode editar e compartilhar.
        </p>
      )}
      {message && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {error && (
        <p
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function AuthenticatedTaskImage({ path, alt }: { path: string; alt: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    apiBlob(path)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => setSource(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  return source ? (
    <img
      src={source}
      alt={alt}
      className="mt-2 max-h-72 w-full rounded-lg object-contain"
    />
  ) : (
    <p className="mt-2 text-xs text-slate-400">Carregando foto...</p>
  );
}

function EventDetailsDialog({
  event,
  teams,
  users,
  onClose,
  onChanged,
}: {
  event: EventItem;
  teams: TeamItem[];
  users: NetworkUser[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const user = getStoredUser();
  const canManage = event.createdById === user?.id;
  const initialStart = new Date(event.startsAt);
  const initialEnd = new Date(event.endsAt);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [meetingLink, setMeetingLink] = useState(event.link ?? "");
  const [meetingProvider, setMeetingProvider] = useState(() =>
    meetingProviderFromLink(event.link),
  );
  const [teamId, setTeamId] = useState(event.teamId ?? "");
  const [date, setDate] = useState(initialStart);
  const [start, setStart] = useState(format(initialStart, "HH:mm"));
  const [end, setEnd] = useState(format(initialEnd, "HH:mm"));
  const [shareEmail, setShareEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [feedback, setFeedback] = useState(event.feedback ?? "");
  const [discussionTopics, setDiscussionTopics] = useState(
    event.discussionTopics ?? "",
  );

  const updateMutation = useMutation({
    mutationFn: () => {
      const day = format(date, "yyyy-MM-dd");
      if (!isValidTime(start) || !isValidTime(end))
        throw new Error(
          "Informe os horários no formato HH:mm, entre 00:00 e 23:59.",
        );
      const startsAt = new Date(`${day}T${start}:00`);
      const endsAt = new Date(`${day}T${end}:00`);
      if (endsAt <= startsAt)
        throw new Error("O horário final deve ser maior que o inicial.");
      return api(`/api/events/${event.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          link: meetingLink.trim() || null,
          teamId: teamId || null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        }),
      });
    },
    onSuccess: onChanged,
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível editar o evento.",
      ),
  });

  const shareMutation = useMutation({
    mutationFn: () =>
      api(`/api/events/${event.id}/share`, {
        method: "POST",
        body: JSON.stringify({ email: shareEmail.trim() }),
      }),
    onSuccess: () => {
      setShareEmail("");
      setError(null);
      setMessage("Compromisso compartilhado com sucesso.");
    },
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível compartilhar.",
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/api/events/${event.id}`, { method: "DELETE" }),
    onSuccess: onChanged,
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível excluir o evento.",
      ),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api(`/api/events/${event.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          feedback: feedback.trim(),
          discussionTopics: discussionTopics.trim(),
        }),
      }),
    onSuccess: onChanged,
    onError: (reason) =>
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível finalizar o evento.",
      ),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <Card
        className="my-auto w-full max-w-2xl overflow-hidden border-slate-300 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-details-title"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600">
              <Eye size={20} />
            </span>
            <div>
              <h2 id="event-details-title" className="text-lg font-semibold">
                Detalhes do compromisso
              </h2>
              <p className="text-xs text-slate-300">
                Visualize e gerencie as informações da agenda.
              </p>
            </div>
          </div>
          <IconButton title="Fechar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>

        <div className="space-y-5 p-6">
          {editing ? (
            <div className="space-y-4">
              <label className="block space-y-2 text-sm font-semibold text-slate-700">
                <span>Título</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={180}
                />
              </label>
              <label className="block space-y-2 text-sm font-semibold text-slate-700">
                <span>Descrição</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={5000}
                />
              </label>
              <MeetingLinkFields
                provider={meetingProvider}
                link={meetingLink}
                onProviderChange={(provider) => {
                  setMeetingProvider(provider);
                  if (provider === "NONE") setMeetingLink("");
                }}
                onLinkChange={setMeetingLink}
              />
              <label className="block space-y-2 text-sm font-semibold text-slate-700">
                <span>Equipe vinculada</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">Sem equipe</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <EventDatePicker value={date} onChange={setDate} />
              <div className="grid grid-cols-2 gap-3">
                <TimeInput label="Início" value={start} onChange={setStart} />
                <TimeInput label="Término" value={end} onChange={setEnd} />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  className="bg-slate-200 text-slate-900 hover:bg-slate-300"
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  disabled={!title.trim() || updateMutation.isPending}
                  onClick={() => updateMutation.mutate()}
                >
                  {updateMutation.isPending
                    ? "Salvando..."
                    : "Salvar alterações"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-xl font-bold text-slate-950">
                {event.title}
              </h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {event.description || "Sem descrição."}
              </p>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Data
                  </p>
                  <p className="mt-1 capitalize text-slate-900">
                    {format(initialStart, "EEEE, dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    Horário
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-900">
                    {format(initialStart, "HH:mm")} às{" "}
                    {format(initialEnd, "HH:mm")}
                  </p>
                </div>
              </div>
              {event.link && /^https?:\/\//i.test(event.link) && (
                <a
                  href={event.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                >
                  <Video size={18} />
                  Entrar na reunião
                  <ExternalLink size={15} />
                </a>
              )}
              {event.team && (
                <p className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-sm text-indigo-800">
                  <UsersRound size={16} className="mr-2 inline" />
                  Vinculado à equipe <strong>{event.team.name}</strong>. Todos
                  os integrantes têm acesso.
                </p>
              )}
              {event.status === "DONE" && (
                <div className="mt-4 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-700">
                      Assuntos tratados
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {event.discussionTopics}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-emerald-700">
                      Feedback do evento
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                      {event.feedback}
                    </p>
                  </div>
                  {event.completedAt && (
                    <p className="text-xs text-slate-500">
                      Finalizado em{" "}
                      {format(
                        new Date(event.completedAt),
                        "dd/MM/yyyy 'às' HH:mm",
                      )}
                    </p>
                  )}
                </div>
              )}
              {!canManage && (
                <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                  Evento compartilhado. Somente o criador pode editar ou
                  excluir.
                </p>
              )}
            </div>
          )}

          {canManage && !editing && (
            <>
              {event.status !== "DONE" &&
                (finalizing ? (
                  <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div>
                      <p className="font-semibold text-emerald-900">
                        Finalizar evento
                      </p>
                      <p className="text-xs text-emerald-700">
                        Registre o resultado para manter este evento no
                        histórico.
                      </p>
                    </div>
                    <label className="block space-y-2 text-sm font-semibold text-slate-700">
                      <span>Assuntos tratados *</span>
                      <textarea
                        className="min-h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
                        value={discussionTopics}
                        onChange={(e) => setDiscussionTopics(e.target.value)}
                        maxLength={5000}
                        placeholder="Pautas, decisões e assuntos discutidos"
                      />
                    </label>
                    <label className="block space-y-2 text-sm font-semibold text-slate-700">
                      <span>Como foi o evento? *</span>
                      <textarea
                        className="min-h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        maxLength={5000}
                        placeholder="Resultados, percepções e pontos de melhoria"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        className="bg-slate-200 text-slate-900 hover:bg-slate-300"
                        onClick={() => setFinalizing(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        className="bg-emerald-700 hover:bg-emerald-800"
                        disabled={
                          !feedback.trim() ||
                          !discussionTopics.trim() ||
                          completeMutation.isPending
                        }
                        onClick={() => completeMutation.mutate()}
                      >
                        <CheckCircle2 size={17} />
                        {completeMutation.isPending
                          ? "Finalizando..."
                          : "Confirmar finalização"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      className="bg-emerald-700 hover:bg-emerald-800"
                      onClick={() => setFinalizing(true)}
                    >
                      <CheckCircle2 size={17} />
                      Finalizar evento
                    </Button>
                  </div>
                ))}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
                  <Share2 size={17} className="text-blue-600" />
                  Adicionar usuário ao evento
                </div>
                <select
                  className="mb-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                  value=""
                  onChange={(changeEvent) => {
                    const selected = users.find(
                      (item) => item.id === changeEvent.target.value,
                    );
                    if (selected) setShareEmail(selected.email);
                  }}
                >
                  <option value="">Selecionar usuário da minha rede</option>
                  {users
                    .filter(
                      (networkUser) =>
                        !event.attendees?.some(
                          (attendee) =>
                            attendee.userId === networkUser.id ||
                            attendee.email === networkUser.email,
                        ),
                    )
                    .map((networkUser) => (
                      <option key={networkUser.id} value={networkUser.id}>
                        {networkUser.name} — {networkUser.email}
                      </option>
                    ))}
                </select>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail
                      className="absolute left-3 top-2.5 text-slate-400"
                      size={18}
                    />
                    <Input
                      className="pl-10"
                      type="email"
                      placeholder="email@exemplo.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!shareEmail.trim() || shareMutation.isPending}
                    onClick={() => shareMutation.mutate()}
                  >
                    {shareMutation.isPending ? "Enviando..." : "Compartilhar"}
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {event.attendees?.map((attendee) => (
                    <div
                      key={attendee.id}
                      className="rounded-lg bg-slate-50 p-3 text-sm"
                    >
                      <strong>{attendee.name || attendee.email}</strong>
                      {attendee.name && attendee.email && (
                        <span className="ml-2 text-slate-500">
                          {attendee.email}
                        </span>
                      )}
                    </div>
                  ))}
                  {!event.attendees?.length && (
                    <p className="text-xs text-slate-500">
                      Nenhum usuário adicionado diretamente.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-5">
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Excluir definitivamente o compromisso “${event.title}”?`,
                      )
                    )
                      deleteMutation.mutate();
                  }}
                >
                  <Trash2 size={17} />
                  {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
                </Button>
                {event.status !== "DONE" && (
                  <Button
                    type="button"
                    className="bg-slate-900 hover:bg-slate-800"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil size={17} />
                    Editar
                  </Button>
                )}
              </div>
            </>
          )}

          {message && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
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
      <button
        type="button"
        onClick={onClick}
        className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-soft transition hover:border-blue-300 hover:shadow-md"
        aria-label={`Abrir ${label.toLowerCase()}`}
      >
        {content}
      </button>
    );
  }

  return <Card className="p-4">{content}</Card>;
}

function NewEventDialog({
  defaultCalendarId,
  teams,
  users,
  onClose,
  onCreated,
}: {
  defaultCalendarId: string;
  teams: TeamItem[];
  users: NetworkUser[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [meetingProvider, setMeetingProvider] = useState("NONE");
  const [meetingLink, setMeetingLink] = useState("");
  const [teamId, setTeamId] = useState("");
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>([]);
  const [date, setDate] = useState(() => new Date());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const dateValue = format(date, "yyyy-MM-dd");
      if (!isValidTime(start) || !isValidTime(end))
        throw new Error(
          "Informe os horários no formato HH:mm, entre 00:00 e 23:59.",
        );
      const startsAt = new Date(`${dateValue}T${start}:00`);
      const endsAt = new Date(`${dateValue}T${end}:00`);
      if (endsAt <= startsAt)
        throw new Error("O horario final deve ser maior que o inicial.");

      return api("/api/events", {
        method: "POST",
        body: JSON.stringify({
          calendarId: defaultCalendarId,
          title,
          description: description.trim() || null,
          link: meetingLink.trim() || undefined,
          teamId: teamId || null,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          priority: "NORMAL",
          status: "SCHEDULED",
          visibility: "PRIVATE",
          tags: [],
          attendeeUserIds,
        }),
      });
    },
    onSuccess: onCreated,
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : "Nao foi possivel criar o evento.",
      ),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <Card
        className="my-auto w-full max-w-4xl overflow-hidden border-slate-300 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-event-title"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600">
              <CalendarPlus size={21} aria-hidden />
            </span>
            <div>
              <h2 id="new-event-title" className="text-lg font-semibold">
                Cadastrar evento
              </h2>
              <p className="mt-0.5 text-xs text-slate-300">
                Defina a data e o horário da sua agenda.
              </p>
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
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Data do evento
              </p>
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
              <label className="block space-y-2 text-sm font-semibold text-slate-800">
                <span>Descrição do evento</span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm shadow-sm"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Objetivo, pauta ou informações importantes"
                  maxLength={5000}
                />
              </label>
              <MeetingLinkFields
                provider={meetingProvider}
                link={meetingLink}
                onProviderChange={(provider) => {
                  setMeetingProvider(provider);
                  if (provider === "NONE") setMeetingLink("");
                }}
                onLinkChange={setMeetingLink}
              />
              <label className="block space-y-2 text-sm font-semibold text-slate-800">
                <span>Vincular equipe</span>
                <select
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3"
                  value={teamId}
                  onChange={(event) => setTeamId(event.target.value)}
                >
                  <option value="">Sem equipe</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <span className="block text-xs font-normal text-slate-500">
                  Todos os integrantes da equipe terão acesso ao evento.
                </span>
              </label>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                <p className="text-sm font-bold text-slate-900">
                  Adicionar usuários ao evento
                </p>
                <p className="mb-3 text-xs text-slate-600">
                  Selecione pessoas da sua rede que participarão deste evento.
                </p>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {users.map((networkUser) => (
                    <label
                      key={networkUser.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-violet-600"
                        checked={attendeeUserIds.includes(networkUser.id)}
                        onChange={(changeEvent) =>
                          setAttendeeUserIds((current) =>
                            changeEvent.target.checked
                              ? [...current, networkUser.id]
                              : current.filter((id) => id !== networkUser.id),
                          )
                        }
                      />
                      <span className="min-w-0">
                        <strong className="block truncate">
                          {networkUser.name}
                        </strong>
                        <span className="block truncate text-xs text-slate-500">
                          {networkUser.email}
                        </span>
                      </span>
                    </label>
                  ))}
                  {users.length === 0 && (
                    <p className="text-xs text-slate-500">
                      Convide usuários para sua rede antes de adicioná-los.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">
                    <Clock size={17} aria-hidden />
                  </span>
                  Horário
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <TimeInput label="Início" value={start} onChange={setStart} />
                  <TimeInput label="Término" value={end} onChange={setEnd} />
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                  Resumo
                </p>
                <p className="mt-2 font-semibold capitalize text-slate-950">
                  {format(date, "EEEE, dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Das {start} às {end}
                </p>
              </div>

              {error && (
                <p
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <Button
              type="button"
              className="bg-slate-200 text-slate-900 hover:bg-slate-300"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Cadastrar evento"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

const MEETING_PROVIDERS = [
  { value: "NONE", label: "Sem reunião online", placeholder: "" },
  {
    value: "GOOGLE_MEET",
    label: "Google Meet",
    placeholder: "https://meet.google.com/xxx-xxxx-xxx",
  },
  {
    value: "MICROSOFT_TEAMS",
    label: "Microsoft Teams",
    placeholder: "https://teams.microsoft.com/l/meetup-join/...",
  },
  { value: "ZOOM", label: "Zoom", placeholder: "https://zoom.us/j/..." },
  { value: "OTHER", label: "Outro link", placeholder: "https://..." },
] as const;

function meetingProviderFromLink(link?: string) {
  if (!link) return "NONE";
  if (link.includes("meet.google.com")) return "GOOGLE_MEET";
  if (link.includes("teams.microsoft.com")) return "MICROSOFT_TEAMS";
  if (link.includes("zoom.us")) return "ZOOM";
  return "OTHER";
}

function MeetingLinkFields({
  provider,
  link,
  onProviderChange,
  onLinkChange,
}: {
  provider: string;
  link: string;
  onProviderChange: (provider: string) => void;
  onLinkChange: (link: string) => void;
}) {
  const selected =
    MEETING_PROVIDERS.find((item) => item.value === provider) ??
    MEETING_PROVIDERS[0];
  return (
    <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
          <Video size={17} />
        </span>
        Reunião online
      </div>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="space-y-2 text-xs font-semibold text-slate-600">
          <span>Plataforma</span>
          <select
            className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
          >
            {MEETING_PROVIDERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {provider !== "NONE" && (
          <label className="space-y-2 text-xs font-semibold text-slate-600">
            <span>Link da reunião</span>
            <Input
              type="url"
              value={link}
              onChange={(event) => onLinkChange(event.target.value)}
              placeholder={selected.placeholder}
              required
            />
          </label>
        )}
      </div>
      {provider !== "NONE" && (
        <p className="mt-2 text-xs text-slate-500">
          Cole aqui o link gerado pela plataforma escolhida.
        </p>
      )}
    </div>
  );
}

function DatePickerInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = parsePtBrDate(value);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    startOfMonth(selectedDate ?? new Date()),
  );
  const pickerRef = useRef<HTMLDivElement>(null);
  const firstDay = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: firstDay,
    end: addDays(firstDay, 41),
  });

  useEffect(() => {
    if (selectedDate) setVisibleMonth(startOfMonth(selectedDate));
  }, [value]);

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node))
        setPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [pickerOpen]);

  return (
    <div ref={pickerRef} className="relative">
      <span className="relative block">
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          maxLength={10}
          value={value}
          onChange={(event) => onChange(maskPtBrDate(event.target.value))}
          onFocus={() => setPickerOpen(true)}
          onClick={() => setPickerOpen(true)}
          aria-label="Data no formato dia, mês e ano"
        />
        <button
          type="button"
          title="Selecionar data"
          aria-label="Abrir calendário"
          aria-expanded={pickerOpen}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPickerOpen((open) => !open)}
          className="absolute right-1 top-0.5 grid h-9 w-9 place-items-center rounded-md text-blue-600 transition hover:bg-blue-50"
        >
          <CalendarDays size={17} aria-hidden />
        </button>
      </span>
      {pickerOpen && (
        <div className="absolute left-1/2 top-full z-40 mt-2 w-[calc(100vw-5rem)] max-w-80 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl sm:left-0 sm:w-80 sm:translate-x-0 sm:p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <IconButton
              type="button"
              title="Mês anterior"
              onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
            >
              <ChevronLeft size={17} />
            </IconButton>
            <div className="text-center">
              <p className="text-sm font-bold capitalize text-slate-900">
                {format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                onClick={() => {
                  const today = new Date();
                  setVisibleMonth(startOfMonth(today));
                  onChange(format(today, "dd/MM/yyyy"));
                  setPickerOpen(false);
                }}
              >
                Hoje
              </button>
            </div>
            <IconButton
              type="button"
              title="Próximo mês"
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
            >
              <ChevronRight size={17} />
            </IconButton>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-slate-500">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(
              (weekday) => (
                <span key={weekday} className="py-1.5">
                  {weekday}
                </span>
              ),
            )}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const selected = Boolean(
                selectedDate && isSameDay(day, selectedDate),
              );
              return (
                <button
                  type="button"
                  key={day.toISOString()}
                  aria-label={format(day, "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(format(day, "dd/MM/yyyy"));
                    setPickerOpen(false);
                  }}
                  className={`grid aspect-square min-w-0 place-items-center rounded-md text-xs font-semibold transition ${selected ? "bg-blue-700 text-white" : isSameMonth(day, visibleMonth) ? "text-slate-800 hover:bg-blue-50" : "text-slate-300 hover:bg-slate-50"}`}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TimeInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [hour = "00", minute = "00"] = isValidTime(value)
    ? value.split(":")
    : ["00", "00"];
  const hours = Array.from({ length: 24 }, (_, index) =>
    String(index).padStart(2, "0"),
  );
  const minutes = Array.from({ length: 60 }, (_, index) =>
    String(index).padStart(2, "0"),
  );

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node))
        setPickerOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [pickerOpen]);

  return (
    <div
      ref={pickerRef}
      className="relative block space-y-2 text-xs font-bold text-slate-600"
    >
      <span>{label}</span>
      <span className="relative block">
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="h-12 w-full rounded-lg border-slate-300 bg-slate-50 px-4 pr-11 text-base font-bold tabular-nums tracking-wide text-slate-950 focus:border-blue-500 focus:bg-white"
          value={value}
          onChange={(event) => {
            if (/^[0-9:]*$/.test(event.target.value))
              onChange(event.target.value.slice(0, 5));
          }}
          onBlur={() => onChange(normalizeTime(value))}
          onFocus={() => setPickerOpen(true)}
          placeholder="00:00"
          pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
          aria-label={`${label}, horário de 00:00 a 23:59`}
          disabled={disabled}
          required
        />
        <button
          type="button"
          title="Selecionar horário"
          aria-label={`Selecionar ${label.toLowerCase()}`}
          aria-expanded={pickerOpen}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPickerOpen((open) => !open)}
          className="absolute right-2 top-1.5 grid h-9 w-9 place-items-center rounded-md text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <Clock size={18} aria-hidden />
        </button>
      </span>
      {pickerOpen && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Selecionar horário
            </span>
            <button
              type="button"
              className="rounded px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setPickerOpen(false)}
            >
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="mb-1 text-center text-[11px] font-bold uppercase text-slate-400">
                Hora
              </p>
              <div
                className="max-h-44 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-1"
                role="listbox"
                aria-label="Horas"
              >
                {hours.map((item) => (
                  <button
                    type="button"
                    key={item}
                    role="option"
                    aria-selected={item === hour}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onChange(`${item}:${minute}`)}
                    className={`block w-full rounded-md py-2 text-center text-sm font-bold tabular-nums transition ${item === hour ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-blue-100"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-center text-[11px] font-bold uppercase text-slate-400">
                Minuto
              </p>
              <div
                className="max-h-44 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-1"
                role="listbox"
                aria-label="Minutos"
              >
                {minutes.map((item) => (
                  <button
                    type="button"
                    key={item}
                    role="option"
                    aria-selected={item === minute}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      onChange(`${hour}:${item}`);
                      setPickerOpen(false);
                    }}
                    className={`block w-full rounded-md py-2 text-center text-sm font-bold tabular-nums transition ${item === minute ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-blue-100"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeTime(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length === 3) return `0${digits[0]}:${digits.slice(1)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return value;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) =>
    character.charCodeAt(0),
  );
}

function EventDatePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(value));
  const firstDay = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
  const days = eachDayOfInterval({
    start: firstDay,
    end: addDays(firstDay, 41),
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <IconButton
          type="button"
          title="Mês anterior"
          onClick={() => setVisibleMonth((month) => subMonths(month, 1))}
        >
          <ChevronLeft size={18} />
        </IconButton>
        <div className="text-center">
          <p className="font-bold capitalize text-slate-950">
            {format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <button
            type="button"
            className="mt-0.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
            onClick={() => {
              const today = new Date();
              setVisibleMonth(startOfMonth(today));
              onChange(today);
            }}
          >
            Ir para hoje
          </button>
        </div>
        <IconButton
          type="button"
          title="Próximo mês"
          onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
        >
          <ChevronRight size={18} />
        </IconButton>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((weekday) => (
          <span key={weekday} className="py-2">
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const selected = isSameDay(day, value);
          const today = isSameDay(day, new Date());
          return (
            <button
              type="button"
              key={day.toISOString()}
              aria-label={format(day, "dd 'de' MMMM 'de' yyyy", {
                locale: ptBR,
              })}
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
              {today && !selected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-blue-600" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <CalendarDays size={16} className="text-blue-600" aria-hidden />
        <span className="capitalize">
          Selecionado: {format(value, "dd/MM/yyyy")}
        </span>
      </div>
    </div>
  );
}
