from datetime import datetime, timezone
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.deps import get_current_user, log_activity
from app.models import PasswordResetToken, Sessao, Tenant, Usuario
from app.services.email import send_password_reset_email
from app.services.google_oauth import exchange_code, get_auth_url, get_userinfo
from app.utils import as_aware_utc, new_id, new_token, hash_token

router = APIRouter(prefix="/auth", tags=["auth"])

class UsuarioOut(BaseModel):
    id: str
    email: str
    nome: str
    perfil: str
    foto_url: str | None
    model_config = {"from_attributes": True}

class LoginIn(BaseModel):
    email: EmailStr
    senha: str

class TokenOut(BaseModel):
    access_token: str
    usuario: UsuarioOut

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    nova_senha: str

def _emitir_sessao(db: Session, usuario: Usuario, request: Request) -> str:
    token, jti, expira_em = create_access_token({"sub": usuario.id})
    db.add(Sessao(
        id=new_id(), usuario_id=usuario.id, jti=jti, expira_em=expira_em,
        user_agent=request.headers.get("user-agent"),
        ip=request.client.host if request.client else None,
    ))
    usuario.ultimo_login_em = datetime.now(timezone.utc)
    db.commit()
    return token

@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, request: Request, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == payload.email, Usuario.ativo.is_(True)).first()
    if not usuario or not usuario.senha_hash or not verify_password(payload.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")

    token = _emitir_sessao(db, usuario, request)
    log_activity(db, usuario.tenant_id, usuario.id, "login", request=request)
    return {"access_token": token, "usuario": usuario}

@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    # get_current_user já validou o token; revogamos a sessão pelo jti do header.
    from app.core.security import decode_token
    auth_header = request.headers.get("authorization", "")
    raw_token = auth_header.removeprefix("Bearer ").strip()
    payload = decode_token(raw_token)
    sessao = db.query(Sessao).filter(Sessao.jti == payload.get("jti")).first()
    if sessao:
        sessao.revogada_em = datetime.now(timezone.utc)
        db.commit()
    return {"ok": True}

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == payload.email, Usuario.ativo.is_(True)).first()
    if usuario:
        token, token_hash = new_token()
        from datetime import timedelta
        db.add(PasswordResetToken(
            id=new_id(), usuario_id=usuario.id, token_hash=token_hash,
            expira_em=datetime.now(timezone.utc) + timedelta(hours=1),
        ))
        db.commit()
        reset_url = f"{settings.FRONTEND_URL}/redefinir-senha?token={token}"
        send_password_reset_email(usuario.email, reset_url)
    # Resposta idêntica independente do e-mail existir, para não vazar quais e-mails estão cadastrados.
    return {"ok": True, "message": "Se o e-mail existir, enviaremos instruções de recuperação."}

@router.post("/reset-password")
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    token_hash = hash_token(payload.token)
    reset = db.query(PasswordResetToken).filter(PasswordResetToken.token_hash == token_hash).first()
    if not reset or reset.usado_em is not None or as_aware_utc(reset.expira_em) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")
    if len(payload.nova_senha) < 8:
        raise HTTPException(status_code=400, detail="A senha deve ter ao menos 8 caracteres")

    usuario = db.query(Usuario).filter(Usuario.id == reset.usuario_id).first()
    usuario.senha_hash = hash_password(payload.nova_senha)
    reset.usado_em = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}

@router.get("/google")
def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=404, detail="Login com Google não configurado")
    return RedirectResponse(get_auth_url())

@router.get("/google/callback")
async def google_callback(code: str | None = None, request: Request = None, db: Session = Depends(get_db)):
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

    tenant = db.query(Tenant).filter(Tenant.id == usuario.tenant_id).first()
    if not tenant or not tenant.ativo:
        return RedirectResponse(f"{frontend}/login?erro=1")

    usuario.nome = userinfo.get("name", usuario.nome)
    usuario.foto_url = userinfo.get("picture", usuario.foto_url)
    usuario.google_id = userinfo.get("id", usuario.google_id)
    db.commit()

    token = _emitir_sessao(db, usuario, request)
    return RedirectResponse(f"{frontend}/auth/callback?token={token}")

@router.get("/me", response_model=UsuarioOut)
def me(cu: Usuario = Depends(get_current_user)):
    return cu
