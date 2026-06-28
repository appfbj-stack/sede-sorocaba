from datetime import date, datetime, timedelta, timezone
from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

PERFIS = ["master", "admin", "cliente"]
LICENCA_STATUS = ["teste", "ativo", "suspenso", "expirado"]

class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    configuracoes: Mapped[dict] = mapped_column(JSON, default=dict)
    assistant_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Usuario(Base):
    __tablename__ = "usuarios"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(255))
    senha_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    perfil: Mapped[str] = mapped_column(String(20), default="cliente")
    congregacao_id: Mapped[str | None] = mapped_column(ForeignKey("congregacoes.id"), nullable=True)
    foto_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    ultimo_login_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

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

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expira_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    usado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class Licenca(Base):
    __tablename__ = "licencas"
    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), unique=True, index=True)
    plano: Mapped[str] = mapped_column(String(50), default="trial")
    status: Mapped[str] = mapped_column(String(20), default="teste")
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

class LogAtividade(Base):
    __tablename__ = "logs_atividade"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    usuario_id: Mapped[str | None] = mapped_column(ForeignKey("usuarios.id"), nullable=True)
    acao: Mapped[str] = mapped_column(String(100))
    detalhes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

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
    status: Mapped[str] = mapped_column(String(20), default="ativa")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

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
    status: Mapped[str] = mapped_column(String(20), default="ativo", index=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    consentimento_lgpd: Mapped[bool] = mapped_column(Boolean, default=False)
    data_consentimento: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    anonimizado_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class Obreiro(Base):
    __tablename__ = "obreiros"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    membro_id: Mapped[str] = mapped_column(ForeignKey("membros.id"), index=True)
    congregacao_id: Mapped[str] = mapped_column(ForeignKey("congregacoes.id"), index=True)
    categoria: Mapped[str] = mapped_column(String(30))
    credencial_numero: Mapped[str | None] = mapped_column(String(50), nullable=True)
    credencial_emissao: Mapped[date | None] = mapped_column(Date, nullable=True)
    credencial_validade: Mapped[date | None] = mapped_column(Date, nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    membro: Mapped["Membro"] = relationship("Membro")

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
    status: Mapped[str] = mapped_column(String(20), default="nao_emitida")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    membro: Mapped["Membro"] = relationship("Membro")

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

class Evento(Base):
    __tablename__ = "eventos"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    congregacao_id: Mapped[str] = mapped_column(ForeignKey("congregacoes.id"), index=True)
    titulo: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[str] = mapped_column(String(30), default="culto")
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_inicio: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    data_fim: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    local: Mapped[str | None] = mapped_column(String(255), nullable=True)
    responsavel_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_event_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

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

class ImportacaoLog(Base):
    __tablename__ = "importacoes_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    nome_arquivo: Mapped[str] = mapped_column(String(255))
    formato: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="pendente")
    total_linhas: Mapped[int] = mapped_column(Integer, default=0)
    importados: Mapped[int] = mapped_column(Integer, default=0)
    duplicados: Mapped[int] = mapped_column(Integer, default=0)
    com_erro: Mapped[int] = mapped_column(Integer, default=0)
    mapeamento: Mapped[dict] = mapped_column(JSON, default=dict)
    erros: Mapped[list] = mapped_column(JSON, default=list)
    ids_importados: Mapped[list] = mapped_column(JSON, default=list)
    pode_desfazer: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    concluido_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

class ConversaIA(Base):
    __tablename__ = "conversas_ia"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    titulo: Mapped[str] = mapped_column(String(255), default="Nova conversa")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

class MensagemIA(Base):
    __tablename__ = "mensagens_ia"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversa_id: Mapped[str] = mapped_column(ForeignKey("conversas_ia.id"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text, default="")
    tokens: Mapped[int] = mapped_column(default=0)
    time_saved_seconds: Mapped[int] = mapped_column(default=0)
    model: Mapped[str] = mapped_column(String(100), default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class DocumentoIA(Base):
    __tablename__ = "documentos_ia"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    conversa_id: Mapped[str | None] = mapped_column(ForeignKey("conversas_ia.id"), nullable=True)
    usuario_id: Mapped[str] = mapped_column(ForeignKey("usuarios.id"), index=True)
    nome_original: Mapped[str] = mapped_column(String(255), default="")
    nome_arquivo: Mapped[str] = mapped_column(String(80), default="")
    mime_type: Mapped[str] = mapped_column(String(120), default="")
    tamanho: Mapped[int] = mapped_column(default=0)
    texto_extraido: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class MetricaIA(Base):
    __tablename__ = "metricas_ia"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    data: Mapped[str] = mapped_column(String(10), default="")
    total_conversas: Mapped[int] = mapped_column(default=0)
    total_mensagens: Mapped[int] = mapped_column(default=0)
    total_tokens: Mapped[int] = mapped_column(default=0)
    total_time_saved_seconds: Mapped[int] = mapped_column(default=0)
    total_docs_processed: Mapped[int] = mapped_column(default=0)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class ResumoConversa(Base):
    __tablename__ = "resumos_conversa"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversa_id: Mapped[str] = mapped_column(ForeignKey("conversas_ia.id"), index=True)
    resumo: Mapped[str] = mapped_column(Text, default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Memoria(Base):
    __tablename__ = "memorias"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), index=True)
    conversa_id: Mapped[str] = mapped_column(ForeignKey("conversas_ia.id"), index=True)
    chave: Mapped[str] = mapped_column(String(255), default="")
    valor: Mapped[str] = mapped_column(Text, default="")
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
