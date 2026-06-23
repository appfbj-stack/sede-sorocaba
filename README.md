# Kairos Base

Base padrão (template) para criar novos apps Kairós. Contém apenas os
módulos centrais que toda aplicação precisa — autenticação, painel
administrativo, licenciamento e segurança — sem nenhuma regra de negócio
específica. Para criar um novo app (Kairós Igreja, Kairós Barbearia,
Kairós Energia Solar, etc.), clone este repositório e adicione os módulos
específicos do novo app sem alterar o núcleo.

## Princípios

- **Independência total**: cada app clonado a partir desta base tem seu
  próprio repositório, seu próprio banco de dados, seu próprio deploy no
  Dokploy e suas próprias variáveis de ambiente. Não há acoplamento entre
  apps.
- **Licenciamento autocontido**: cada instância tem sua própria licença
  (`status`: `teste` / `ativo` / `suspenso` / `expirado`), sem dependência
  de um serviço externo.
- **Zero dados de negócio**: o banco desta base só tem as tabelas
  centrais (tenant, usuários, sessões, licença, logs). Nenhuma tabela ou
  regra específica de um app fica aqui.

## Arquitetura

```
backend/    FastAPI + SQLAlchemy + JWT (Python 3.11)
frontend/   React 19 + Vite + Tailwind v4 (PWA)
```

### Módulos centrais (não remover ao clonar)

| Módulo | Descrição |
|---|---|
| Autenticação | Login por e-mail/senha (padrão) e Google OAuth2 (opcional), recuperação de senha por e-mail, logout com revogação de sessão (`Sessao`), `/auth/me` |
| Administração | Dashboard, gestão de usuários, configurações do tenant, logs de atividade — restrito a `admin`/`master` |
| Licenciamento | Período de teste automático, ativação/bloqueio, expiração, status — restrito a `master` |
| Segurança | Rotas protegidas por JWT + verificação de sessão ativa, controle de papéis (`master`/`admin`/`cliente`), logs de auditoria, separação entre área do cliente e área master |
| Banco de dados | Migrações organizadas, schema isolado por app (`DATABASE_SCHEMA`), sem dados de exemplo de negócio |

### Modelo de dados

- `Tenant` — a empresa/cliente que usa esta instância do app (uma linha
  por deploy; isso não é multi-tenant dentro do mesmo banco, é um app por
  cliente).
- `Usuario` — `perfil` em `master` (controle total do sistema e da
  licença), `admin` (gestão operacional do tenant) ou `cliente` (área do
  cliente).
- `Sessao` — JWT ativos, permite logout real (revogação) mesmo com JWT
  stateless.
- `PasswordResetToken` — tokens de recuperação de senha, hash + expiração
  de 1h, uso único.
- `Licenca` — um registro por tenant, com status e validade.
- `LogAtividade` — trilha de auditoria das ações administrativas.

### Papéis e áreas

- **Área do cliente** (`/dashboard`, `/perfil`): qualquer usuário
  autenticado.
- **Área administrativa** (`/admin/*`): `admin` e `master`.
- **Área master** (`/master/*`, oculta para clientes): apenas `master` —
  gestão de licença e do sistema.

## Desenvolvimento local

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
ADMIN_EMAIL=admin@exemplo.com ADMIN_PASSWORD=trocar-senha uvicorn app.main:app --reload

# Testes
pytest

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
npm run lint
```

O frontend usa URLs relativas (`/api/...`) e, em desenvolvimento, o Vite
faz proxy de `/api` e `/uploads` para `http://localhost:8000` (ver
`vite.config.js`). Em produção, é o Nginx do container do frontend que
faz esse proxy para o serviço `backend` (ver `nginx.conf`).

## Deploy (Dokploy)

Cada app clonado desta base é um deploy **independente** no Dokploy, com
seu próprio banco Postgres (serviço `postgres` no `docker-compose.yml`),
suas próprias variáveis de ambiente e seus próprios domínios.

1. Crie um novo repositório a partir desta base (clone, não fork
   compartilhado) para cada novo app.
2. No Dokploy, crie um projeto Docker Compose apontando para o novo
   repositório, com **Compose Path** = `docker-compose.yml`.
3. Configure as variáveis de ambiente (aba Environment) usando
   `.env.example` como referência. Cada app define seu próprio
   `POSTGRES_PASSWORD`, `SECRET_KEY`, `DATABASE_SCHEMA`, `TENANT_NOME`,
   `TENANT_SLUG`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` e, se for usar login
   Google, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`.
4. Ajuste `BACKEND_PORT`/`FRONTEND_PORT` se for publicar portas
   diretamente (em geral o Dokploy expõe via domínio/Traefik e isso não é
   necessário).
5. Deploy. Confirme no log do backend a criação do tenant, do usuário
   master e da licença de teste (`✅ Licença: status=teste ...`).
6. Na aba **Domains**, registre os domínios apontando para os serviços do
   compose: domínio principal → `frontend` porta `80`; `api.<domínio>` →
   `backend` porta `8000` (se a API for exposta em subdomínio separado).

## Como criar um novo app a partir desta base

1. Clone este repositório para um novo repositório (um por app).
2. Atualize `APP_NAME`/`APP_SLUG` em `backend/app/core/config.py` e o
   `name`/título em `frontend/package.json` e `frontend/index.html`.
3. Adicione os módulos de negócio do novo app (models, rotas, páginas)
   sem alterar os módulos centrais listados acima.
4. Gere migrações/tabelas específicas do novo app — nunca misture com as
   tabelas centrais.
5. Rode os testes do backend (`pytest`) e o lint/build do frontend
   (`npm run lint`, `npm run build`) antes de cada deploy.

## Uploads

Arquivos enviados pelos módulos de negócio são salvos em `/app/uploads`
dentro do container do backend e servidos em `/uploads/...`. O volume
`uploads_data` no `docker-compose.yml` garante que persistam entre
deploys.
