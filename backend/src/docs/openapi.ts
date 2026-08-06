export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Agenda OrganizaÍ API",
    version: "0.1.0",
    description: "API REST para calendario, produtividade, equipes e auditoria."
  },
  servers: [{ url: "/api" }],
  paths: {
    "/auth/register": {
      post: { summary: "Criar usuario", tags: ["Auth"] }
    },
    "/auth/login": {
      post: { summary: "Autenticar usuario", tags: ["Auth"] }
    },
    "/auth/forgot-password": {
      post: { summary: "Solicitar link de recuperacao de senha por e-mail", tags: ["Auth", "Email"] }
    },
    "/auth/reset-password": {
      post: { summary: "Redefinir senha com token temporario", tags: ["Auth"] }
    },
    "/auth/me": {
      get: { summary: "Usuario atual", tags: ["Auth"] }
    },
    "/calendars": {
      get: { summary: "Listar agendas", tags: ["Calendars"] }
    },
    "/events": {
      get: { summary: "Listar eventos", tags: ["Events"] },
      post: { summary: "Criar evento", tags: ["Events"] }
    },
    "/tasks": {
      get: { summary: "Listar tarefas visíveis ao usuário", tags: ["Tasks"] },
      post: { summary: "Cadastrar tarefa", tags: ["Tasks"] }
    },
    "/tasks/{id}": {
      patch: { summary: "Editar tarefa como criador ou administrador", tags: ["Tasks"] },
      delete: { summary: "Excluir tarefa como criador ou administrador", tags: ["Tasks"] }
    },
    "/tasks/{id}/share": {
      post: { summary: "Compartilhar e atribuir tarefa", tags: ["Tasks"] }
    },
    "/notifications": {
      get: { summary: "Listar notificacoes", tags: ["Notifications"] }
    },
    "/attachments/events/{eventId}": {
      post: { summary: "Enviar anexo para evento", tags: ["Attachments"] }
    },
    "/admin/email/test": {
      post: { summary: "Enfileirar e-mail de teste do provedor configurado", tags: ["Admin", "Email"] }
    }
  }
};
