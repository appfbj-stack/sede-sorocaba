from datetime import date, datetime, timezone
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

def utcnow(): return datetime.now(timezone.utc)

PERFIS = ["sede", "pastor"]

# ── Tenant (cliente da plataforma Kairos, ex: "OBPC Sorocaba") ──────────────
class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

# ── Usuário (acesso ao sistema, autenticado via Google OAuth) ──────────────
class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(255))
    perfil: Mapped[str] = mapped_column(String(20), default="pastor")  # sede | pastor
    congregacao_id: Mapped[str | None] = mapped_column(ForeignKey("congregacoes.id"), nullable=True)
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

# ── Congregação ──────────────────────────────────────────────────────────────
class Congregacao(Base):
    __tablename__ = "congregacoes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    nome: Mapped[str] = mapped_column(String(255))
    endereco: Mapped[str | None] = mapped_column(String(255), nullable=True)
    cidade: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estado: Mapped[str | None] = mapped_column(String(2), nullable=True)
    pastor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telefone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ativa")  # ativa | inativa
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

# ── Membro ───────────────────────────────────────────────────────────────────
class Membro(Base):
    __tablename__ = "membros"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    congregacao_id: Mapped[str] = mapped_column(ForeignKey("congregacoes.id"), index=True)
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    nome: Mapped[str] = mapped_column(String(255))
    cpf: Mapped[str | None] = mapped_column(String(14), nullable=True)
    rg: Mapped[str | None] = mapped_column(String(20), nullable=True)
    data_nascimento: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    telefone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    endereco: Mapped[str | None] = mapped_column(String(255), nullable=True)
    estado_civil: Mapped[str | None] = mapped_column(String(20), nullable=True)
    data_conversao: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_batismo: Mapped[date | None] = mapped_column(Date, nullable=True)
    cargo: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ativo", index=True)  # ativo | inativo | transferido | falecido
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

# ── Obreiro (credencial ministerial de um membro) ───────────────────────────
class Obreiro(Base):
    __tablename__ = "obreiros"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    membro_id: Mapped[str] = mapped_column(ForeignKey("membros.id"), index=True)
    congregacao_id: Mapped[str] = mapped_column(ForeignKey("congregacoes.id"), index=True)
    categoria: Mapped[str] = mapped_column(String(30))  # cooperador | diacono | presbitero | evangelista | pastor
    credencial_numero: Mapped[str | None] = mapped_column(String(50), nullable=True)
    credencial_emissao: Mapped[date | None] = mapped_column(Date, nullable=True)
    credencial_validade: Mapped[date | None] = mapped_column(Date, nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    membro: Mapped["Membro"] = relationship("Membro")

# ── Carteirinha (carteira de membresia com QR-code) ─────────────────────────
class Carteirinha(Base):
    __tablename__ = "carteirinhas"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    membro_id: Mapped[str] = mapped_column(ForeignKey("membros.id"), index=True)
    obreiro_id: Mapped[str | None] = mapped_column(ForeignKey("obreiros.id"), nullable=True)
    qrcode_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    emissao: Mapped[date | None] = mapped_column(Date, nullable=True)
    validade: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="nao_emitida")  # nao_emitida | ativa | vencida
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    membro: Mapped["Membro"] = relationship("Membro")

# ── Patrimônio ───────────────────────────────────────────────────────────────
class Patrimonio(Base):
    __tablename__ = "patrimonio"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    congregacao_id: Mapped[str] = mapped_column(ForeignKey("congregacoes.id"), index=True)
    codigo: Mapped[str | None] = mapped_column(String(50), nullable=True)
    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    descricao: Mapped[str] = mapped_column(String(255))
    valor: Mapped[float] = mapped_column(Float, default=0)
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    localizacao: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

# ── Evento (agenda) ──────────────────────────────────────────────────────────
class Evento(Base):
    __tablename__ = "eventos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    congregacao_id: Mapped[str] = mapped_column(ForeignKey("congregacoes.id"), index=True)
    titulo: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[str] = mapped_column(String(30), default="culto")  # culto | batismo | santa_ceia | congresso | reuniao
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    data_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    local: Mapped[str | None] = mapped_column(String(255), nullable=True)
    responsavel_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # reservado para sincronização futura (fase 2)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

# ── Batismo ──────────────────────────────────────────────────────────────────
class Batismo(Base):
    __tablename__ = "batismos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    congregacao_id: Mapped[str] = mapped_column(ForeignKey("congregacoes.id"), index=True)
    membro_id: Mapped[str] = mapped_column(ForeignKey("membros.id"), index=True)
    data: Mapped[date] = mapped_column(Date)
    local: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pastor_id: Mapped[str | None] = mapped_column(ForeignKey("membros.id"), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    membro: Mapped["Membro"] = relationship("Membro", foreign_keys=[membro_id])
    pastor: Mapped["Membro | None"] = relationship("Membro", foreign_keys=[pastor_id])
