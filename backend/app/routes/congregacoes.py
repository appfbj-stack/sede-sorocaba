from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user, require_sede
from app.models import Congregacao, Usuario
from app.utils import new_id

router = APIRouter(prefix="/congregacoes", tags=["congregacoes"])

class CongregacaoIn(BaseModel):
    nome: str
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    pastor_email: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    status: str = "ativa"

class CongregacaoOut(CongregacaoIn):
    id: str
    model_config = {"from_attributes": True}

@router.get("", response_model=list[CongregacaoOut])
def listar(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
           cong_filtro: Optional[str] = Depends(congregacao_filter)):
    q = db.query(Congregacao).filter(Congregacao.tenant_id == cu.tenant_id)
    if cong_filtro:
        q = q.filter(Congregacao.id == cong_filtro)
    return q.order_by(Congregacao.nome).all()

@router.get("/{congregacao_id}", response_model=CongregacaoOut)
def obter(congregacao_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
          cong_filtro: Optional[str] = Depends(congregacao_filter)):
    cong = db.query(Congregacao).filter(Congregacao.id == congregacao_id, Congregacao.tenant_id == cu.tenant_id).first()
    if not cong:
        raise HTTPException(status_code=404, detail="Não encontrada")
    if cong_filtro and cong.id != cong_filtro:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return cong

@router.post("", response_model=CongregacaoOut, status_code=201)
def criar(payload: CongregacaoIn, db: Session = Depends(get_db), cu: Usuario = Depends(require_sede)):
    cong = Congregacao(id=new_id(), tenant_id=cu.tenant_id, **payload.model_dump())
    db.add(cong); db.commit(); db.refresh(cong)
    return cong

@router.put("/{congregacao_id}", response_model=CongregacaoOut)
def atualizar(congregacao_id: str, payload: CongregacaoIn, db: Session = Depends(get_db), cu: Usuario = Depends(require_sede)):
    cong = db.query(Congregacao).filter(Congregacao.id == congregacao_id, Congregacao.tenant_id == cu.tenant_id).first()
    if not cong:
        raise HTTPException(status_code=404, detail="Não encontrada")
    for field, value in payload.model_dump().items():
        setattr(cong, field, value)
    db.commit(); db.refresh(cong)
    return cong

@router.delete("/{congregacao_id}")
def remover(congregacao_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(require_sede)):
    cong = db.query(Congregacao).filter(Congregacao.id == congregacao_id, Congregacao.tenant_id == cu.tenant_id).first()
    if not cong:
        raise HTTPException(status_code=404, detail="Não encontrada")
    db.delete(cong); db.commit()
    return {"ok": True}
