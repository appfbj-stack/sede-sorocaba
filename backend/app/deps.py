from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models import LogAtividade, Sessao, Tenant, Usuario
from app.services.license import sincronizar_status
from app.utils import new_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def get_current_user(db: Session = Depends(get_db), token: str | None = Depends(oauth2_scheme)) -> Usuario:
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        payload = decode_token(token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")

    jti = payload.get("jti")
    if jti:
        sessao = db.query(Sessao).filter(Sessao.jti == jti).first()
        if not sessao or sessao.revogada_em is not None:
            raise HTTPException(status_code=401, detail="Sessão encerrada, faça login novamente")

    usuario = db.query(Usuario).filter(Usuario.id == payload["sub"], Usuario.ativo.is_(True)).first()
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuário inativo ou não encontrado")

    tenant = db.query(Tenant).filter(Tenant.id == usuario.tenant_id).first()
    if not tenant or not tenant.ativo:
        raise HTTPException(status_code=403, detail="Empresa inativa")

    return usuario

def require_roles(*perfis: str):
    def _check(cu: Usuario = Depends(get_current_user)) -> Usuario:
        if cu.perfil not in perfis:
            raise HTTPException(status_code=403, detail="Acesso não permitido")
        return cu
    return _check

require_master = require_roles("master")
require_admin = require_roles("master", "admin")

def require_active_license(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)) -> Usuario:
    from app.models import Licenca
    licenca = db.query(Licenca).filter(Licenca.tenant_id == cu.tenant_id).first()
    if not licenca:
        raise HTTPException(status_code=402, detail="Licença não configurada")
    licenca = sincronizar_status(db, licenca)
    if not licenca.acesso_liberado():
        raise HTTPException(status_code=402, detail=f"Licença {licenca.status}. Entre em contato com o administrador.")
    return cu

def log_activity(db: Session, tenant_id: int, usuario_id: str | None, acao: str,
                  detalhes: str | None = None, request: Request | None = None) -> None:
    ip = request.client.host if request and request.client else None
    db.add(LogAtividade(id=new_id(), tenant_id=tenant_id, usuario_id=usuario_id,
                         acao=acao, detalhes=detalhes, ip=ip))
    db.commit()
