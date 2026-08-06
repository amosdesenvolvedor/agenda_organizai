import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AUTH_EXPIRED_EVENT, clearSession, getStoredUser } from "./lib/api";
import { AuthPage } from "./pages/AuthPage";
import { DashboardPage } from "./pages/DashboardPage";

const queryClient = new QueryClient();

export function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem("agenda_organizai_token") && getStoredUser()));

  function logout() {
    clearSession();
    queryClient.clear();
    setAuthenticated(false);
  }

  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, logout);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {authenticated ? <DashboardPage onLogout={logout} /> : <AuthPage onAuthenticated={() => setAuthenticated(true)} />}
    </QueryClientProvider>
  );
}
