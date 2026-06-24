import json
import httpx
from datetime import date
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import Congregacao, Membro, Evento, Obreiro, Usuario

ACOES_POR_PERFIL = {
    "master": [
        "cadastrar_membro", "atualizar_membro", "buscar_membro",
        "cadastrar_evento", "buscar_eventos", "buscar_aniversariantes",
        "cadastrar_congregacao", "listar_congregacoes",
        "listar_obreiros", "relatorio_membros",
        "buscar_usuario", "resumo_dashboard",
    ],
    "admin": [
        "cadastrar_membro", "atualizar_membro", "buscar_membro",
        "cadastrar_evento", "buscar_eventos", "buscar_aniversariantes",
        "cadastrar_congregacao", "listar_congregacoes",
        "listar_obreiros", "relatorio_membros",
        "buscar_usuario", "resumo_dashboard",
    ],
    "cliente": [
        "buscar_membro", "buscar_eventos",
        "buscar_aniversariantes", "resumo_dashboard",
    ],
}

def montar_system_prompt(usuario, db, tela_atual=""):
    hoje = date.today().strftime("%d/%m/%Y")
    congregacoes = db.query(Congregacao).filter(
        Congregacao.tenant_id == usuario.tenant_id,
        Congregacao.status == "ativa"
    ).all()
    nomes_congregacoes = ", ".join(c.nome for c in congregacoes) if congregacoes else "nenhuma cadastrada"
    total_membros = db.query(Membro).filter(
        Membro.tenant_id == usuario.tenant_id,
        Membro.status == "ativo"
    ).count()
    acoes_disponiveis = ACOES_POR_PERFIL.get(usuario.perfil, [])
    cong_usuario = ""
    if usuario.congregacao_id:
        cong = db.query(Congregacao).filter(Congregacao.id == usuario.congregacao_id).first()
        cong_usuario = cong.nome if cong else ""
    tela_info = f"\nTela atual: {tela_atual}" if tela_atual else ""
    return f"""Voce e a secretaria digital do sistema Kairos Igreja. Seu nome e Kairos.\nFale portugues brasileiro, seja simpatica e objetiva.\n\nCONTEXTO:\n- Data: {hoje}\n- Usuario: {usuario.nome} (perfil: {usuario.perfil})\n- Congregacao: {cong_usuario or 'todas'}\n- Membros ativos: {total_membros}\n- Congregacoes: {nomes_congregacoes}{tela_info}\n\nACOES DISPONIVEIS: {json.dumps(acoes_disponiveis, ensure_ascii=False)}\n\nREGRAS:\n1. Sempre responda em portugues brasileiro.\n2. Respostas curtas e diretas.\n3. Para EXECUTAR acoes, use o campo acao no JSON.\n4. Para ENSINAR, use o campo card_ajuda no JSON.\n5. Antes de ALTERAR dados, peca confirmacao.\n6. Respeite as permissoes por perfil.\n\nFORMATO DE RESPOSTA - sempre JSON valido:\n{{\n  "resposta": "texto para o usuario",\n  "acao": null,\n  "card_ajuda": null,\n  "aguardando_confirmacao": false,\n  "dados_coletados": {{}}\n}}\n\nExemplo com acao:\n{{\n  "resposta": "Vou cadastrar Joao Silva. Confirma?",\n  "acao": {{"tipo": "cadastrar_membro", "dados": {{"nome": "Joao Silva", "congregacao_id": "uuid", "status": "ativo"}}}},\n  "card_ajuda": null,\n  "aguardando_confirmacao": true,\n  "dados_coletados": {{}}\n}}\n\nExemplo com card de ajuda:\n{{\n  "resposta": "Veja como cadastrar um membro:",\n  "acao": null,\n  "card_ajuda": {{"titulo": "Como cadastrar um membro", "emoji": "\ud83d\udc64", "passos": ["Acesse Membros", "Clique em Novo Membro", "Preencha os dados", "Salve"], "botoes": ["Fazer agora", "Seguir passo a passo"]}},\n  "aguardando_confirmacao": false,\n  "dados_coletados": {{}}\n}}"""


