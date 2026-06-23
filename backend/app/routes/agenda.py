from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user
from app.models import Evento, Usuario
from app.utils import new_id, parse_datetime

router = APIRouter(prefix="/agenda", tags=["agenda"])

class EventoIn(BaseModel):
    titulo: str
    tipo: str = "culto"
    descricao: Optional[str] = None
    data_inicio: str
    data_fim: Optional[str] = None
    local: Optional[str] = None
    responsavel_email: Optional[str] = None
    congregacao_id: Optional[str] = None

class EventoOut(BaseModel):
    id: str
    congregacao_id: str
    titulo: str
    tipo: str
    descricao: Optional[str]
    data_inicio: datetime
    data_fim: Optional[datetime]
    local: Optional[str]
    responsavel_email: Optional[str]
    google_event_id: Optional[str]
    model_config = {"from_attributes": True}

@router.get("", response_model=list[EventoOut])
def listar(tipo: str = "", de: str = "", ate: str = "", db: Session = Depends(get_db),
           cu: Usuario = Depends(get_current_user), cong_filtro: Optional[str] = Depends(congregacao_filter)):
    q = db.query(Evento).filter(Evento.tenant_id == cu.tenant_id)
    if cong_filtro:
        q = q.filter(Evento.congregacao_id == cong_filtro)
    if tipo:
        q = q.filter(Evento.tipo == tipo)
    if de:
        q = q.filter(Evento.data_inicio >= parse_datetime(de))
    if ate:
        q = q.filter(Evento.data_inicio <= parse_datetime(f"{ate}T23:59:59"))
    return q.order_by(Evento.data_inicio).all()

@router.post("", response_model=EventoOut, status_code=201)
def criar(payload: EventoIn, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
          cong_filtro: Optional[str] = Depends(congregacao_filter)):
    cong_id = cong_filtro or payload.congregacao_id
    if not cong_id:
        raise HTTPException(status_code=400, detail="congregacao_id obrigatório")
    evento = Evento(
        id=new_id(), tenant_id=cu.tenant_id, congregacao_id=cong_id, titulo=payload.titulo,
        tipo=payload.tipo, descricao=payload.descricao, data_inicio=parse_datetime(payload.data_inicio),
        data_fim=parse_datetime(payload.data_fim), local=payload.local, responsavel_email=payload.responsavel_email,
    )
    db.add(evento); db.commit(); db.refresh(evento)
    return evento

@router.delete("/{evento_id}")
def remover(evento_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    evento = db.query(Evento).filter(Evento.id == evento_id, Evento.tenant_id == cu.tenant_id).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Não encontrado")
    db.delete(evento); db.commit()
    return {"ok": True}
