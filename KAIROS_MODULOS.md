# Integração com Sistema de Módulos Kairos Admin

O Kairos Admin expõe um sistema de **módulos ativáveis/desativáveis por empresa** (multi-tenant granular). Este documento descreve como o app sede-sorocaba se integra a esse sistema.

## Conceito

Cada funcionalidade do app (Membros, Obreiros, Carteirinhas, etc.) é tratada como um **módulo**. O SUPER_ADMIN do Kairos Admin pode:

1. **Ativar/desativar um módulo globalmente** (`PATCH /api/core/modules/:id`)
2. **Ativar/desativar para uma empresa específica** (`POST /api/core/modules/empresas/:empresaId/:moduleId`)

O app sede-sorocaba deve **consultar quais módulos estão ativos** e adaptar a UI e as rotas do backend.

## Módulos Configurados para OBPC Sorocaba

Todos os 9 módulos do sede-sorocaba já estão **ativos**:

| Módulo | Slug | Status |
|---|---|---|
| Agenda | `agenda` | ✅ Ativo |
| Batismos | `batismos` | ✅ Ativo |
| Carteirinhas | `carteirinhas` | ✅ Ativo |
| Congregações | `congregacoes` | ✅ Ativo |
| Dashboard | `dashboard` | ✅ Ativo |
| Membros | `membros` | ✅ Ativo |
| Obreiros | `obreiros` | ✅ Ativo |
| Patrimônio | `patrimonio` | ✅ Ativo |
| Usuários | `usuarios` | ✅ Ativo |

## Como Consultar (Frontend)

```typescript
// hooks/useModules.ts
async function fetchActiveModules(empresaId: string) {
  const token = localStorage.getItem("kairos_token");
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_KAIROS_ADMIN_URL}/api/core/modules/empresas/${empresaId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const modules = await res.json();
  return modules.filter((m: any) => m.active).map((m: any) => m.slug);
}
```

## Como Respeitar no Backend (opcional)

Cada rota do backend do sede-sorocaba pode verificar se o módulo correspondente está ativo para a empresa:

```python
# middleware/module_check.py
async def check_module(empresa_id: str, module_slug: str):
    async with httpx.AsyncClient() as client:
        res = await client.get(
            f"{settings.KAIROS_ADMIN_URL}/api/core/modules/empresas/{empresa_id}",
            headers={"Authorization": f"Bearer {get_admin_token()}"}
        )
        modules = res.json()
        return any(m["slug"] == module_slug and m["active"] for m in modules)
```

Se `check_module` retornar `False`, a rota retorna `403 Forbidden`.

## Endpoints Disponíveis

| Método | Rota | Permissão | Descrição |
|---|---|---|---|
| `POST` | `/api/core/users/auth/login` | pública | Login → JWT |
| `GET` | `/api/core/modules` | autenticado | Lista catálogo |
| `POST` | `/api/core/modules` | SUPER_ADMIN | Criar módulo |
| `PATCH` | `/api/core/modules/:id` | SUPER_ADMIN | Ativar/desativar global |
| `GET` | `/api/core/modules/empresas/:empresaId` | autenticado | Lista módulos ativos da empresa |
| `POST` | `/api/core/modules/empresas/:empresaId/:moduleId` | SUPER_ADMIN | Ativar/desativar para empresa |

## Estado Atual

- **Catálogo**: 9 módulos criados (ver tabela acima)
- **Empresa OBPC Sorocaba**: criada (ID: `8559f7e3-722e-4d7f-9ed6-521f56bbe420`)
- **Módulos ativos para OBPC Sorocaba**: 9/9

## Referências

- `docs/INTEGRACAO_SEDE_SOROCABA.md` (na raiz do monorepo Kairos) — visão geral da integração
- `docs/APPS_REGISTRADOS.md` — apps do ecossistema
- `docs/ARQUITETURA_OFICIAL.md` — arquitetura multi-tenant
