# Implantação em VM Ubuntu

Os scripts são separados e devem ser executados um por vez, na ordem numérica. Eles assumem Ubuntu 22.04/24.04, domínio apontável para a VM e execução a partir da raiz de um clone deste repositório.

## Antes de começar

1. Aponte um registro DNS `A` do domínio para o IP público da VM.
2. Libere as portas TCP 22, 80 e 443 no firewall da nuvem.
3. Conecte por SSH e clone o repositório.
4. Crie a configuração privada:

```bash
cp scripts/deploy-vm/deploy.env.example scripts/deploy-vm/deploy.env
nano scripts/deploy-vm/deploy.env
chmod 600 scripts/deploy-vm/deploy.env
```

Gere segredos diferentes com `openssl rand -hex 48`. Não envie `deploy.env`, `.env` ou chaves privadas ao GitHub.

## Ordem de execução

Rode um comando, confira a mensagem final e somente então avance:

```bash
bash scripts/deploy-vm/00-verificar.sh
sudo bash scripts/deploy-vm/01-pacotes.sh
sudo bash scripts/deploy-vm/02-nodejs.sh
sudo bash scripts/deploy-vm/03-banco.sh
sudo bash scripts/deploy-vm/04-aplicacao.sh
sudo bash scripts/deploy-vm/05-ambiente.sh
sudo bash scripts/deploy-vm/06-build.sh
sudo bash scripts/deploy-vm/07-migracoes.sh
sudo bash scripts/deploy-vm/08-servico.sh
sudo bash scripts/deploy-vm/09-nginx.sh
sudo bash scripts/deploy-vm/10-https.sh
bash scripts/deploy-vm/11-verificar.sh
```

O seed cria credenciais conhecidas e, por segurança, não faz parte da sequência automática. Se a base estiver vazia e você realmente quiser os dados iniciais:

```bash
sudo -u agenda bash -lc 'cd /opt/agenda-organizai && npm run db:seed'
```

Troque imediatamente a senha do administrador criado pelo seed.

## Atualizações futuras

No clone usado para implantação, faça `git pull` e depois:

```bash
sudo bash scripts/deploy-vm/atualizar.sh
```

## Diagnóstico

```bash
sudo systemctl status agenda-organizai
sudo journalctl -u agenda-organizai -n 100 --no-pager
sudo nginx -t
curl http://127.0.0.1:4000/health
```

O frontend usa a mesma origem do backend. O Nginx entrega o React e encaminha `/api`, `/health` e `/docs` para a API na porta interna configurada.
