from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.roles import is_admin
from app.deps import get_current_user
from app.models import Tenant, Usuario

router = APIRouter(prefix="/tenant", tags=["tenant"])

class TenantOut(BaseModel):
    id: int
    nome: str
    slug: str
    ativo: bool
    assistant_context: str | None = None
    model_config = {"from_attributes": True}

class TenantContextIn(BaseModel):
    assistant_context: str = ""

@router.get("", response_model=TenantOut)
def get_tenant(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    tenant = db.query(Tenant).filter(Tenant.id == cu.tenant_id).first()
    return tenant

@router.put("/context", response_model=TenantOut)
def update_context(payload: TenantContextIn, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    if not is_admin(cu.perfil):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Apenas sede pode alterar o contexto")
    tenant = db.query(Tenant).filter(Tenant.id == cu.tenant_id).first()
    tenant.assistant_context = payload.assistant_context.strip() or None
    db.commit()
    db.refresh(tenant)
    return tenant
