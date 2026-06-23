from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.deps import log_activity, require_master
from app.core.database import get_db
from app.models import LICENCA_STATUS, Licenca, Tenant, Usuario, nova_validade_teste

router = APIRouter(prefix="/master", tags=["master"], dependencies=[Depends(require_master)])

class LicencaOut(BaseModel):
    plano: str
    status: str
    data_inicio: datetime
    data_validade: Optional[datetime]
    observacoes: Optional[str]
    model_config = {"from_attributes": True}

class LicencaUpdate(BaseModel):
    plano: Optional[str] = None
    status: Optional[str] = None
    data_validade: Optional[datetime] = None
    observacoes: Optional[str] = None

class TrialIn(BaseModel):
    dias: int = 14

@router.get("/licenca", response_model=LicencaOut)
def obter_licenca(db: Session = Depends(get_db), cu: Usuario = Depends(require_master)):
    licenca = db.query(Licenca).filter(Licenca.tenant_id == cu.tenant_id).first()
    if not licenca:
        raise HTTPException(status_code=404, detail="Licença não encontrada")
    return licenca

@router.put("/licenca", response_model=LicencaOut)
def atualizar_licenca(payload: LicencaUpdate, request: Request,
                       db: Session = Depends(get_db), cu: Usuario = Depends(require_master)):
    licenca = db.query(Licenca).filter(Licenca.tenant_id == cu.tenant_id).first()
    if not licenca:
        raise HTTPException(status_code=404, detail="Licença não encontrada")
    if payload.status and payload.status not in LICENCA_STATUS:
        raise HTTPException(status_code=400, detail="Status inválido")

    if payload.plano is not None:
        licenca.plano = payload.plano
    if payload.status is not None:
        licenca.status = payload.status
    if payload.data_validade is not None:
        licenca.data_validade = payload.data_validade
    if payload.observacoes is not None:
        licenca.observacoes = payload.observacoes

    db.commit()
    db.refresh(licenca)
    log_activity(db, cu.tenant_id, cu.id, "licenca.atualizar", f"status={licenca.status} plano={licenca.plano}", request)
    return licenca

@router.post("/licenca/iniciar-teste", response_model=LicencaOut)
def iniciar_teste(payload: TrialIn, request: Request, db: Session = Depends(get_db), cu: Usuario = Depends(require_master)):
    licenca = db.query(Licenca).filter(Licenca.tenant_id == cu.tenant_id).first()
    if not licenca:
        raise HTTPException(status_code=404, detail="Licença não encontrada")
    licenca.status = "teste"
    licenca.data_validade = nova_validade_teste(payload.dias)
    db.commit()
    db.refresh(licenca)
    log_activity(db, cu.tenant_id, cu.id, "licenca.iniciar_teste", f"{payload.dias} dias", request)
    return licenca

@router.get("/sistema")
def info_sistema(db: Session = Depends(get_db), cu: Usuario = Depends(require_master)):
    from app.core.config import settings
    tenant = db.query(Tenant).filter(Tenant.id == cu.tenant_id).first()
    return {
        "app_name": settings.APP_NAME,
        "app_slug": settings.APP_SLUG,
        "tenant": {"nome": tenant.nome, "slug": tenant.slug, "ativo": tenant.ativo},
        "total_usuarios": db.query(func.count(Usuario.id)).filter(Usuario.tenant_id == cu.tenant_id).scalar(),
        "usuarios_por_perfil": dict(
            db.query(Usuario.perfil, func.count(Usuario.id))
            .filter(Usuario.tenant_id == cu.tenant_id)
            .group_by(Usuario.perfil)
            .all()
        ),
    }
