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
from app.utils import new_id

Base.metadata.create_all(bind=engine)

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
        emoji = "✅" if licenca.acesso_liberado() else "❌"
        print(f"{emoji} Licença: status={licenca.status} plano={licenca.plano} validade={licenca.data_validade}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed()
    _log_license_status()
    yield

from app.routes import (
    admin, agenda, auth, batismos, carteirinhas, congregacoes, dashboard,
    master, membros, obreiros, patrimonio, usuarios,
)

app = FastAPI(title=f"{settings.APP_NAME} API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
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

@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}
