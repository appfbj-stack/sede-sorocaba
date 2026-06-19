from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import require_sede
from app.models import PERFIS, Usuario
from app.utils import new_id

router = APIRouter(prefix="/usuarios", tags=["usuarios"], dependencies=[Depends(require_sede)])

class UsuarioIn(BaseModel):
    email: str
    nome: str
    perfil: str
    congregacao_id: Optional[str] = None

class UsuarioUpdate(BaseModel):
    nome: str
    perfil: str
    congregacao_id: Optional[str] = None
    ativo: bool = True

class UsuarioOut(BaseModel):
    id: str
    email: str
    nome: str
    perfil: str
    congregacao_id: Optional[str]
    foto_url: Optional[str]
    ativo: bool
    model_config = {"from_attributes": True}

@router.get("", response_model=list[UsuarioOut])
def listar(db: Session = Depends(get_db), cu: Usuario = Depends(require_sede)):
    return db.query(Usuario).filter(Usuario.tenant_id == cu.tenant_id).order_by(Usuario.nome).all()

@router.post("", response_model=UsuarioOut, status_code=201)
def criar(payload: UsuarioIn, db: Session = Depends(get_db), cu: Usuario = Depends(require_sede)):
    if payload.perfil not in PERFIS:
        raise HTTPException(status_code=400, detail="Perfil inválido")
    if db.query(Usuario).filter(Usuario.email == payload.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    usuario = Usuario(id=new_id(), tenant_id=cu.tenant_id, email=payload.email, nome=payload.nome,
                       perfil=payload.perfil, congregacao_id=payload.congregacao_id, ativo=True)
    db.add(usuario); db.commit(); db.refresh(usuario)
    return usuario

@router.put("/{usuario_id}", response_model=UsuarioOut)
def atualizar(usuario_id: str, payload: UsuarioUpdate, db: Session = Depends(get_db), cu: Usuario = Depends(require_sede)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.tenant_id == cu.tenant_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if payload.perfil not in PERFIS:
        raise HTTPException(status_code=400, detail="Perfil inválido")
    usuario.nome = payload.nome
    usuario.perfil = payload.perfil
    usuario.congregacao_id = payload.congregacao_id
    usuario.ativo = payload.ativo
    db.commit(); db.refresh(usuario)
    return usuario

@router.delete("/{usuario_id}")
def remover(usuario_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(require_sede)):
    if usuario_id == cu.id:
        raise HTTPException(status_code=400, detail="Não pode remover a si mesmo")
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.tenant_id == cu.tenant_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Não encontrado")
    usuario.ativo = False
    db.commit()
    return {"ok": True}
