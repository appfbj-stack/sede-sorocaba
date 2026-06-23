import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user
from app.models import Patrimonio, Usuario
from app.utils import new_id

router = APIRouter(prefix="/patrimonio", tags=["patrimonio"])

class PatrimonioOut(BaseModel):
    id: str
    congregacao_id: str
    codigo: Optional[str]
    categoria: Optional[str]
    descricao: str
    valor: float
    foto_url: Optional[str]
    localizacao: Optional[str]
    ativo: bool
    model_config = {"from_attributes": True}

def _salvar_foto(foto: Optional[UploadFile]) -> Optional[str]:
    if not foto or not foto.filename:
        return None
    pasta = Path(settings.UPLOAD_DIR) / "patrimonio"
    pasta.mkdir(parents=True, exist_ok=True)
    nome_arquivo = f"{new_id()}{Path(foto.filename).suffix}"
    destino = pasta / nome_arquivo
    with destino.open("wb") as buffer:
        shutil.copyfileobj(foto.file, buffer)
    return f"/uploads/patrimonio/{nome_arquivo}"

@router.get("", response_model=list[PatrimonioOut])
def listar(categoria: str = "", db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
           cong_filtro: Optional[str] = Depends(congregacao_filter)):
    q = db.query(Patrimonio).filter(Patrimonio.tenant_id == cu.tenant_id, Patrimonio.ativo.is_(True))
    if cong_filtro:
        q = q.filter(Patrimonio.congregacao_id == cong_filtro)
    if categoria:
        q = q.filter(Patrimonio.categoria == categoria)
    return q.order_by(Patrimonio.descricao).all()

@router.post("", response_model=PatrimonioOut, status_code=201)
def criar(
    descricao: str = Form(...), codigo: str = Form(None), categoria: str = Form(None),
    valor: str = Form(None), localizacao: str = Form(None), congregacao_id: str = Form(None),
    foto: UploadFile = File(None), db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
    cong_filtro: Optional[str] = Depends(congregacao_filter),
):
    cong_id = cong_filtro or congregacao_id
    if not cong_id:
        raise HTTPException(status_code=400, detail="congregacao_id obrigatório")
    item = Patrimonio(
        id=new_id(), tenant_id=cu.tenant_id, congregacao_id=cong_id, codigo=codigo, categoria=categoria,
        descricao=descricao, valor=float(valor) if valor else 0, foto_url=_salvar_foto(foto),
        localizacao=localizacao, ativo=True,
    )
    db.add(item); db.commit(); db.refresh(item)
    return item

@router.put("/{item_id}", response_model=PatrimonioOut)
def atualizar(
    item_id: str, descricao: str = Form(...), codigo: str = Form(None), categoria: str = Form(None),
    valor: str = Form(None), localizacao: str = Form(None), foto: UploadFile = File(None),
    db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
):
    item = db.query(Patrimonio).filter(Patrimonio.id == item_id, Patrimonio.tenant_id == cu.tenant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Não encontrado")
    foto_url = _salvar_foto(foto)
    item.descricao = descricao
    item.codigo = codigo
    item.categoria = categoria
    item.valor = float(valor) if valor else 0
    item.localizacao = localizacao
    if foto_url:
        item.foto_url = foto_url
    db.commit(); db.refresh(item)
    return item

@router.put("/{item_id}/desativar", response_model=PatrimonioOut)
def desativar(item_id: str, db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user)):
    item = db.query(Patrimonio).filter(Patrimonio.id == item_id, Patrimonio.tenant_id == cu.tenant_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Não encontrado")
    item.ativo = False
    db.commit(); db.refresh(item)
    return item
