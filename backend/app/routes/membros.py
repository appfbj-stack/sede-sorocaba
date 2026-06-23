import shutil
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user
from app.models import Membro, Usuario
from app.utils import new_id, parse_date

router = APIRouter(prefix="/membros", tags=["membros"])

class MembroOut(BaseModel):
    id: str
    congregacao_id: str
    foto_url: Optional[str]
    nome: str
    cpf: Optional[str]
    rg: Optional[str]
    data_nascimento: Optional[date]
    telefone: Optional[str]
    whatsapp: Optional[str]
    endereco: Optional[str]
    estado_civil: Optional[str]
    data_conversao: Optional[date]
    data_batismo: Optional[date]
    cargo: Optional[str]
    status: str
    observacoes: Optional[str]
    consentimento_lgpd: bool = False
    anonimizado_em: Optional[str] = None
    model_config = {"from_attributes": True}

class MembroLista(BaseModel):
    total: int
    page: int
    limit: int
    dados: list[MembroOut]

def _salvar_foto(foto: Optional[UploadFile]) -> Optional[str]:
    if not foto or not foto.filename:
        return None
    pasta = Path(settings.UPLOAD_DIR) / "membros"
    pasta.mkdir(parents=True, exist_ok=True)
    nome_arquivo = f"{new_id()}{Path(foto.filename).suffix}"
    destino = pasta / nome_arquivo
    with destino.open("wb") as buffer:
        shutil.copyfileobj(foto.file, buffer)
    return f"/uploads/membros/{nome_arquivo}"

@router.get("", response_model=MembroLista)
def listar(busca: str = "", status: str = "", congregacao_id: str = "", page: int = 1, limit: int = 50,
           db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
           cong_filtro: Optional[str] = Depends(congregacao_filter)):
    q = db.query(Membro).filter(Membro.tenant_id == cu.tenant_id)
    if cong_filtro:
        q = q.filter(Membro.congregacao_id == cong_filtro)
    elif congregacao_id:
        q = q.filter(Membro.congregacao_id == congregacao_id)
    if status:
        q = q.filter(Membro.status == status)
    if busca:
        q = q.filter(or_(Membro.nome.ilike(f"%{busca}%"), Membro.cpf.ilike(f"%{busca}%")))
    total = q.count()
    dados = q.order_by(Membro.nome).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "page": page, "limit": limit, "dados": dados}

@router.get("/aniversariantes")
def aniversariantes(periodo: str = "hoje", db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
                     cong_filtro: Optional[str] = Depends(congregacao_filter)):
    from datetime import date as date_, timedelta
    from sqlalchemy import extract

    q = db.query(Membro).filter(Membro.tenant_id == cu.tenant_id, Membro.status == "ativo",
                                 Membro.data_nascimento.isnot(None))
    if cong_filtro:
        q = q.filter(Membro.congregacao_id == cong_filtro)

    hoje = date_.today()
    if periodo == "hoje":
        q = q.filter(extract("month", Membro.data_nascimento) == hoje.month,
                     extract("day", Membro.data_nascimento) == hoje.day)
    elif periodo == "mes":
        q = q.filter(extract("month", Membro.data_nascimento) == hoje.month)
    elif periodo == "semana":
        dias = [(hoje + timedelta(days=i)) for i in range(8)]
        pares = [(d.month, d.day) for d in dias]
        from sqlalchemy import tuple_
        q = q.filter(tuple_(extract("month", Membro.data_nascimento), extract("day", Membro.data_nascimento)).in_(pares))

    membros = q.order_by(extract("month", Membro.data_nascimento), extract("day", Membro.data_nascimento)).all()
    return [
        {"id": m.id, "nome": m.nome, "data_nascimento": m.data_nascimento, "congregacao_id": m.congregacao_id,
         "foto_url": m.foto_url, "telefone": m.telefone, "whatsapp": m.whatsapp}
        for m in membros
    ]

