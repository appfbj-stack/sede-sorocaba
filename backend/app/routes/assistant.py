import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.core.config import settings
from app.core.roles import is_staff, is_admin
from app.deps import get_current_user
from app.models import Tenant, Usuario, ConversaIA, MensagemIA, DocumentoIA, MetricaIA
from app.services.llm import chat_completion, estimate_time_saved
from app.services.ocr import extract_text, save_upload
from app.services.rag import build_rag_context, search_documents_sync
from app.services.tools import ToolContext, get_tool_defs, execute_tool
from app.services.memory import search_memories, get_conversa_summary, summarize_conversation, extract_facts

router = APIRouter(prefix="/assistant", tags=["assistente"])

class ConversaCreate(BaseModel):
    titulo: str = "Nova conversa"

class MessageIn(BaseModel):
    conversa_id: str
    content: str

class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    time_saved_seconds: int = 0
    created_at: str
    model_config = {"from_attributes": True}

class ConversaOut(BaseModel):
    id: str
    titulo: str
    usuario_id: str
    created_at: str
    updated_at: str
    model_config = {"from_attributes": True}

class ConversaDetailOut(ConversaOut):
    mensagens: list[MessageOut] = []

class MetricsOut(BaseModel):
    total_conversas: int
    total_mensagens: int
    total_tokens: int
    total_time_saved_hours: float
    time_saved_today_seconds: int = 0
    time_saved_week_seconds: int = 0
    time_saved_month_seconds: int = 0
    indice_kairos: float
    indice_nivel: str = "iniciante"
    total_docs_processed: int = 0
    mensagem_motivacional: str = ""

def _dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")

def _update_metrics(tenant_id: int, db: Session, delta_conversas: int = 0, delta_mensagens: int = 0, delta_tokens: int = 0, delta_time: int = 0, delta_docs: int = 0):
    today = _today()
    metrica = db.query(MetricaIA).filter(MetricaIA.tenant_id == tenant_id, MetricaIA.data == today).first()
    if not metrica:
        metrica = MetricaIA(
            id=str(uuid.uuid4()), tenant_id=tenant_id, data=today,
            total_conversas=0, total_mensagens=0, total_tokens=0,
            total_time_saved_seconds=0, total_docs_processed=0,
        )
        db.add(metrica)
    metrica.total_conversas += delta_conversas
    metrica.total_mensagens += delta_mensagens
    metrica.total_tokens += delta_tokens
    metrica.total_time_saved_seconds += delta_time
    metrica.total_docs_processed += delta_docs
    db.commit()

