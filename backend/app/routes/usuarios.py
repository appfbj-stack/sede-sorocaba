from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password
from app.deps import log_activity, require_admin
from app.models import PERFIS, Usuario
from app.utils import new_id

router = APIRouter(prefix="/usuarios", tags=["usuarios"], dependencies=[Depends(require_admin)])

class UsuarioIn(BaseModel):
    email: EmailStr
    nome: str
    perfil: str = "cliente"
    senha: Optional[str] = None

class UsuarioUpdate(BaseModel):
    nome: str
    perfil: str
    ativo: bool = True

class UsuarioOut(BaseModel):
    id: str
    email: str
    nome: str
    perfil: str
    foto_url: Optional[str]
    ativo: bool
    model_config = {"from_attributes": True}

@router.get("", response_model=list[UsuarioOut])
def listar(db: Session = Depends(get_db), cu: Usuario = Depends(require_admin)):
    return db.query(Usuario).filter(Usuario.tenant_id == cu.tenant_id).order_by(Usuario.nome).all()

@router.post("", response_model=UsuarioOut, status_code=201)
def criar(payload: UsuarioIn, request: Request, db: Session = Depends(get_db), cu: Usuario = Depends(require_admin)):
    if payload.perfil not in PERFIS:
        raise HTTPException(status_code=400, detail="Perfil inválido")
    if payload.perfil == "master" and cu.perfil != "master":
        raise HTTPException(status_code=403, detail="Apenas master pode criar outro master")
    if db.query(Usuario).filter(Usuario.email == payload.email).first():
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    usuario = Usuario(
        id=new_id(), tenant_id=cu.tenant_id, email=payload.email, nome=payload.nome,
        perfil=payload.perfil, ativo=True,
        senha_hash=hash_password(payload.senha) if payload.senha else None,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    log_activity(db, cu.tenant_id, cu.id, "usuario.criar", f"Criou usuário {usuario.email}", request)
    return usuario

@router.put("/{usuario_id}", response_model=UsuarioOut)
def atualizar(usuario_id: str, payload: UsuarioUpdate, request: Request,
              db: Session = Depends(get_db), cu: Usuario = Depends(require_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.tenant_id == cu.tenant_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if payload.perfil not in PERFIS:
        raise HTTPException(status_code=400, detail="Perfil inválido")
    if payload.perfil == "master" and cu.perfil != "master":
        raise HTTPException(status_code=403, detail="Apenas master pode promover a master")

    usuario.nome = payload.nome
    usuario.perfil = payload.perfil
    usuario.ativo = payload.ativo
    db.commit()
    db.refresh(usuario)
    log_activity(db, cu.tenant_id, cu.id, "usuario.atualizar", f"Atualizou usuário {usuario.email}", request)
    return usuario

@router.delete("/{usuario_id}")
def remover(usuario_id: str, request: Request, db: Session = Depends(get_db), cu: Usuario = Depends(require_admin)):
    if usuario_id == cu.id:
        raise HTTPException(status_code=400, detail="Não pode remover a si mesmo")
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id, Usuario.tenant_id == cu.tenant_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Não encontrado")
    usuario.ativo = False
    db.commit()
    log_activity(db, cu.tenant_id, cu.id, "usuario.desativar", f"Desativou usuário {usuario.email}", request)
    return {"ok": True}
