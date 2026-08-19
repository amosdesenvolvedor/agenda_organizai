import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AUTH_EXPIRED_EVENT, api, authApi, clearSession, getStoredUser, storeSession } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PublicTaskSharePage } from "./pages/PublicTaskSharePage";

const queryClient = new QueryClient();

export function App() {
  const [taskShareToken, setTaskShareToken] = useState(() => new URLSearchParams(window.location.search).get("taskShare"));
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem("agenda_organizai_token") && getStoredUser()));
  const [oauthLoading, setOauthLoading] = useState(Boolean(new URLSearchParams(window.location.search).get("oauthCode")));

  function logout() {
    clearSession();
    queryClient.clear();
    setAuthenticated(false);
  }

  function finishAuthentication() {
    setAuthenticated(true);
    const inviteToken = sessionStorage.getItem("agenda_network_invite");
    if (inviteToken) {
      api(`/api/users/invites/${encodeURIComponent(inviteToken)}/accept`, { method: "POST" })
        .then(() => sessionStorage.removeItem("agenda_network_invite"))
        .catch(() => undefined);
    }
    const returnToken = sessionStorage.getItem("agenda_task_share_return");
    if (returnToken) {
      sessionStorage.removeItem("agenda_task_share_return");
      setTaskShareToken(null);
      window.history.replaceState({}, "", "/");
    }
  }

  useEffect(() => {
    const inviteToken = new URLSearchParams(window.location.search).get("invite");
    if (!inviteToken) return;
    sessionStorage.setItem("agenda_network_invite", inviteToken);
    if (authenticated) {
      api(`/api/users/invites/${encodeURIComponent(inviteToken)}/accept`, { method: "POST" })
        .then(() => { sessionStorage.removeItem("agenda_network_invite"); window.history.replaceState({}, "", "/"); })
        .catch(() => undefined);
    }
  }, [authenticated]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("organizationInvite");
    if (token) sessionStorage.setItem("agenda_organization_invite", token);
  }, []);

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("oauthCode");
    if (!code) return;
    params.delete("oauthCode");
    window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    authApi.exchangeOAuthCode(code)
      .then((session) => { storeSession(session); finishAuthentication(); })
      .catch(() => {
        const next = new URLSearchParams(window.location.search);
        next.set("oauthError", "Não foi possível concluir o acesso social. Tente novamente.");
        window.history.replaceState({}, "", `${window.location.pathname}?${next}`);
      })
      .finally(() => setOauthLoading(false));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {taskShareToken
        ? <PublicTaskSharePage token={taskShareToken} onEnter={(provider) => {
          sessionStorage.setItem("agenda_task_share_return", taskShareToken);
          if (provider === "google") window.location.assign("/api/auth/oauth/google");
          else if (provider === "microsoft") window.location.assign("/api/auth/oauth/microsoft");
          else { setTaskShareToken(null); window.history.replaceState({}, "", "/"); }
        }} />
        : oauthLoading
        ? <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-600">Concluindo acesso seguro...</main>
        : authenticated ? <DashboardPage onLogout={logout} /> : <AuthPage onAuthenticated={finishAuthentication} />}
    </QueryClientProvider>
  );
}
