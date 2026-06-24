from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.deps import get_current_user
from app.models import Usuario
from app.services.assistente import (
    montar_system_prompt,
    chamar_llm,
    executar_acao,
    ACOES_POR_PERFIL,
)

router = APIRouter(prefix="/assistente", tags=["assistente"])


class MensagemIn(BaseModel):
    mensagem: str
    tela_atual: str = ""
    historico: list[dict] = []


class ConfirmarAcaoIn(BaseModel):
    acao: dict
    tela_atual: str = ""


@router.post("/chat")
async def chat(
    payload: MensagemIn,
    db: Session = Depends(get_db),
    cu: Usuario = Depends(get_current_user),
):
    system_prompt = montar_system_prompt(cu, db, payload.tela_atual)
    historico = payload.historico[-20:]
    mensagens = [{"role": "system", "content": system_prompt}]
    mensagens.extend(historico)
    mensagens.append({"role": "user", "content": payload.mensagem})
    try:
        resposta = await chamar_llm(mensagens)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro ao contatar IA: {str(e)}")
    return resposta


@router.post("/executar")
def executar(
    payload: ConfirmarAcaoIn,
    db: Session = Depends(get_db),
    cu: Usuario = Depends(get_current_user),
):
    tipo = payload.acao.get("tipo", "")
    permitidas = ACOES_POR_PERFIL.get(cu.perfil, [])
    if tipo not in permitidas:
        raise HTTPException(status_code=403, detail="Acao nao permitida para seu perfil.")
    resultado = executar_acao(payload.acao, cu, db)
    return resultado


@router.get("/contexto")
def contexto(
    db: Session = Depends(get_db),
    cu: Usuario = Depends(get_current_user),
):
    from app.models import Congregacao
    congregacoes = db.query(Congregacao).filter(
        Congregacao.tenant_id == cu.tenant_id,
        Congregacao.status == "ativa",
    ).all()
    return {
        "perfil": cu.perfil,
        "nome": cu.nome,
        "congregacao_id": cu.congregacao_id,
        "acoes_disponiveis": ACOES_POR_PERFIL.get(cu.perfil, []),
        "congregacoes": [{"id": c.id, "nome": c.nome} for c in congregacoes],
    }
