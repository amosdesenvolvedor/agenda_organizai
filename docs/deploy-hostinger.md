# Deploy na Hostinger

## VPS

1. Instale Node.js 18+, MySQL 8 e Nginx.
2. Aponte o dominio para a VPS.
3. Crie o banco com `database/init.sql`.
4. Configure `backend/.env`.
5. Execute:

```bash
npm install
npm run build
npm run prisma:migrate --workspace backend
npm run db:seed
```

6. Rode `backend/dist/server.js` com PM2 ou systemd.
7. Sirva `frontend/dist` pelo Nginx.
8. Configure proxy reverso `/api`, `/health` e `/docs` para a porta da API.

## Hospedagem compartilhada com Node.js

1. Envie o projeto para o gerenciador de arquivos ou Git da Hostinger.
2. Configure o app Node.js apontando para `backend/dist/server.js`.
3. Configure as variaveis de ambiente no painel ou em `backend/.env`.
4. Publique `frontend/dist` em `public_html`.
5. Garanta que `VITE_API_URL` aponte para a URL publica da API antes do build.

## Checklist

- `NODE_ENV=production`
- HTTPS ativo
- Segredos JWT fortes
- SMTP real configurado
- MySQL com usuario sem permissao global
- Porta do MySQL/MariaDB conferida no `DATABASE_URL`
- Backups do banco habilitados
- Pasta `uploads` fora de listagem publica
