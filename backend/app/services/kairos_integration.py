from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass
class KairosToolDef:
    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=lambda: {"type": "object", "properties": {}})


APP_DEFINITION: dict[str, Any] = {
    "slug": "sede-sorocaba",
    "name": "Igreja Sede Sorocaba",
    "description": "Gestão eclesiástica completa — membros, congregações, eventos, obreiros, patrimônio, batismos e carteirinhas",
    "version": "1.0.0",
    "company": "Igreja Evangélica Sede Sorocaba",
    "environment": "production",
    "icon": "Church",
    "primary_color": "#1E40AF",
    "api_url": "https://api.sede.fbautomacao.space",
    "origin_url": "https://sede.fbautomacao.space",
    "context": "Sistema de gestão eclesiástica da Igreja Evangélica Sede Sorocaba",
    "modules": [
        {"key": "membresia", "name": "Membresia", "description": "Cadastro de membros", "module": "membresia"},
        {"key": "congregacoes", "name": "Congregações", "description": "Unidades e congregações", "module": "congregacoes"},
        {"key": "eventos", "name": "Eventos", "description": "Agenda e eventos", "module": "eventos"},
        {"key": "obreiros", "name": "Obreiros", "description": "Credenciais de obreiros", "module": "obreiros"},
        {"key": "patrimonio", "name": "Patrimônio", "description": "Bens e inventário", "module": "patrimonio"},
        {"key": "carteirinhas", "name": "Carteirinhas", "description": "Emissão de carteirinhas", "module": "carteirinhas"},
        {"key": "batismos", "name": "Batismos", "description": "Registro de batismos", "module": "batismos"},
        {"key": "assistente-ia", "name": "Assistente IA", "description": "Chat com IA e documentos", "module": "assistente-ia"},
        {"key": "importacao", "name": "Importação", "description": "Importação de dados", "module": "importacao"},
        {"key": "dashboard", "name": "Dashboard", "description": "Painel de métricas", "module": "dashboard"},
        {"key": "admin", "name": "Administração", "description": "Configurações do sistema", "module": "admin"},
    ],
    "permissions": [
        {"key": "membros:view", "name": "Ver membros", "module": "membresia"},
        {"key": "membros:create", "name": "Criar membros", "module": "membresia"},
        {"key": "membros:edit", "name": "Editar membros", "module": "membresia"},
        {"key": "membros:delete", "name": "Excluir membros", "module": "membresia"},
        {"key": "congregacoes:view", "name": "Ver congregações", "module": "congregacoes"},
        {"key": "congregacoes:edit", "name": "Gerenciar congregações", "module": "congregacoes"},
        {"key": "eventos:view", "name": "Ver eventos", "module": "eventos"},
        {"key": "eventos:create", "name": "Criar eventos", "module": "eventos"},
        {"key": "eventos:edit", "name": "Editar eventos", "module": "eventos"},
        {"key": "obreiros:view", "name": "Ver obreiros", "module": "obreiros"},
        {"key": "obreiros:manage", "name": "Gerenciar obreiros", "module": "obreiros"},
        {"key": "patrimonio:view", "name": "Ver patrimônio", "module": "patrimonio"},
        {"key": "patrimonio:edit", "name": "Gerenciar patrimônio", "module": "patrimonio"},
        {"key": "carteirinhas:issue", "name": "Emitir carteirinhas", "module": "carteirinhas"},
        {"key": "batismos:register", "name": "Registrar batismos", "module": "batismos"},
        {"key": "assistente:chat", "name": "Usar assistente IA", "module": "assistente-ia"},
        {"key": "importacao:run", "name": "Importar dados", "module": "importacao"},
        {"key": "dashboard:view", "name": "Ver dashboard", "module": "dashboard"},
        {"key": "admin:settings", "name": "Configurar sistema", "module": "admin"},
    ],
    "supported_resources": ["voice", "image", "document"],
    "tools": [
        {"name": "buscar_membros", "description": "Busca membros por nome, CPF, cargo ou congregação", "parameters": {"type": "object", "properties": {"termo": {"type": "string"}, "congregacao_id": {"type": "string"}}, "required": ["termo"]}},
        {"name": "listar_eventos", "description": "Lista eventos da agenda por período ou tipo", "parameters": {"type": "object", "properties": {"data_inicio": {"type": "string"}, "data_fim": {"type": "string"}, "tipo": {"type": "string"}}}},
        {"name": "buscar_em_documentos", "description": "Busca trechos nos documentos enviados pelo cliente", "parameters": {"type": "object", "properties": {"consulta": {"type": "string"}}, "required": ["consulta"]}},
        {"name": "consultar_metricas_uso", "description": "Métricas de uso: conversas, mensagens, tokens, documentos", "parameters": {"type": "object", "properties": {}}},
        {"name": "criar_membro", "description": "Cadastra um novo membro no sistema", "parameters": {"type": "object", "properties": {"nome": {"type": "string"}, "cpf": {"type": "string"}, "telefone": {"type": "string"}}, "required": ["nome"]}},
        {"name": "atualizar_membro", "description": "Atualiza dados de um membro existente", "parameters": {"type": "object", "properties": {"membro_id": {"type": "string"}}, "required": ["membro_id"]}},
        {"name": "transferir_membro", "description": "Transfere membro entre congregações", "parameters": {"type": "object", "properties": {"membro_id": {"type": "string"}, "congregacao_destino": {"type": "string"}}, "required": ["membro_id", "congregacao_destino"]}},
    ],
}


