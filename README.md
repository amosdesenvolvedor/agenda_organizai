# Agenda OrganizaÍ

Agenda OrganizaÍ é uma aplicação web de calendário, tarefas, lembretes, equipes, notificações e auditoria.

## Stack

- Frontend: React, Vite, TypeScript, TailwindCSS, React Query, React Hook Form, Zod, Lucide
- Backend: Node.js, Express, TypeScript
- Banco: MySQL com Prisma
- Seguranca: JWT, bcrypt, Helmet, CORS, rate limit, validacao Zod
- Docs: Swagger em `/docs`

## Estrutura

```text
frontend/   Aplicacao React
backend/    API Express e Prisma
database/   SQL inicial do MySQL
docs/       Documentacao de deploy
scripts/    Scripts operacionais
uploads/    Arquivos enviados pela aplicacao
```

## Desenvolvimento local

1. Copie `backend/.env.example` para `backend/.env` e ajuste `DATABASE_URL` e os segredos JWT.
2. Configure o MariaDB da Agenda na porta `3307` se a porta `3306` ja estiver ocupada.
3. Crie o banco MySQL/MariaDB usando `database/init.sql`.
4. Instale dependencias:

```bash
npm install
```

5. Gere o cliente Prisma e aplique migrations:

```bash
npm run prisma:generate --workspace backend
npm run prisma:dev --workspace backend
```

6. Rode seed:

```bash
npm run db:seed
```

7. Inicie frontend e backend:

```bash
npm run dev
```

Credenciais do seed:

- Email: `admin@agendaorganizai.local`
- Senha: `AgendaOrganizai@123`

O comando `npm run devok` aplica as migrations versionadas, executa o seed do
administrador e inicia backend e frontend, nessa ordem.

## Módulo de tarefas

O cadastro principal de tarefas possui informações gerais, agenda e categoria,
datas e horários, prioridades (incluindo crítica), status operacionais,
privacidade, progresso manual ou automático e salvamento como rascunho. Criador
e administradores podem editar e compartilhar; responsáveis possuem leitura.

## E-mail transacional

O backend utiliza Resend com fila persistida, histórico de tentativas e retry
automático. Configure `EMAIL_PROVIDER`, `RESEND_API_KEY` e `MAIL_FROM` no
`backend/.env`. Administradores podem enfileirar um teste por
`POST /api/admin/email/test` informando `{ "email": "destino@dominio.com" }`.

## Recuperação de senha

Na tela de login, **Esqueci minha senha** envia pelo Resend um link de uso único,
válido por 30 minutos. A API não revela se o e-mail está cadastrado. Depois da
troca de senha, todas as sessões anteriores do usuário são revogadas.

## Producao

```bash
npm run build
npm run db:migrate
npm run start --workspace backend
```

Para hospedagem compartilhada, publique `frontend/dist` como site estatico e rode a API Node no ambiente Node.js da Hostinger apontando para `backend/dist/server.js`.

## Variaveis essenciais

Veja `backend/.env.example`. Para build separado do frontend, crie `frontend/.env` a partir de `frontend/.env.example`.

Os segredos `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` devem ter pelo menos 32 caracteres e valores diferentes.
