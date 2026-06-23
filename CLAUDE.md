# Kairós — guia para o agente

Este repositório é a **Base Kairós**: template para qualquer novo app
"Kairós X" (igreja, barbearia, energia solar, etc.). Ao receber um pedido
para criar/clonar um novo app Kairós, ou para evoluir um app já clonado
desta base, siga este processo. Ver `README.md` para detalhes de
arquitetura e deploy — este arquivo é sobre **como agir**, não o quê é.

## Núcleo vs. módulos de negócio

- **Núcleo (não remover, não redesenhar)**: autenticação (e-mail/senha +
  Google OAuth opcional), sessões revogáveis via JWT (`Sessao`),
  recuperação de senha, licenciamento (`Licenca`), papéis
  `master`/`admin`/`cliente`, logs de auditoria (`LogAtividade`), painel
  admin (usuários, configurações, logs), área master (licença, sistema).
- **Módulos de negócio**: tudo específico do app (congregações/membros
  para uma igreja, clientes/agendamentos para uma barbearia, etc.). Vivem
  ao lado do núcleo, nunca dentro dele. Ao clonar a base para um novo app,
  adicione módulos sem alterar `app/deps.py`, `app/routes/auth.py`,
  `app/routes/usuarios.py`, `app/routes/admin.py`, `app/routes/master.py`.

## Modelo de papéis e isolamento de dados (multi-tenant)

- `Tenant` = uma linha por instância/cliente deployado (não é
  multi-tenant dentro do mesmo banco — é um app por cliente).
- `master`/`admin` = acesso irrestrito a todos os dados do tenant.
- `cliente` = escopo restrito a uma sub-unidade do tenant (ex.:
  congregação, filial, unidade). **Armazene esse vínculo em
  `Usuario.<sub_unidade>_id`** e use o padrão `congregacao_filter` de
  `deps.py` (renomeie conforme o domínio) em toda rota de negócio.

### Armadilha já encontrada (não repetir)

Em uma fase anterior deste projeto, a rota de criação/edição de usuário
(`usuarios.py`) não expunha o campo de vínculo com a sub-unidade. Todo
usuário `cliente` ficava sem esse vínculo, e o filtro de isolamento
("sem vínculo" = "sem filtro") fazia esse usuário ver os dados de
**todas** as sub-unidades — o mesmo acesso de um admin. **Sempre que
clonar este padrão**: confirme que a criação de usuário `cliente` exige
e persiste o vínculo com a sub-unidade, valide contra o tenant atual, e
escreva um teste de separação de dados (dois clientes em sub-unidades
diferentes, cada um só vê os próprios dados) antes de considerar o
módulo pronto.

## Checklist ao criar/evoluir um app a partir desta base

1. Não recrie o projeto, não troque tecnologias (FastAPI + SQLAlchemy +
   JWT no backend; React + Vite + Tailwind + PWA no frontend), não
   remova funcionalidades do núcleo, não altere o banco sem necessidade.
2. Modele as tabelas de negócio sempre com `tenant_id` e, se houver
   sub-unidades, `<sub_unidade>_id` — siga o padrão de `models.py`.
3. Toda rota de listagem/leitura/escrita de negócio recebe
   `cong_filtro: Optional[str] = Depends(congregacao_filter)` (ou
   equivalente renomeado) e filtra por ele quando não for `None`.
4. Ações administrativas relevantes (criar/editar/remover
   congregação/sub-unidade, usuários, configurações) chamam
   `log_activity(...)` — é o padrão de auditoria já estabelecido.
5. Testes obrigatórios antes de considerar pronto para produção:
   login (sucesso/falha), criação de usuário, criação de
   sub-unidade/tenant-filho, permissões por papel (`cliente` não acessa
   rotas admin/master), e **separação de dados** entre sub-unidades.
6. Rode `pytest` (backend) e `npm run lint && npm run build` (frontend)
   antes de qualquer push — build deve confirmar a geração do PWA
   (`manifest.webmanifest`, `sw.js`, `workbox-*.js`).
7. Deploy é via Dokploy + `docker-compose.yml` (Postgres com schema por
   app) — variáveis em `.env.example`. Não há infra compartilhada entre
   apps clonados desta base.

## Pendências conhecidas, deixadas como backlog (não implementar sem pedido explícito)

- Backup automático do banco (`/backups`).
- Rate limiting / bloqueio por tentativas de login (proteção a força
  bruta) — exigiria nova dependência ou coluna no banco; avaliar caso a
  caso conforme exposição do app.

## Fluxo de PR

Trabalhe na branch indicada pela tarefa, valide tudo (testes + lint +
build), comite, abra/atualize a PR como draft, e só marque como pronta
para revisão e mescle quando o usuário confirmar explicitamente.
