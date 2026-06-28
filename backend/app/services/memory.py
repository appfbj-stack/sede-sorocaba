import re
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import ResumoConversa, Memoria, MensagemIA
from app.services.llm import get_client
from app.core.config import settings

def get_conversa_summary(conversa_id: str, db: Session) -> str | None:
    resumo = db.query(ResumoConversa).filter(
        ResumoConversa.conversa_id == conversa_id
    ).order_by(ResumoConversa.criado_em.desc()).first()
    if resumo and resumo.resumo.strip():
        return resumo.resumo
    return None

def search_memories(tenant_id: int, query: str, db: Session) -> str:
    from app.services.rag import _tokenize, _overlap_score
    query_tokens = _tokenize(query)
    if not query_tokens:
        return ""
    memorias = db.query(Memoria).filter(Memoria.tenant_id == tenant_id).all()
    scored = []
    for mem in memorias:
        text = f"{mem.chave} {mem.valor}"
        score = _overlap_score(query_tokens, text)
        if score > 0.1:
            scored.append((score, mem))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:5]
    if not top:
        return ""
    linhas = []
    for score, mem in top:
        linhas.append(f"- {mem.chave}: {mem.valor[:300]}")
    return "\n".join(linhas)

async def summarize_conversation(conversa_id: str, db: Session) -> None:
    msgs = db.query(MensagemIA).filter(
        MensagemIA.conversa_id == conversa_id
    ).order_by(MensagemIA.criado_em).all()
    if len(msgs) < 4:
        return
    ultimo = db.query(ResumoConversa).filter(
        ResumoConversa.conversa_id == conversa_id
    ).order_by(ResumoConversa.criado_em.desc()).first()
    if ultimo:
        from datetime import timedelta
        if datetime.now(timezone.utc) - ultimo.criado_em < timedelta(hours=1):
            return
    texto = "\n".join(f"{m.role}: {m.content[:500]}" for m in msgs[-10:])
    client = get_client()
    try:
        response = client.chat.completions.create(
            model=settings.OPENROUTER_MODEL,
            messages=[{
                "role": "system",
                "content": "Resuma esta conversa em 3-5 linhas, capturando os topicos principais e decisoes.",
            }, {
                "role": "user",
                "content": texto,
            }],
        )
        resumo_texto = response.choices[0].message.content or ""
        resumo = ResumoConversa(
            id=str(uuid.uuid4()),
            conversa_id=conversa_id,
            resumo=resumo_texto,
        )
        db.add(resumo)
        db.commit()
    except Exception:
        pass

import uuid

async def extract_facts(tenant_id: int, conversa_id: str, user_msg: str, assistant_msg: str, db: Session) -> None:
    client = get_client()
    try:
        response = client.chat.completions.create(
            model=settings.OPENROUTER_MODEL,
            messages=[{
                "role": "system",
                "content": (
                    "Extraia fatos objetivos desta conversa no formato:\n"
                    "FATO: <chave> = <valor>\n"
                    "Se nao houver fatos relevantes, retorne apenas 'NENHUM'.\n"
                    "Exemplo: FATO: endereco_cliente = Rua das Flores, 123"
                ),
            }, {
                "role": "user",
                "content": f"Usuario: {user_msg}\nAssistente: {assistant_msg}",
            }],
        )
        content = response.choices[0].message.content or ""
        for line in content.split("\n"):
            line = line.strip()
            if line.upper().startswith("FATO:") or line.startswith("- FATO:"):
                line = line.replace("- FATO:", "").replace("FATO:", "", 1).strip()
                if "=" in line:
                    chave, valor = line.split("=", 1)
                    fato = Memoria(
                        id=str(uuid.uuid4()),
                        tenant_id=tenant_id,
                        conversa_id=conversa_id,
                        chave=chave.strip(),
                        valor=valor.strip(),
                    )
                    db.add(fato)
        db.commit()
    except Exception:
        pass
