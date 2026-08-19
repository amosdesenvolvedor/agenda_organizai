const API_URL = import.meta.env.VITE_API_URL ?? "";

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
};

export type EventItem = {
  id: string;
  createdById: string;
  title: string;
  startsAt: string;
  endsAt: string;
  color?: string;
  status: string;
  priority: string;
  location?: string;
  link?: string;
  teamId?: string;
  team?: { id: string; name: string };
  description?: string;
  feedback?: string;
  discussionTopics?: string;
  completedAt?: string;
  attendees?: Array<{ id: string; userId?: string; email?: string; name?: string; status: string }>;
};

export type CalendarItem = {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  categories?: Array<{ id: string; name: string; color: string }>;
};

function getToken() {
  return localStorage.getItem("agenda_organizai_token");
}

function getRefreshToken() {
  return localStorage.getItem("agenda_organizai_refresh_token");
}

export const AUTH_EXPIRED_EVENT = "agenda-organizai:auth-expired";

export function clearSession() {
  localStorage.removeItem("agenda_organizai_token");
  localStorage.removeItem("agenda_organizai_refresh_token");
  localStorage.removeItem("agenda_organizai_user");
}

export function storeSession(session: LoginResponse) {
  localStorage.setItem("agenda_organizai_token", session.accessToken);
  localStorage.setItem("agenda_organizai_refresh_token", session.refreshToken);
  localStorage.setItem("agenda_organizai_user", JSON.stringify(session.user));
}

export function getStoredUser() {
  const raw = localStorage.getItem("agenda_organizai_user");
  return raw ? (JSON.parse(raw) as LoginResponse["user"]) : null;
}

export function updateStoredUser(user: Partial<LoginResponse["user"]>) {
  const current = getStoredUser();
  if (current) localStorage.setItem("agenda_organizai_user", JSON.stringify({ ...current, ...user }));
}

let refreshPromise: Promise<string | null> | null = null;

async function renewAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });

  if (!response.ok) return null;
  const session = await response.json() as { accessToken: string };
  localStorage.setItem("agenda_organizai_token", session.accessToken);
  return session.accessToken;
}

function request(path: string, init: RequestInit, token: string | null) {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await request(path, init, getToken());

  if (response.status === 401 && !path.startsWith("/api/auth/")) {
    refreshPromise ??= renewAccessToken().finally(() => {
      refreshPromise = null;
    });
    const renewedToken = await refreshPromise;

    if (renewedToken) {
      response = await request(path, init, renewedToken);
    } else {
      clearSession();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro inesperado." }));
    throw new Error(error.message ?? "Erro inesperado.");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function authenticatedRaw(path: string, init: RequestInit) {
  const send = (token: string | null) => fetch(`${API_URL}${path}`, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  let response = await send(getToken());
  if (response.status === 401) {
    const renewedToken = await renewAccessToken();
    if (renewedToken) response = await send(renewedToken);
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro inesperado." }));
    throw new Error(error.message ?? "Erro inesperado.");
  }
  return response;
}

export async function apiForm<T>(path: string, formData: FormData): Promise<T> {
  const response = await authenticatedRaw(path, { method: "POST", body: formData });
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string) {
  const response = await authenticatedRaw(path, { method: "GET" });
  return response.blob();
}

export const authApi = {
  login: (email: string, password: string, remember: boolean) =>
    api<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, remember })
    }),
  register: (name: string, email: string, password: string) =>
    api<{ user: LoginResponse["user"] }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password })
    }),
  forgotPassword: (email: string) => api<{ message: string }>("/api/auth/forgot-password", {
    method: "POST", body: JSON.stringify({ email })
  }),
  resetPassword: (token: string, password: string) => api<{ message: string }>("/api/auth/reset-password", {
    method: "POST", body: JSON.stringify({ token, password })
  }),
  exchangeOAuthCode: (code: string) => api<LoginResponse>("/api/auth/oauth/exchange", {
    method: "POST", body: JSON.stringify({ code })
  })
};
