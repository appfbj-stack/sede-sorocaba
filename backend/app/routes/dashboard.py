from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import get_current_user
from app.models import Licenca, Usuario
from app.services.license import sincronizar_status

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("")
def stats(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    total_usuarios = db.query(Usuario).filter(Usuario.tenant_id == cu.tenant_id).count()
    usuarios_ativos = db.query(Usuario).filter(Usuario.tenant_id == cu.tenant_id, Usuario.ativo.is_(True)).count()

    licenca = db.query(Licenca).filter(Licenca.tenant_id == cu.tenant_id).first()
    if licenca:
        licenca = sincronizar_status(db, licenca)

    return {
        "usuario": {"nome": cu.nome, "email": cu.email, "perfil": cu.perfil},
        "total_usuarios": total_usuarios,
        "usuarios_ativos": usuarios_ativos,
        "licenca": {
            "plano": licenca.plano,
            "status": licenca.status,
            "data_validade": licenca.data_validade,
        } if licenca else None,
    }
