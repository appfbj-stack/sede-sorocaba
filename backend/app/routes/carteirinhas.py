import base64
from datetime import date
from typing import Optional
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user
from app.models import Carteirinha, Congregacao, Membro, Usuario
from app.utils import new_id

router = APIRouter(prefix="/carteirinhas", tags=["carteirinhas"])

class EmitirIn(BaseModel):
    membro_id: str
    obreiro_id: Optional[str] = None
    validade_meses: int = 12

def _serializar(c: Carteirinha, membro: Membro, congregacao: Congregacao) -> dict:
    return {
        "id": c.id, "membro_id": c.membro_id, "obreiro_id": c.obreiro_id, "qrcode_hash": c.qrcode_hash,
        "foto_url": c.foto_url, "emissao": c.emissao, "validade": c.validade, "status": c.status,
        "nome": membro.nome, "cargo": membro.cargo, "congregacao_id": membro.congregacao_id,
        "congregacao_nome": congregacao.nome,
    }

@router.get("")
def listar(status: str = "", db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
           cong_filtro: Optional[str] = Depends(congregacao_filter)):
    q = (
        db.query(Carteirinha, Membro, Congregacao)
        .join(Membro, Carteirinha.membro_id == Membro.id)
        .join(Congregacao, Membro.congregacao_id == Congregacao.id)
        .filter(Carteirinha.tenant_id == cu.tenant_id)
    )
    if cong_filtro:
        q = q.filter(Membro.congregacao_id == cong_filtro)
    if status:
        q = q.filter(Carteirinha.status == status)
    rows = q.order_by(Membro.nome).all()
    return [_serializar(c, m, cg) for c, m, cg in rows]

@router.get("/pendentes")
def pendentes(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
              cong_filtro: Optional[str] = Depends(congregacao_filter)):
    emitidas_subq = db.query(Carteirinha.membro_id).filter(Carteirinha.status != "nao_emitida")
    q = db.query(Membro).filter(Membro.tenant_id == cu.tenant_id, Membro.status == "ativo",
                                 Membro.id.notin_(emitidas_subq))
    if cong_filtro:
        q = q.filter(Membro.congregacao_id == cong_filtro)
    membros = q.order_by(Membro.nome).all()
    return [{"id": m.id, "nome": m.nome, "foto_url": m.foto_url, "cargo": m.cargo,
             "congregacao_id": m.congregacao_id} for m in membros]

@router.post("/emitir", status_code=201)
def emitir(payload: EmitirIn, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    membro = db.query(Membro).filter(Membro.id == payload.membro_id, Membro.tenant_id == cu.tenant_id).first()
    if not membro:
        raise HTTPException(status_code=404, detail="Membro não encontrado")

    hoje = date.today()
    validade = hoje + relativedelta(months=payload.validade_meses)

    db.query(Carteirinha).filter(Carteirinha.membro_id == payload.membro_id,
                                  Carteirinha.status == "ativa").update({"status": "vencida"})

    nova_id = new_id()
    qrcode_hash = base64.b64encode(f"KAIROS:{payload.membro_id}:{nova_id}".encode()).decode()
    carteirinha = Carteirinha(
        id=nova_id, tenant_id=cu.tenant_id, membro_id=payload.membro_id, obreiro_id=payload.obreiro_id,
        qrcode_hash=qrcode_hash, emissao=hoje, validade=validade, status="ativa",
    )
    db.add(carteirinha)

    db.query(Carteirinha).filter(Carteirinha.tenant_id == cu.tenant_id, Carteirinha.status == "ativa",
                                  Carteirinha.validade < hoje).update({"status": "vencida"})
    db.commit(); db.refresh(carteirinha)

    congregacao = db.query(Congregacao).filter(Congregacao.id == membro.congregacao_id).first()
    return _serializar(carteirinha, membro, congregacao)

@router.delete("/{carteirinha_id}")
def remover(carteirinha_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    c = db.query(Carteirinha).filter(Carteirinha.id == carteirinha_id, Carteirinha.tenant_id == cu.tenant_id).first()
    if c:
        db.delete(c); db.commit()
    return {"ok": True}
