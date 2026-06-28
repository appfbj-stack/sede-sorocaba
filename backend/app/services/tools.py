from __future__ import annotations
from dataclasses import dataclass, field
from typing import Callable
from sqlalchemy.orm import Session

@dataclass
class ToolContext:
    db: Session
    tenant_id: int
    usuario_id: str
    perfil: str

@dataclass
class Tool:
    name: str
    description: str
    parameters: dict
    handler: Callable[[dict, ToolContext], str]
    areas: list[str] = field(default_factory=list)

    def to_openai_def(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

_REGISTRY: dict[str, Tool] = {}

def register_tool(tool: Tool) -> None:
    _REGISTRY[tool.name] = tool

def get_tool_defs() -> list[dict]:
    return [t.to_openai_def() for t in _REGISTRY.values()]

def execute_tool(name: str, args: dict, ctx: ToolContext) -> str:
    tool = _REGISTRY.get(name)
    if not tool:
        return f"[erro: ferramenta '{name}' nao existe]"
    try:
        return tool.handler(args or {}, ctx)
    except Exception as e:
        return f"[erro ao executar '{name}': {e}]"

def _buscar_em_documentos(args: dict, ctx: ToolContext) -> str:
    from app.services.rag import search_documents_sync
    query = (args.get("consulta") or "").strip()
    if not query:
        return "[erro: informe o que deseja buscar no parametro 'consulta']"
    results = search_documents_sync(query, ctx.tenant_id, ctx.db, limit=4)
    if not results:
        return "Nenhum trecho relevante encontrado nos documentos."
    partes = []
    for r in results:
        partes.append(f"[{r['nome']} | relevancia {r['relevance']}]\n{r['excerpt']}")
    return "\n\n".join(partes)

def _consultar_metricas_uso(args: dict, ctx: ToolContext) -> str:
    from app.models import MetricaIA
    metricas = ctx.db.query(MetricaIA).filter(MetricaIA.tenant_id == ctx.tenant_id).all()
    if not metricas:
        return "Ainda nao ha metricas registradas."
    total_conv = sum(m.total_conversas for m in metricas)
    total_msg = sum(m.total_mensagens for m in metricas)
    total_tok = sum(m.total_tokens for m in metricas)
    horas = round(sum(m.total_time_saved_seconds for m in metricas) / 3600, 1)
    docs = sum(m.total_docs_processed for m in metricas)
    return (
        f"Uso acumulado: {total_conv} conversas, {total_msg} mensagens, "
        f"{total_tok} tokens, {docs} documentos, ~{horas}h economizadas."
    )

register_tool(Tool(
    name="buscar_em_documentos",
    description="Busca trechos nos documentos enviados pelo cliente (contratos, arquivos). Use quando a pergunta puder ser respondida com base em documentos.",
    parameters={
        "type": "object",
        "properties": {
            "consulta": {
                "type": "string",
                "description": "Termos ou pergunta para buscar nos documentos.",
            }
        },
        "required": ["consulta"],
    },
    handler=_buscar_em_documentos,
))

register_tool(Tool(
    name="consultar_metricas_uso",
    description="Retorna metricas de uso: conversas, mensagens, tokens, documentos e tempo economizado.",
    parameters={"type": "object", "properties": {}},
    handler=_consultar_metricas_uso,
))
