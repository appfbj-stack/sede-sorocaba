import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.models import Base, Tenant, Usuario
from app.services.license import verify_license
from app.utils import new_id

Base.metadata.create_all(bind=engine)

def _seed_admin():
    email = settings.ADMIN_EMAIL.strip()
    if not email:
        return
    db = SessionLocal()
    try:
        if db.query(Usuario).filter(Usuario.email == email).first():
            return
        tenant = db.query(Tenant).first()
        if not tenant:
            tenant = Tenant(nome="OBPC Sorocaba", slug="obpc-sorocaba", ativo=True)
            db.add(tenant); db.flush()
        usuario = Usuario(id=new_id(), tenant_id=tenant.id, email=email, nome="Administrador Sede",
                           perfil="sede", ativo=True)
        db.add(usuario); db.commit()
    finally:
        db.close()

async def _check_license():
    result = await verify_license()
    if result.get("valid"):
        print(f"✅ Licença Kairos: {result.get('status')} - {result.get('message', '')}")
    else:
        print(f"❌ Licença Kairos: {result.get('status')} - {result.get('message', '')}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    _seed_admin()
    await _check_license()
    yield

from app.routes import agenda, auth, batismos, carteirinhas, congregacoes, dashboard, membros, obreiros, patrimonio, usuarios

app = FastAPI(title="Kairos Sede Sorocaba API", version="1.0.0", lifespan=lifespan)
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

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Kairos Sede Sorocaba API"}
