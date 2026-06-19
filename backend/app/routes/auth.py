from urllib.parse import quote
from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.deps import get_current_user
from app.models import Tenant, Usuario
from app.services.google_oauth import exchange_code, get_auth_url, get_userinfo
from app.services.license import verify_license

router = APIRouter(prefix="/auth", tags=["auth"])

class UsuarioOut(BaseModel):
    id: str
    email: str
    nome: str
    perfil: str
    congregacao_id: str | None
    foto_url: str | None
    model_config = {"from_attributes": True}

@router.get("/google")
def google_login():
    return RedirectResponse(get_auth_url())

@router.get("/google/callback")
async def google_callback(code: str | None = None, db: Session = Depends(get_db)):
    frontend = settings.FRONTEND_URL
    if not code:
        return RedirectResponse(f"{frontend}/login?erro=1")

    try:
        tokens = await exchange_code(code)
        userinfo = await get_userinfo(tokens["access_token"])
    except Exception:
        return RedirectResponse(f"{frontend}/login?erro=1")

    email = userinfo.get("email")
    usuario = db.query(Usuario).filter(Usuario.email == email, Usuario.ativo.is_(True)).first()
    if not usuario:
        return RedirectResponse(f"{frontend}/acesso-negado?email={quote(email or '')}")

    license_status = await verify_license()
    if not license_status.get("valid"):
        return RedirectResponse(f"{frontend}/login?erro=1")

    tenant = db.query(Tenant).filter(Tenant.id == usuario.tenant_id).first()
    if not tenant or not tenant.ativo:
        return RedirectResponse(f"{frontend}/login?erro=1")

    usuario.nome = userinfo.get("name", usuario.nome)
    usuario.foto_url = userinfo.get("picture", usuario.foto_url)
    db.commit()

    token = create_access_token({"sub": usuario.id})
    return RedirectResponse(f"{frontend}/auth/callback?token={token}")

@router.get("/me", response_model=UsuarioOut)
def me(cu: Usuario = Depends(get_current_user)):
    return cu

@router.post("/logout")
def logout(cu: Usuario = Depends(get_current_user)):
    return {"ok": True}