TOOLS: list[KairosToolDef] = [
    KairosToolDef(
        name="buscar_membros",
        description="Busca membros por nome, CPF, cargo ou congregação",
        parameters={
            "type": "object",
            "properties": {
                "termo": {"type": "string", "description": "Nome, CPF ou cargo do membro"},
                "congregacao_id": {"type": "string", "description": "Filtrar por congregação"},
            },
            "required": ["termo"],
        },
    ),
    KairosToolDef(
        name="listar_eventos",
        description="Lista eventos da agenda por período ou tipo",
        parameters={
            "type": "object",
            "properties": {
                "data_inicio": {"type": "string", "description": "Data inicial ISO"},
                "data_fim": {"type": "string", "description": "Data final ISO"},
                "tipo": {"type": "string", "description": "Tipo de evento (culto, reuniao, etc)"},
            },
        },
    ),
    KairosToolDef(
        name="buscar_em_documentos",
        description="Busca trechos nos documentos enviados pelo cliente",
        parameters={
            "type": "object",
            "properties": {
                "consulta": {"type": "string", "description": "Termos ou pergunta para buscar"},
            },
            "required": ["consulta"],
        },
    ),
    KairosToolDef(
        name="consultar_metricas_uso",
        description="Métricas de uso: conversas, mensagens, tokens, documentos e tempo economizado",
        parameters={"type": "object", "properties": {}},
    ),
]


class KairosIntegration:
    def __init__(self, admin_url: str, client_id: str, api_key: str = ""):
        self.admin_url = admin_url.rstrip("/")
        self.client_id = client_id
        self.api_key = api_key
        self._http = httpx.AsyncClient(timeout=10)
        self._registered = False

    def _headers(self) -> dict[str, str]:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        if self.client_id:
            h["X-Client-Id"] = self.client_id
        return h

    async def register(self) -> bool:
        if not self.admin_url:
            logger.warning("KAIROS_ADMIN_URL not set — skipping auto-register")
            return False
        try:
            r = await self._http.post(
                f"{self.admin_url}/api/tools/apps/register",
                json=APP_DEFINITION,
                headers=self._headers(),
            )
            if r.status_code in (200, 201):
                self._registered = True
                logger.info("App registered with Kairós: %s", APP_DEFINITION["slug"])
                return True
            if r.status_code == 409:
                logger.info("App already registered: %s", APP_DEFINITION["slug"])
                self._registered = True
                return True
            logger.warning("Register failed (%s): %s", r.status_code, r.text[:200])
            return False
        except httpx.ConnectError:
            logger.warning("Kairós unreachable at %s — will retry on next startup", self.admin_url)
            return False
        except Exception as e:
            logger.exception("Register error: %s", e)
            return False

    async def heartbeat(self) -> bool:
        if not self._registered:
            return False
        try:
            r = await self._http.patch(
                f"{self.admin_url}/api/tools/apps/{APP_DEFINITION['slug']}/heartbeat",
                json={"status": "online", "version": APP_DEFINITION["version"]},
                headers=self._headers(),
                timeout=5,
            )
            return r.status_code == 200
        except Exception:
            return False

    async def send_context(self, payload: dict[str, Any]) -> bool:
        if not self._registered:
            return False
        try:
            r = await self._http.post(
                f"{self.admin_url}/api/apps/context",
                json=payload,
                headers=self._headers(),
            )
            return r.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self._http.aclose()
