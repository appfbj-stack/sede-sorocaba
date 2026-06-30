from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.core.security import hash_password
from app.models import Base, Licenca, Tenant, Usuario
from app.services.license import get_or_create_licenca, sincronizar_status
from app.services.kairos_integration import KairosIntegration
from app.utils import new_id

Base.metadata.create_all(bind=engine)

_kairos: KairosIntegration | None = None

def get_kairos() -> KairosIntegration | None:
    return _kairos

def _seed():
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).first()
        if not tenant:
            tenant = Tenant(nome=settings.TENANT_NOME, slug=settings.TENANT_SLUG, ativo=True)
            db.add(tenant)
            db.flush()
        get_or_create_licenca(db, tenant.id, settings.LICENCA_DIAS_TESTE)
        email = settings.ADMIN_EMAIL.strip()
        if email and not db.query(Usuario).filter(Usuario.email == email).first():
            db.add(Usuario(
                id=new_id(), tenant_id=tenant.id, email=email, nome="Administrador",
                perfil="master", ativo=True,
                senha_hash=hash_password(settings.ADMIN_PASSWORD) if settings.ADMIN_PASSWORD else None,
            ))
        db.commit()
    finally:
        db.close()

def _log_license_status():
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).first()
        if not tenant:
            return
        licenca = db.query(Licenca).filter(Licenca.tenant_id == tenant.id).first()
        if not licenca:
            return
        licenca = sincronizar_status(db, licenca)
        emoji = "OK" if licenca.acesso_liberado() else "BLOQUEADO"
        print(f"[{emoji}] Licenca: status={licenca.status} plano={licenca.plano} validade={licenca.data_validade}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _kairos
    _seed()
    _log_license_status()
    _kairos = KairosIntegration(
        admin_url=settings.KAIROS_ADMIN_URL,
        client_id=settings.KAIROS_CLIENT_ID,
        api_key=settings.KAIROS_API_KEY or settings.KAIROS_ADMIN_BASIC_PASSWORD or "",
    )
    await _kairos.register()
    yield
    await _kairos.close()

from app.routes import (
    admin, agenda, auth, batismos, carteirinhas, congregacoes, dashboard,
    master, membros, obreiros, patrimonio, usuarios,
)
from app.routes import assistente
from app.routes import importacao
from app.routes import assistant, tenant

app = FastAPI(title=f"{settings.APP_NAME} API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(f"{settings.STORAGE_DIR}/ia").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

app.include_router(auth.router, prefix="/api")
app.include_router(usuarios.router, prefix="/api")
app.include_router(congregacoes.router, prefix="/api")
app.include_router(membros.router, prefix="/api")
app.include_router(obreiros.router, prefix="/api")
app.include_router(patrimonio.router, prefix="/api")
app.include_router(agenda.router, prefix="/api")
app.include_router(carteirinhas.router, prefix="/api")
app.include_router(batismos.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(master.router, prefix="/api")
app.include_router(assistente.router, prefix="/api")
app.include_router(importacao.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(tenant.router, prefix="/api")

@app.get("/api/health")
def health():
    kairos = get_kairos()
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "kairos_registered": kairos._registered if kairos else False,
        "kairos_url": settings.KAIROS_ADMIN_URL or None,
    }
