from typing import Optional
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import log_activity, require_admin
from app.models import LogAtividade, Tenant, Usuario

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

class LogOut(BaseModel):
    id: str
    usuario_id: Optional[str]
    acao: str
    detalhes: Optional[str]
    ip: Optional[str]
    criado_em: object
    model_config = {"from_attributes": True}

class ConfiguracoesIn(BaseModel):
    configuracoes: dict

@router.get("/logs", response_model=list[LogOut])
def listar_logs(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), cu: Usuario = Depends(require_admin)):
    return (
        db.query(LogAtividade)
        .filter(LogAtividade.tenant_id == cu.tenant_id)
        .order_by(LogAtividade.criado_em.desc())
        .offset(skip).limit(min(limit, 200))
        .all()
    )

@router.get("/configuracoes")
def obter_configuracoes(db: Session = Depends(get_db), cu: Usuario = Depends(require_admin)):
    tenant = db.query(Tenant).filter(Tenant.id == cu.tenant_id).first()
    return {"nome": tenant.nome, "slug": tenant.slug, "configuracoes": tenant.configuracoes or {}}

@router.put("/configuracoes")
def atualizar_configuracoes(payload: ConfiguracoesIn, request: Request,
                             db: Session = Depends(get_db), cu: Usuario = Depends(require_admin)):
    tenant = db.query(Tenant).filter(Tenant.id == cu.tenant_id).first()
    tenant.configuracoes = payload.configuracoes
    db.commit()
    log_activity(db, cu.tenant_id, cu.id, "configuracoes.atualizar", request=request)
    return {"ok": True, "configuracoes": tenant.configuracoes}