@router.get("/conversas", response_model=list[ConversaOut])
def list_conversas(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    q = db.query(ConversaIA).filter(ConversaIA.tenant_id == cu.tenant_id)
    if not is_admin(cu.perfil):
        q = q.filter(ConversaIA.usuario_id == cu.id)
    return q.order_by(ConversaIA.atualizado_em.desc()).all()

@router.post("/conversas", response_model=ConversaOut, status_code=201)
def create_conversa(payload: ConversaCreate, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    if not is_staff(cu.perfil):
        raise HTTPException(status_code=403, detail="Acesso nao permitido")
    conversa = ConversaIA(id=str(uuid.uuid4()), tenant_id=cu.tenant_id, usuario_id=cu.id, titulo=payload.titulo)
    db.add(conversa)
    _update_metrics(cu.tenant_id, db, delta_conversas=1)
    return conversa

@router.get("/conversas/{conversa_id}", response_model=ConversaDetailOut)
def get_conversa(conversa_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    conv = db.query(ConversaIA).filter(ConversaIA.id == conversa_id, ConversaIA.tenant_id == cu.tenant_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    msgs = db.query(MensagemIA).filter(MensagemIA.conversa_id == conversa_id).order_by(MensagemIA.criado_em).all()
    return ConversaDetailOut(
        id=conv.id, titulo=conv.titulo, usuario_id=conv.usuario_id,
        created_at=_dt(conv.created_at), updated_at=_dt(conv.atualizado_em),
        mensagens=[MessageOut(id=m.id, role=m.role, content=m.content,
            time_saved_seconds=m.time_saved_seconds, created_at=_dt(m.criado_em)) for m in msgs],
    )

@router.delete("/conversas/{conversa_id}", status_code=204)
def delete_conversa(conversa_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    if not is_staff(cu.perfil):
        raise HTTPException(status_code=403, detail="Acesso nao permitido")
    conv = db.query(ConversaIA).filter(ConversaIA.id == conversa_id, ConversaIA.tenant_id == cu.tenant_id).first()
    if conv:
        db.query(MensagemIA).filter(MensagemIA.conversa_id == conversa_id).delete()
        db.delete(conv)
        db.commit()

@router.post("/chat", response_model=MessageOut)
async def chat(payload: MessageIn, background_tasks: BackgroundTasks, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    if not is_staff(cu.perfil):
        raise HTTPException(status_code=403, detail="Acesso nao permitido")
    conv = db.query(ConversaIA).filter(ConversaIA.id == payload.conversa_id, ConversaIA.tenant_id == cu.tenant_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")

    history = db.query(MensagemIA).filter(MensagemIA.conversa_id == payload.conversa_id).order_by(MensagemIA.criado_em).all()
    messages = [{"role": m.role, "content": m.content} for m in history]

    rag_context = await build_rag_context(payload.content, cu.tenant_id, db)
    if rag_context:
        messages.append({
            "role": "system",
            "content": (
                "A igreja possui os seguintes documentos cadastrados. Use como fonte "
                "de informacao quando relevante, citando o nome do documento:\n\n" + rag_context
            ),
        })

    resumo = get_conversa_summary(payload.conversa_id, db)
    if resumo:
        messages.append({
            "role": "system",
            "content": "Resumo do historico desta conversa:\n\n" + resumo,
        })

    memorias = search_memories(cu.tenant_id, payload.content, db)
    if memorias:
        messages.append({
            "role": "system",
            "content": "Fatos de conversas anteriores:\n\n" + memorias,
        })

    messages.append({"role": "user", "content": payload.content})

    user_msg = MensagemIA(id=str(uuid.uuid4()), conversa_id=payload.conversa_id, role="user", content=payload.content)
    db.add(user_msg)

    tenant = db.query(Tenant).filter(Tenant.id == cu.tenant_id).first()
    tenant_context = tenant.assistant_context if tenant else None

    tool_defs = get_tool_defs()
    tool_ctx = ToolContext(db=db, tenant_id=cu.tenant_id, usuario_id=cu.id, perfil=cu.perfil)

    def _executor(name: str, args: dict) -> str:
        return execute_tool(name, args, tool_ctx)

    try:
        content, prompt_tokens, completion_tokens = await chat_completion(
            messages,
            tenant_context=tenant_context,
            tools=tool_defs or None,
            tool_executor=_executor if tool_defs else None,
        )
        total_tokens = prompt_tokens + completion_tokens
        time_saved = estimate_time_saved(content)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Erro ao contactar IA: {e}")

    assistant_msg = MensagemIA(id=str(uuid.uuid4()), conversa_id=payload.conversa_id, role="assistant",
        content=content, tokens=total_tokens, time_saved_seconds=time_saved, model=settings.OPENROUTER_MODEL)
    db.add(assistant_msg)

    conv.titulo = conv.titulo if conv.titulo != "Nova conversa" else payload.content[:80]
    _update_metrics(cu.tenant_id, db, delta_mensagens=2, delta_tokens=total_tokens, delta_time=time_saved)
    db.commit()

    background_tasks.add_task(_run_extract_facts, cu.tenant_id, payload.conversa_id, payload.content, content)
    background_tasks.add_task(_run_summarize, payload.conversa_id)

    return MessageOut(id=assistant_msg.id, role="assistant", content=content,
        time_saved_seconds=time_saved, created_at=_dt(assistant_msg.criado_em))

@router.post("/upload")
async def upload_document(file: UploadFile = File(...), conversa_id: Optional[str] = Form(None),
    db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    if not is_staff(cu.perfil):
        raise HTTPException(status_code=403, detail="Acesso nao permitido")
    storage_dir = f"{settings.STORAGE_DIR}/ia"
    file_data = await file.read()
    file_path, unique_name = await save_upload(file_data, file.filename or "documento", storage_dir)
    texto_extraido = await extract_text(file_path, file.content_type or "")
    doc = DocumentoIA(id=str(uuid.uuid4()), tenant_id=cu.tenant_id, conversa_id=conversa_id, usuario_id=cu.id,
        nome_original=file.filename or "documento", nome_arquivo=unique_name, mime_type=file.content_type or "",
        tamanho=len(file_data), texto_extraido=texto_extraido)
    db.add(doc)
    _update_metrics(cu.tenant_id, db, delta_docs=1)
    db.commit()
    return {"id": doc.id, "nome": doc.nome_original, "texto_extraido": (texto_extraido[:1000] if texto_extraido else ""), "tamanho": doc.tamanho}

@router.get("/metrics", response_model=MetricsOut)
def get_metrics(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    today = _today()
    q = db.query(MetricaIA).filter(MetricaIA.tenant_id == cu.tenant_id)
    all_metrics = q.all()
    total = MetricsOut(total_conversas=0, total_mensagens=0, total_tokens=0, total_time_saved_hours=0, indice_kairos=0)
    today_sec = 0; week_sec = 0; month_sec = 0; total_docs = 0
    for m in all_metrics:
        total.total_conversas += m.total_conversas
        total.total_mensagens += m.total_mensagens
        total.total_tokens += m.total_tokens
        total.total_time_saved_hours += m.total_time_saved_seconds / 3600
        total_docs += m.total_docs_processed
        if m.data == today:
            today_sec += m.total_time_saved_seconds
        try:
            d = datetime.strptime(m.data, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        from datetime import timedelta, date as dt_date
        today_date = dt_date.today()
        if today_date - d <= timedelta(days=7):
            week_sec += m.total_time_saved_seconds
        if today_date - d <= timedelta(days=30):
            month_sec += m.total_time_saved_seconds
    total.time_saved_today_seconds = today_sec
    total.time_saved_week_seconds = week_sec
    total.time_saved_month_seconds = month_sec
    total.total_docs_processed = total_docs
    score_msg = min(total.total_mensagens / max(total.total_conversas, 1), 20) * 2
    score_time = min(total.total_time_saved_hours * 5, 40)
    score_docs = min(total_docs * 10, 20)
    score_tokens = min(total.total_tokens / max(total.total_mensagens, 1) / 50, 20)
    total.indice_kairos = round(min(score_msg + score_time + score_docs + score_tokens, 100), 1)
    if total.indice_kairos >= 71:
        total.indice_nivel = "avancado"
        total.mensagem_motivacional = "Excelente! Voce esta dominando o Kairos Assistente."
    elif total.indice_kairos >= 31:
        total.indice_nivel = "intermediario"
        total.mensagem_motivacional = "Bom progresso! Quanto mais usar, mais tempo economiza."
    else:
        total.indice_nivel = "iniciante"
        total.mensagem_motivacional = "Comece uma conversa e descubra como economizar tempo hoje!"
    return total

def _run_extract_facts(tenant_id: int, conversa_id: str, user_msg: str, assistant_msg: str):
    try:
        db = SessionLocal()
        import asyncio
        asyncio.run(extract_facts(tenant_id, conversa_id, user_msg, assistant_msg, db))
        db.close()
    except Exception:
        pass

def _run_summarize(conversa_id: str):
    try:
        db = SessionLocal()
        import asyncio
        asyncio.run(summarize_conversation(conversa_id, db))
        db.close()
    except Exception:
        pass
