from datetime import datetime, timedelta, timezone
from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

PERFIS = ["master", "admin", "cliente"]
LICENCA_STATUS = ["teste", "ativo", "suspenso", "expirado"]

# ── Tenant (empresa cliente desta instância do app) ─────────────────────────
class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    configuracoes: Mapped[dict] = mapped_column(JSON, default=dict)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

# ── Usuário (acesso ao sistema, via e-mail/senha ou Google OAuth) ───────────
class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(255))
    senha_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    perfil: Mapped[str] = mapped_column(String(20), default="cliente")  # master | admin | cliente
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    ultimo_login_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

# ── Sessão (controle de sessão / revogação para logout) ─────────────────────
class Sessao(Base):
    __tablename__ = "sessoes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    jti: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revogada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

# ── Token de recuperação de senha ────────────────────────────────────────────
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

# ── Licença (independente por aplicativo/tenant) ────────────────────────────
class Licenca(Base):
    __tablename__ = "licencas"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), unique=True, index=True)
    plano: Mapped[str] = mapped_column(String(50), default="trial")
    status: Mapped[str] = mapped_column(String(20), default="teste")  # teste | ativo | suspenso | expirado
    data_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    data_validade: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    def expirada(self) -> bool:
        from app.utils import as_aware_utc
        validade = as_aware_utc(self.data_validade)
        return validade is not None and validade < utcnow()

    def acesso_liberado(self) -> bool:
        return self.status in ("ativo", "teste") and not self.expirada()

def nova_validade_teste(dias: int) -> datetime:
    return utcnow() + timedelta(days=dias)

# ── Log de atividade administrativa ──────────────────────────────────────────
class LogAtividade(Base):
    __tablename__ = "logs_atividade"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    usuario_id: Mapped[str | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    acao: Mapped[str] = mapped_column(String(100))
    detalhes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
