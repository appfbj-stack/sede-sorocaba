from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user
from app.models import Membro, Obreiro, Usuario
from app.utils import new_id, parse_date

router = APIRouter(prefix="/obreiros", tags=["obreiros"])

class ObreiroIn(BaseModel):
    membro_id: Optional[str] = None
    congregacao_id: Optional[str] = None
    categoria: str
    credencial_numero: Optional[str] = None
    credencial_emissao: Optional[str] = None
    credencial_validade: Optional[str] = None

class ObreiroUpdate(BaseModel):
    categoria: str
    credencial_numero: Optional[str] = None
    credencial_emissao: Optional[str] = None
    credencial_validade: Optional[str] = None
    ativo: bool = True

def _serializar(o: Obreiro) -> dict:
    return {
        "id": o.id, "membro_id": o.membro_id, "congregacao_id": o.congregacao_id,
        "categoria": o.categoria, "credencial_numero": o.credencial_numero,
        "credencial_emissao": o.credencial_emissao, "credencial_validade": o.credencial_validade,
        "ativo": o.ativo, "nome": o.membro.nome, "foto_url": o.membro.foto_url,
        "telefone": o.membro.telefone, "whatsapp": o.membro.whatsapp,
    }

@router.get("")
def listar(categoria: str = "", vencidos: bool = False, congregacao_id: str = "",
           db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
           cong_filtro: Optional[str] = Depends(congregacao_filter)):
    q = db.query(Obreiro).filter(Obreiro.tenant_id == cu.tenant_id)
    if cong_filtro:
        q = q.filter(Obreiro.congregacao_id == cong_filtro)
    elif congregacao_id:
        q = q.filter(Obreiro.congregacao_id == congregacao_id)
    if categoria:
        q = q.filter(Obreiro.categoria == categoria)
    if vencidos:
        q = q.filter(Obreiro.credencial_validade < date.today())
    obreiros = q.join(Membro).order_by(Membro.nome).all()
    return [_serializar(o) for o in obreiros]

@router.post("", status_code=201)
def criar(payload: ObreiroIn, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
          cong_filtro: Optional[str] = Depends(congregacao_filter)):
    if not payload.membro_id:
        raise HTTPException(status_code=400, detail="membro_id obrigatório")
    cong_id = cong_filtro or payload.congregacao_id
    if not cong_id:
        raise HTTPException(status_code=400, detail="congregacao_id obrigatório")
    obreiro = Obreiro(
        id=new_id(), tenant_id=cu.tenant_id, membro_id=payload.membro_id, congregacao_id=cong_id,
        categoria=payload.categoria, credencial_numero=payload.credencial_numero,
        credencial_emissao=parse_date(payload.credencial_emissao),
        credencial_validade=parse_date(payload.credencial_validade), ativo=True,
    )
    db.add(obreiro); db.commit(); db.refresh(obreiro)
    return _serializar(obreiro)

@router.put("/{obreiro_id}")
def atualizar(obreiro_id: str, payload: ObreiroUpdate, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    obreiro = db.query(Obreiro).filter(Obreiro.id == obreiro_id, Obreiro.tenant_id == cu.tenant_id).first()
    if not obreiro:
        raise HTTPException(status_code=404, detail="Não encontrado")
    obreiro.categoria = payload.categoria
    obreiro.credencial_numero = payload.credencial_numero
    obreiro.credencial_emissao = parse_date(payload.credencial_emissao)
    obreiro.credencial_validade = parse_date(payload.credencial_validade)
    obreiro.ativo = payload.ativo
    db.commit(); db.refresh(obreiro)
    return _serializar(obreiro)

@router.delete("/{obreiro_id}")
def remover(obreiro_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    obreiro = db.query(Obreiro).filter(Obreiro.id == obreiro_id, Obreiro.tenant_id == cu.tenant_id).first()
    if not obreiro:
        raise HTTPException(status_code=404, detail="Não encontrado")
    db.delete(obreiro); db.commit()
    return {"ok": True}
