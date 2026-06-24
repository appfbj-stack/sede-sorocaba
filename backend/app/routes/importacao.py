from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.deps import get_current_user, log_activity, require_admin
from app.models import Congregacao, ImportacaoLog, Membro, Usuario
from app.services.importacao import (
    detectar_formato, executar_importacao, ler_csv, ler_excel, ler_pdf,
    mapear_campos_ia, validar_preview,
)
from app.utils import new_id

router = APIRouter(prefix="/importacao", tags=["importacao"])


class ConfirmarMapeamentoIn(BaseModel):
    sessao_id: str
    mapeamento: dict
    congregacao_id: str


class ExecutarImportacaoIn(BaseModel):
    sessao_id: str
    mapeamento: dict
    congregacao_id: str
    decisoes_duplicados: dict = {}


# Armazena sessoes temporarias de importacao em memoria
_sessoes: dict = {}


@router.post("/analisar")
async def analisar(
    arquivo: UploadFile = File(...),
    congregacao_id: str = Form(...),
    db: Session = Depends(get_db),
    cu: Usuario = Depends(require_admin),
):
    conteudo = await arquivo.read()
    if len(conteudo) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Maximo 20MB.")

    formato = detectar_formato(arquivo.filename or "", arquivo.content_type or "")

    try:
        if formato == "excel":
            colunas, linhas = ler_excel(conteudo)
        elif formato == "pdf":
            colunas, linhas = ler_pdf(conteudo)
        else:
            colunas, linhas = ler_csv(conteudo)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler arquivo: {str(e)}")

    if not linhas:
        raise HTTPException(status_code=400, detail="Arquivo vazio ou sem dados reconheciveis.")

    mapeamento = await mapear_campos_ia(colunas, linhas[:5])

    cong = db.query(Congregacao).filter(
        Congregacao.id == congregacao_id, Congregacao.tenant_id == cu.tenant_id
    ).first()
    if not cong:
        raise HTTPException(status_code=404, detail="Congregacao nao encontrada.")

    sessao_id = new_id()
    _sessoes[sessao_id] = {
        "linhas": linhas,
        "colunas": colunas,
        "mapeamento": mapeamento,
        "congregacao_id": congregacao_id,
        "nome_arquivo": arquivo.filename,
        "formato": formato,
        "tenant_id": cu.tenant_id,
        "usuario_id": cu.id,
    }

    return {
        "sessao_id": sessao_id,
        "total_linhas": len(linhas),
        "colunas": colunas,
        "mapeamento_sugerido": mapeamento,
        "amostra": linhas[:5],
        "formato": formato,
        "congregacao": {"id": cong.id, "nome": cong.nome},
    }


@router.post("/preview")
def preview(
    payload: ConfirmarMapeamentoIn,
    db: Session = Depends(get_db),
    cu: Usuario = Depends(require_admin),
):
    sessao = _sessoes.get(payload.sessao_id)
    if not sessao or sessao["tenant_id"] != cu.tenant_id:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada ou expirada.")

    sessao["mapeamento"] = payload.mapeamento
    sessao["congregacao_id"] = payload.congregacao_id

    resultado = validar_preview(
        sessao["linhas"],
        payload.mapeamento,
        payload.congregacao_id,
        cu.tenant_id,
        db,
    )
    return resultado


@router.post("/executar")
def executar(
    payload: ExecutarImportacaoIn,
    db: Session = Depends(get_db),
    cu: Usuario = Depends(require_admin),
):
    sessao = _sessoes.get(payload.sessao_id)
    if not sessao or sessao["tenant_id"] != cu.tenant_id:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada ou expirada.")

    resultado = executar_importacao(
        linhas=sessao["linhas"],
        mapeamento=payload.mapeamento,
        congregacao_id=payload.congregacao_id,
        tenant_id=cu.tenant_id,
        usuario_id=cu.id,
        nome_arquivo=sessao.get("nome_arquivo", "arquivo"),
        formato=sessao.get("formato", "csv"),
        decisoes_duplicados=payload.decisoes_duplicados,
        db=db,
    )

    _sessoes.pop(payload.sessao_id, None)
    log_activity(db, cu.tenant_id, cu.id, "importacao.executar",
                 f"Importou {resultado['importados']} membros de {sessao.get('nome_arquivo','')}")
    return resultado


@router.get("/historico")
def historico(
    db: Session = Depends(get_db),
    cu: Usuario = Depends(require_admin),
):
    logs = db.query(ImportacaoLog).filter(
        ImportacaoLog.tenant_id == cu.tenant_id
    ).order_by(ImportacaoLog.criado_em.desc()).limit(20).all()

    return [
        {
            "id": log.id,
            "nome_arquivo": log.nome_arquivo,
            "formato": log.formato,
            "status": log.status,
            "total_linhas": log.total_linhas,
            "importados": log.importados,
            "duplicados": log.duplicados,
            "com_erro": log.com_erro,
            "pode_desfazer": log.pode_desfazer,
            "criado_em": log.criado_em,
            "concluido_em": log.concluido_em,
        }
        for log in logs
    ]


@router.post("/desfazer/{importacao_id}")
def desfazer(
    importacao_id: str,
    db: Session = Depends(get_db),
    cu: Usuario = Depends(require_admin),
):
    log = db.query(ImportacaoLog).filter(
        ImportacaoLog.id == importacao_id,
        ImportacaoLog.tenant_id == cu.tenant_id,
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Importacao nao encontrada.")
    if not log.pode_desfazer:
        raise HTTPException(status_code=400, detail="Esta importacao nao pode mais ser desfeita.")
    if not log.ids_importados:
        raise HTTPException(status_code=400, detail="Nenhum membro para remover.")

    removidos = 0
    for membro_id in log.ids_importados:
        m = db.query(Membro).filter(
            Membro.id == membro_id, Membro.tenant_id == cu.tenant_id
        ).first()
        if m:
            db.delete(m)
            removidos += 1

    log.pode_desfazer = False
    db.commit()

    log_activity(db, cu.tenant_id, cu.id, "importacao.desfazer",
                 f"Desfez importacao {importacao_id}: {removidos} membros removidos")

    return {"ok": True, "removidos": removidos, "mensagem": f"{removidos} membros removidos com sucesso."}
