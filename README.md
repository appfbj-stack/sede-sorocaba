# Kairos Sede Sorocaba

App **Kairos Pro** de gestão eclesiástica para a OBPC Sorocaba Sede:
membros, obreiros, carteirinhas, patrimônio, batismos e agenda das
congregações, com login via Google e licenciamento integrado ao Kairos
Admin.

Migrado do app original [sede-sorocaba](https://github.com/appfbj-stack/sede-sorocaba)
(Node/Express/SQLite) para o `docs/TEMPLATE_PRO.md` do ecossistema Kairos:
FastAPI + PostgreSQL no backend, Vite + React + Tailwind no frontend
(reaproveitado quase sem alterações), multi-tenant (`Tenant` = igreja
cliente, `Congregacao` = sub-unidade dentro do tenant), JWT e verificação
de licença via Kairos Admin.

## Autenticação

Login exclusivamente via **Google OAuth2** — não há cadastro de senha.
O backend troca o `code` do Google por um perfil (`email`, `nome`, `foto`),
procura um `Usuario` já cadastrado com esse e-mail e, se existir e estiver
ativo, emite um JWT próprio do Kairos. Não há autocadastro: e-mails não
cadastrados são redirecionados para `/acesso-negado`.

## Perfis de usuário

- **sede** — acesso total, a todas as congregações do tenant.
- **pastor** — acesso restrito à própria congregação (`congregacao_id`).

## O que está implementado (Fase 1)

- Login Google + JWT multi-tenant (`/api/auth/google`, `/api/auth/me`)
- CRUD de usuários (`/api/usuarios`) — restrito a `sede`
- Congregações (`/api/congregacoes`)
- Membros (`/api/membros`), com foto, aniversariantes e paginação
- Obreiros (`/api/obreiros`), com categoria e credencial
- Carteirinhas (`/api/carteirinhas`), emissão com QR code e expiração
  automática da carteirinha anterior
- Patrimônio (`/api/patrimonio`), com foto e desativação (soft-delete)
- Agenda (`/api/agenda`) — eventos da congregação
- Batismos (`/api/batismos`), com lista de pendentes
- Dashboard com estatísticas agregadas (`/api/dashboard`)
- Verificação de licença Kairos Admin no startup (fail-open se indisponível)

## Fora do escopo desta versão (Fase 2)

- Sincronização com Google Sheets
- OCR de documentos / importação em massa
- Assistente de IA
- Notificações por e-mail e tarefas agendadas (cron)
- Sincronização de eventos com Google Calendar

## Desenvolvimento local

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
ADMIN_EMAIL=admin@obpcsorocaba.com.br uvicorn app.main:app --reload

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

O frontend usa URLs relativas (`/api/...`) e, em desenvolvimento, o Vite
faz proxy de `/api` e `/uploads` para `http://localhost:8000` (ver
`vite.config.js`). Em produção, é o Nginx do container do frontend que
faz esse proxy para o serviço `backend` (ver `nginx.conf`).

## Deploy na VPS (Dokploy)

1. Crie o repositório no GitHub e suba este diretório
   (`kairos-sede-sorocaba/`) como raiz do repositório, ou aponte o Dokploy
   para este monorepo com **Build Path** = `kairos-sede-sorocaba`.
2. No Kairos Admin (**Aplicativos**), registre o app:
   - Nome: `Kairos Sede Sorocaba`
   - Slug: `sede-sorocaba`
   - Plano: **Pro**
3. Em **Clientes**, crie (ou selecione) o cliente que vai usar o app e, em
   **Licenças**, crie uma licença para esse cliente + app. Copie o
   `client_id` (UUID) gerado.
4. No Dokploy, crie um novo projeto do tipo Docker Compose apontando para
   este repositório/diretório, com **Compose Path** = `docker-compose.yml`.
5. Configure as variáveis de ambiente (aba Environment), usando
   `.env.example` como referência:
   ```
   POSTGRES_PASSWORD=...
   SECRET_KEY=...
   KAIROS_ADMIN_URL=https://api.admin.fbautomacao.space
   KAIROS_CLIENT_ID=<uuid copiado no passo 3>
   ADMIN_EMAIL=admin@obpcsorocaba.com.br
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=https://api.sede.fbautomacao.space/api/auth/google/callback
   FRONTEND_URL=https://sede.fbautomacao.space
   ```
6. No [Google Cloud Console](https://console.cloud.google.com/), nas
   credenciais OAuth2 do app, adicione exatamente essa mesma URI de
   `GOOGLE_REDIRECT_URI` em "URIs de redirecionamento autorizados".
7. Confirme que a rede externa `kairos_network` existe na VPS
   (`docker network create kairos_network` se ainda não existir).
8. Deploy. As portas reservadas para este app são `8010` (backend) e
   `3020` (frontend) — ver `docs/APPS_REGISTRADOS.md` na raiz do
   ecossistema antes de mudar, para não colidir com outro app já
   registrado.
9. Na aba **Domains** do recurso (Dokploy), registre os dois domínios
   apontando para os serviços do compose:
   - `sede.fbautomacao.space` → serviço `frontend`, porta `80`
   - `api.sede.fbautomacao.space` → serviço `backend`, porta `8000`
10. Teste o login em `https://sede.fbautomacao.space` com uma conta Google
    cujo e-mail seja igual ao `ADMIN_EMAIL` configurado, e confirme no log
    do backend que a licença foi validada (`✅ Licença Kairos: ...`).

## Uploads

Fotos de membros e patrimônio são salvas em `/app/uploads` dentro do
container do backend e servidas em `/uploads/...`. O volume `uploads_data`
no `docker-compose.yml` garante que essas fotos persistam entre deploys.