async def chamar_llm(mensagens):
    if not settings.OPENROUTER_API_KEY:
        return {
            "resposta": "Assistente IA nao configurado. Configure OPENROUTER_API_KEY.",
            "acao": None, "card_ajuda": None,
            "aguardando_confirmacao": False, "dados_coletados": {},
        }
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://kairos.app",
        "X-Title": "Kairos Igreja",
    }
    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": mensagens,
        "max_tokens": settings.ASSISTENTE_MAX_TOKENS,
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{settings.OPENROUTER_BASE_URL}/chat/completions",
            headers=headers, json=payload,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {"resposta": content, "acao": None, "card_ajuda": None,
                "aguardando_confirmacao": False, "dados_coletados": {}}


def executar_acao(acao, usuario, db):
    tipo = acao.get("tipo")
    dados = acao.get("dados", {})

    if tipo == "buscar_membro":
        busca = dados.get("nome", "")
        membros = db.query(Membro).filter(
            Membro.tenant_id == usuario.tenant_id,
            Membro.nome.ilike(f"%{busca}%"),
        ).limit(5).all()
        if not membros:
            return {"ok": True, "mensagem": f"Nenhum membro encontrado com '{busca}'."}
        lista = ", ".join(f"{m.nome} ({m.status})" for m in membros)
        return {"ok": True, "mensagem": f"Encontrei: {lista}"}

    if tipo == "buscar_aniversariantes":
        from datetime import date as date_
        from sqlalchemy import extract
        hoje = date_.today()
        periodo = dados.get("periodo", "hoje")
        q = db.query(Membro).filter(
            Membro.tenant_id == usuario.tenant_id,
            Membro.status == "ativo",
            Membro.data_nascimento.isnot(None),
        )
        if usuario.congregacao_id:
            q = q.filter(Membro.congregacao_id == usuario.congregacao_id)
        if periodo == "hoje":
            q = q.filter(
                extract("month", Membro.data_nascimento) == hoje.month,
                extract("day", Membro.data_nascimento) == hoje.day,
            )
        elif periodo == "mes":
            q = q.filter(extract("month", Membro.data_nascimento) == hoje.month)
        membros = q.order_by(Membro.nome).limit(10).all()
        if not membros:
            return {"ok": True, "mensagem": f"Nenhum aniversariante {periodo}."}
        lista = ", ".join(m.nome for m in membros)
        return {"ok": True, "mensagem": f"Aniversariantes ({periodo}): {lista}"}

    if tipo == "buscar_eventos":
        from datetime import date as date_, timedelta
        hoje = date_.today()
        eventos = db.query(Evento).filter(
            Evento.tenant_id == usuario.tenant_id,
            Evento.data_inicio >= hoje,
            Evento.data_inicio <= hoje + timedelta(days=30),
        ).order_by(Evento.data_inicio).limit(5).all()
        if not eventos:
            return {"ok": True, "mensagem": "Nenhum evento nos proximos 30 dias."}
        lista = ", ".join(f"{e.titulo} ({e.data_inicio.strftime('%d/%m')})" for e in eventos)
        return {"ok": True, "mensagem": f"Proximos eventos: {lista}"}

    if tipo == "listar_congregacoes":
        congregacoes = db.query(Congregacao).filter(
            Congregacao.tenant_id == usuario.tenant_id,
            Congregacao.status == "ativa",
        ).all()
        if not congregacoes:
            return {"ok": True, "mensagem": "Nenhuma congregacao cadastrada."}
        lista = ", ".join(c.nome for c in congregacoes)
        return {"ok": True, "mensagem": f"Congregacoes ativas: {lista}"}

    if tipo == "resumo_dashboard":
        total = db.query(Membro).filter(
            Membro.tenant_id == usuario.tenant_id, Membro.status == "ativo",
        ).count()
        obreiros = db.query(Obreiro).filter(
            Obreiro.tenant_id == usuario.tenant_id, Obreiro.ativo.is_(True),
        ).count()
        return {"ok": True, "mensagem": f"Resumo: {total} membros ativos, {obreiros} obreiros."}

    if tipo in ("cadastrar_membro", "cadastrar_evento", "cadastrar_congregacao", "atualizar_membro"):
        return {"ok": True, "executar_no_frontend": True, "tipo": tipo, "dados": dados}

    return {"ok": False, "mensagem": f"Acao '{tipo}' nao reconhecida."}
