from __future__ import annotations
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Callable

from sqlalchemy.orm import Session
from app.utils import new_id, parse_date

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

def _validar_cpf(cpf: str) -> str:
    cpf = re.sub(r"\D", "", cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return "invalido"
    for i in range(9, 11):
        soma = sum(int(cpf[j]) * (i + 1 - j) for j in range(i))
        dig = (soma * 10 % 11) % 11
        if int(cpf[i]) != dig:
            return "invalido"
    return "valido"

def _validar_telefone(telefone: str) -> str:
    nums = re.sub(r"\D", "", telefone)
    if len(nums) < 10 or len(nums) > 13:
        return "invalido"
    if len(nums) == 11 and nums[2] not in ("9", "8"):
        return "formato_incomum"
    return "valido"

def _buscar_membro(args: dict, ctx: ToolContext) -> str:
    from app.models import Membro
    termo = (args.get("nome") or args.get("termo") or "").strip()
    cpf = (args.get("cpf") or "").strip()
    q = ctx.db.query(Membro).filter(Membro.tenant_id == ctx.tenant_id)
    if cpf:
        q = q.filter(Membro.cpf == cpf)
    elif termo:
        q = q.filter(Membro.nome.ilike(f"%{termo}%"))
    else:
        return "[erro: informe nome ou CPF para buscar]"
    membros = q.order_by(Membro.nome).limit(10).all()
    if not membros:
        return "Nenhum membro encontrado."
    linhas = []
    for m in membros:
        linhas.append(
            f"- {m.nome} | CPF: {m.cpf or '-'} | Tel: {m.telefone or '-'} | "
            f"Status: {m.status} | Nasc: {m.data_nascimento or '-'} | ID: {m.id}"
        )
    return "Membros encontrados:\n" + "\n".join(linhas)

def _criar_membro(args: dict, ctx: ToolContext) -> str:
    from app.models import Membro, Congregacao
    nome = (args.get("nome") or "").strip()
    if not nome:
        return "[erro: nome é obrigatório]"
    cong_id = args.get("congregacao_id") or ""
    if not cong_id:
        sede = ctx.db.query(Congregacao).filter(
            Congregacao.tenant_id == ctx.tenant_id,
            Congregacao.nome.ilike("%sede%"),
        ).first()
        if sede:
            cong_id = sede.id
        else:
            return "[erro: informe congregacao_id]"
    cpf = re.sub(r"\D", "", (args.get("cpf") or ""))
    if cpf:
        existente = ctx.db.query(Membro).filter(
            Membro.tenant_id == ctx.tenant_id,
            Membro.cpf == cpf,
        ).first()
        if existente:
            return f"[duplicado] Já existe membro com CPF {cpf}: {existente.nome} (ID: {existente.id})"
    membro = Membro(
        id=new_id(),
        tenant_id=ctx.tenant_id,
        congregacao_id=cong_id,
        nome=nome,
        cpf=cpf or None,
        rg=(args.get("rg") or "").strip() or None,
        data_nascimento=parse_date(args.get("data_nascimento")),
        telefone=(args.get("telefone") or "").strip() or None,
        whatsapp=(args.get("whatsapp") or "").strip() or None,
        endereco=(args.get("endereco") or "").strip() or None,
        estado_civil=(args.get("estado_civil") or "").strip() or None,
        data_conversao=parse_date(args.get("data_conversao")),
        data_batismo=parse_date(args.get("data_batismo")),
        cargo=(args.get("cargo") or "").strip() or None,
        status=(args.get("status") or "ativo").strip(),
        observacoes=(args.get("observacoes") or "").strip() or None,
    )
    ctx.db.add(membro)
    ctx.db.commit()
    return f"Membro '{nome}' cadastrado com sucesso! ID: {membro.id}"

def _atualizar_membro(args: dict, ctx: ToolContext) -> str:
    from app.models import Membro
    membro_id = (args.get("membro_id") or "").strip()
    if not membro_id:
        return "[erro: informe membro_id]"
    membro = ctx.db.query(Membro).filter(
        Membro.id == membro_id,
        Membro.tenant_id == ctx.tenant_id,
    ).first()
    if not membro:
        return "[erro: membro não encontrado]"
    updates = {
        "nome": "nome",
        "cpf": "cpf",
        "rg": "rg",
        "telefone": "telefone",
        "whatsapp": "whatsapp",
        "endereco": "endereco",
        "estado_civil": "estado_civil",
        "cargo": "cargo",
        "status": "status",
        "observacoes": "observacoes",
        "congregacao_id": "congregacao_id",
        "data_nascimento": "data_nascimento",
        "data_conversao": "data_conversao",
        "data_batismo": "data_batismo",
    }
    alterados = []
    for campo, attr in updates.items():
        val = args.get(campo)
        if val is not None:
            if campo.startswith("data_"):
                parsed = parse_date(val)
                if parsed:
                    setattr(membro, attr, parsed)
                    alterados.append(campo)
            else:
                setattr(membro, attr, str(val).strip())
                alterados.append(campo)
    if not alterados:
        return "Nenhum campo foi alterado."
    membro.atualizado_em = datetime.now(timezone.utc)
    ctx.db.commit()
    return f"Membro '{membro.nome}' atualizado: {', '.join(alterados)}"

def _transferir_membro(args: dict, ctx: ToolContext) -> str:
    from app.models import Membro, Congregacao
    membro_id = (args.get("membro_id") or "").strip()
    cong_destino = (args.get("congregacao_destino_id") or "").strip()
    if not membro_id or not cong_destino:
        return "[erro: informe membro_id e congregacao_destino_id]"
    membro = ctx.db.query(Membro).filter(
        Membro.id == membro_id,
        Membro.tenant_id == ctx.tenant_id,
    ).first()
    if not membro:
        return "[erro: membro não encontrado]"
    destino = ctx.db.query(Congregacao).filter(
        Congregacao.id == cong_destino,
        Congregacao.tenant_id == ctx.tenant_id,
    ).first()
    if not destino:
        return "[erro: congregação destino não encontrada]"
    origem_nome = membro.congregacao_id
    cong_origem = ctx.db.query(Congregacao).filter(
        Congregacao.id == membro.congregacao_id,
    ).first()
    origem_nome = cong_origem.nome if cong_origem else "desconhecida"
    membro.congregacao_id = cong_destino
    if membro.observacoes:
        membro.observacoes += f"\n[Transferido de {origem_nome} para {destino.nome} em {date.today().isoformat()}]"
    else:
        membro.observacoes = f"[Transferido de {origem_nome} para {destino.nome} em {date.today().isoformat()}]"
    membro.atualizado_em = datetime.now(timezone.utc)
    ctx.db.commit()
    return f"Membro '{membro.nome}' transferido de '{origem_nome}' para '{destino.nome}'."

register_tool(Tool(
    name="validar_cpf",
    description="Valida o formato e dígitos verificadores de um CPF.",
    parameters={
        "type": "object",
        "properties": {
            "cpf": {"type": "string", "description": "CPF para validar (com ou sem pontuação)"},
        },
        "required": ["cpf"],
    },
    handler=lambda a, c: _validar_cpf(a.get("cpf", "")),
))

register_tool(Tool(
    name="validar_telefone",
    description="Valida o formato de um telefone brasileiro (fixo ou celular com DDD).",
    parameters={
        "type": "object",
        "properties": {
            "telefone": {"type": "string", "description": "Telefone para validar"},
        },
        "required": ["telefone"],
    },
    handler=lambda a, c: _validar_telefone(a.get("telefone", "")),
))

register_tool(Tool(
    name="buscar_membro",
    description="Busca membros por nome, CPF ou termo parcial.",
    parameters={
        "type": "object",
        "properties": {
            "nome": {"type": "string", "description": "Nome completo ou parcial do membro"},
            "cpf": {"type": "string", "description": "CPF do membro"},
        },
    },
    handler=_buscar_membro,
))

register_tool(Tool(
    name="criar_membro",
    description="Cria um novo membro no banco de dados.",
    parameters={
        "type": "object",
        "properties": {
            "nome": {"type": "string", "description": "Nome completo"},
            "cpf": {"type": "string", "description": "CPF"},
            "rg": {"type": "string", "description": "RG"},
            "data_nascimento": {"type": "string", "description": "Data de nascimento (YYYY-MM-DD)"},
            "telefone": {"type": "string", "description": "Telefone"},
            "whatsapp": {"type": "string", "description": "WhatsApp"},
            "endereco": {"type": "string", "description": "Endereço completo"},
            "estado_civil": {"type": "string", "description": "Estado civil: solteiro, casado, divorciado, viuvo"},
            "data_conversao": {"type": "string", "description": "Data da conversão (YYYY-MM-DD)"},
            "data_batismo": {"type": "string", "description": "Data do batismo (YYYY-MM-DD)"},
            "cargo": {"type": "string", "description": "Cargo do membro"},
            "status": {"type": "string", "description": "Situação: ativo, inativo, transferido, excluido"},
            "observacoes": {"type": "string", "description": "Observações adicionais"},
            "congregacao_id": {"type": "string", "description": "ID da congregação"},
        },
        "required": ["nome"],
    },
    handler=_criar_membro,
))

register_tool(Tool(
    name="atualizar_membro",
    description="Atualiza dados de um membro existente. Só altera campos informados.",
    parameters={
        "type": "object",
        "properties": {
            "membro_id": {"type": "string", "description": "ID do membro"},
            "nome": {"type": "string"},
            "cpf": {"type": "string"},
            "rg": {"type": "string"},
            "data_nascimento": {"type": "string", "description": "YYYY-MM-DD"},
            "telefone": {"type": "string"},
            "whatsapp": {"type": "string"},
            "endereco": {"type": "string"},
            "estado_civil": {"type": "string"},
            "cargo": {"type": "string"},
            "status": {"type": "string"},
            "observacoes": {"type": "string"},
            "congregacao_id": {"type": "string"},
            "data_conversao": {"type": "string", "description": "YYYY-MM-DD"},
            "data_batismo": {"type": "string", "description": "YYYY-MM-DD"},
        },
        "required": ["membro_id"],
    },
    handler=_atualizar_membro,
))

register_tool(Tool(
    name="transferir_membro",
    description="Transfere um membro de uma congregação para outra. Mantém histórico.",
    parameters={
        "type": "object",
        "properties": {
            "membro_id": {"type": "string", "description": "ID do membro"},
            "congregacao_destino_id": {"type": "string", "description": "ID da congregação destino"},
        },
        "required": ["membro_id", "congregacao_destino_id"],
    },
    handler=_transferir_membro,
))