@router.get("/{membro_id}", response_model=MembroOut)
def obter(membro_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
          cong_filtro: Optional[str] = Depends(congregacao_filter)):
    m = db.query(Membro).filter(Membro.id == membro_id, Membro.tenant_id == cu.tenant_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if cong_filtro and m.congregacao_id != cong_filtro:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return m

@router.post("", response_model=MembroOut, status_code=201)
def criar(
    nome: str = Form(...), cpf: str = Form(None), rg: str = Form(None),
    data_nascimento: str = Form(None), telefone: str = Form(None), whatsapp: str = Form(None),
    endereco: str = Form(None), estado_civil: str = Form(None), data_conversao: str = Form(None),
    data_batismo: str = Form(None), cargo: str = Form(None), status: str = Form("ativo"),
    observacoes: str = Form(None), congregacao_id: str = Form(None), foto: UploadFile = File(None),
    consentimento_lgpd: bool = Form(False),
    db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
    cong_filtro: Optional[str] = Depends(congregacao_filter),
):
    cong_id = cong_filtro or congregacao_id
    if not cong_id:
        raise HTTPException(status_code=400, detail="congregacao_id obrigatório")
    membro = Membro(
        id=new_id(), tenant_id=cu.tenant_id, congregacao_id=cong_id, foto_url=_salvar_foto(foto),
        nome=nome, cpf=cpf, rg=rg, data_nascimento=parse_date(data_nascimento), telefone=telefone,
        whatsapp=whatsapp, endereco=endereco, estado_civil=estado_civil,
        data_conversao=parse_date(data_conversao), data_batismo=parse_date(data_batismo),
        cargo=cargo, status=status, observacoes=observacoes,
        consentimento_lgpd=consentimento_lgpd,
        data_consentimento=datetime.now(timezone.utc) if consentimento_lgpd else None,
    )
    db.add(membro); db.commit(); db.refresh(membro)
    return membro

@router.put("/{membro_id}", response_model=MembroOut)
def atualizar(
    membro_id: str,
    nome: str = Form(...), cpf: str = Form(None), rg: str = Form(None),
    data_nascimento: str = Form(None), telefone: str = Form(None), whatsapp: str = Form(None),
    endereco: str = Form(None), estado_civil: str = Form(None), data_conversao: str = Form(None),
    data_batismo: str = Form(None), cargo: str = Form(None), status: str = Form("ativo"),
    observacoes: str = Form(None), foto: UploadFile = File(None),
    db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
    cong_filtro: Optional[str] = Depends(congregacao_filter),
):
    membro = db.query(Membro).filter(Membro.id == membro_id, Membro.tenant_id == cu.tenant_id).first()
    if not membro:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if cong_filtro and membro.congregacao_id != cong_filtro:
        raise HTTPException(status_code=403, detail="Acesso negado")

    foto_url = _salvar_foto(foto)
    membro.nome = nome
    membro.cpf = cpf
    membro.rg = rg
    membro.data_nascimento = parse_date(data_nascimento)
    membro.telefone = telefone
    membro.whatsapp = whatsapp
    membro.endereco = endereco
    membro.estado_civil = estado_civil
    membro.data_conversao = parse_date(data_conversao)
    membro.data_batismo = parse_date(data_batismo)
    membro.cargo = cargo
    membro.status = status
    membro.observacoes = observacoes
    if foto_url:
        membro.foto_url = foto_url
    db.commit(); db.refresh(membro)
    return membro

@router.delete("/{membro_id}")
def remover(membro_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
            cong_filtro: Optional[str] = Depends(congregacao_filter)):
    membro = db.query(Membro).filter(Membro.id == membro_id, Membro.tenant_id == cu.tenant_id).first()
    if not membro:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if cong_filtro and membro.congregacao_id != cong_filtro:
        raise HTTPException(status_code=403, detail="Acesso negado")
    db.delete(membro); db.commit()
    return {"ok": True}

@router.get("/{membro_id}/exportar-dados")
def exportar_dados(membro_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
                   cong_filtro: Optional[str] = Depends(congregacao_filter)):
    m = db.query(Membro).filter(Membro.id == membro_id, Membro.tenant_id == cu.tenant_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if cong_filtro and m.congregacao_id != cong_filtro:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return {
        "exportado_em": datetime.now(timezone.utc).isoformat(),
        "dados_pessoais": {
            "nome": m.nome,
            "cpf": m.cpf,
            "rg": m.rg,
            "data_nascimento": str(m.data_nascimento) if m.data_nascimento else None,
            "telefone": m.telefone,
            "whatsapp": m.whatsapp,
            "endereco": m.endereco,
            "estado_civil": m.estado_civil,
            "foto_url": m.foto_url,
        },
        "dados_religiosos": {
            "data_conversao": str(m.data_conversao) if m.data_conversao else None,
            "data_batismo": str(m.data_batismo) if m.data_batismo else None,
            "cargo": m.cargo,
            "status": m.status,
        },
        "consentimento_lgpd": m.consentimento_lgpd,
        "data_consentimento": str(m.data_consentimento) if m.data_consentimento else None,
        "criado_em": str(m.criado_em),
        "atualizado_em": str(m.atualizado_em),
    }

@router.post("/{membro_id}/anonimizar")
def anonimizar(membro_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
               cong_filtro: Optional[str] = Depends(congregacao_filter)):
    m = db.query(Membro).filter(Membro.id == membro_id, Membro.tenant_id == cu.tenant_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Não encontrado")
    if cong_filtro and m.congregacao_id != cong_filtro:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if m.anonimizado_em:
        raise HTTPException(status_code=400, detail="Dados já anonimizados")
    m.nome = "[Anonimizado]"
    m.cpf = None
    m.rg = None
    m.data_nascimento = None
    m.telefone = None
    m.whatsapp = None
    m.endereco = None
    m.estado_civil = None
    m.foto_url = None
    m.data_conversao = None
    m.data_batismo = None
    m.observacoes = None
    m.anonimizado_em = datetime.now(timezone.utc)
    m.consentimento_lgpd = False
    db.commit(); db.refresh(m)
    return {"ok": True, "mensagem": "Dados pessoais anonimizados conforme LGPD (Art. 16)"}
