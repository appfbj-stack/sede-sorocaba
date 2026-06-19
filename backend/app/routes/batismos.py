from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import aliased, Session
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user
from app.models import Batismo, Membro, Usuario
from app.utils import new_id, parse_date

router = APIRouter(prefix="/batismos", tags=["batismos"])

class BatismoIn(BaseModel):
    membro_id: str
    data: str
    local: Optional[str] = None
    pastor_id: Optional[str] = None
    congregacao_id: Optional[str] = None

def _serializar(b: Batismo, membro: Membro, pastor: Optional[Membro]) -> dict:
    return {
        "id": b.id, "membro_id": b.membro_id, "congregacao_id": b.congregacao_id, "data": b.data,
        "local": b.local, "pastor_id": b.pastor_id, "membro_nome": membro.nome, "foto_url": membro.foto_url,
        "pastor_nome": pastor.nome if pastor else None,
    }

@router.get("")
def listar(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
           cong_filtro: Optional[str] = Depends(congregacao_filter)):
    Pastor = aliased(Membro)
    q = (
        db.query(Batismo, Membro, Pastor)
        .join(Membro, Batismo.membro_id == Membro.id)
        .outerjoin(Pastor, Batismo.pastor_id == Pastor.id)
        .filter(Batismo.tenant_id == cu.tenant_id)
    )
    if cong_filtro:
        q = q.filter(Batismo.congregacao_id == cong_filtro)
    rows = q.order_by(Batismo.data.desc()).all()
    return [_serializar(b, m, p) for b, m, p in rows]

@router.get("/pendentes")
def pendentes(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
              cong_filtro: Optional[str] = Depends(congregacao_filter)):
    q = db.query(Membro).filter(Membro.tenant_id == cu.tenant_id, Membro.status == "ativo",
                                 Membro.data_batismo.is_(None))
    if cong_filtro:
        q = q.filter(Membro.congregacao_id == cong_filtro)
    membros = q.order_by(Membro.nome).all()
    return [{"id": m.id, "nome": m.nome, "foto_url": m.foto_url, "data_conversao": m.data_conversao,
             "congregacao_id": m.congregacao_id} for m in membros]

@router.post("", status_code=201)
def criar(payload: BatismoIn, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
          cong_filtro: Optional[str] = Depends(congregacao_filter)):
    membro = db.query(Membro).filter(Membro.id == payload.membro_id, Membro.tenant_id == cu.tenant_id).first()
    if not membro:
        raise HTTPException(status_code=404, detail="Membro não encontrado")
    cong_id = cong_filtro or payload.congregacao_id or membro.congregacao_id

    data_batismo = parse_date(payload.data)
    batismo = Batismo(id=new_id(), tenant_id=cu.tenant_id, congregacao_id=cong_id, membro_id=payload.membro_id,
                       data=data_batismo, local=payload.local, pastor_id=payload.pastor_id)
    db.add(batismo)
    membro.data_batismo = data_batismo
    db.commit(); db.refresh(batismo)

    pastor = db.query(Membro).filter(Membro.id == payload.pastor_id).first() if payload.pastor_id else None
    return _serializar(batismo, membro, pastor)

@router.delete("/{batismo_id}")
def remover(batismo_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    b = db.query(Batismo).filter(Batismo.id == batismo_id, Batismo.tenant_id == cu.tenant_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Não encontrado")
    membro = db.query(Membro).filter(Membro.id == b.membro_id).first()
    if membro:
        membro.data_batismo = None
    db.delete(b); db.commit()
    return {"ok": True}
