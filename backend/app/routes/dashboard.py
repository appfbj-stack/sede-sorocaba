from collections import Counter
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import extract
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.deps import congregacao_filter, get_current_user
from app.models import Carteirinha, Congregacao, Evento, Membro, Obreiro, Patrimonio, Usuario

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("")
def stats(db: Session = Depends(get_db), cu: Usuario = Depends(get_current_user),
          cong_filtro: Optional[str] = Depends(congregacao_filter)):
    tenant_id = cu.tenant_id
    hoje = date.today()

    def membros_q():
        q = db.query(Membro).filter(Membro.tenant_id == tenant_id)
        return q.filter(Membro.congregacao_id == cong_filtro) if cong_filtro else q

    def obreiros_q():
        q = db.query(Obreiro).filter(Obreiro.tenant_id == tenant_id, Obreiro.ativo.is_(True))
        return q.filter(Obreiro.congregacao_id == cong_filtro) if cong_filtro else q

    def patrimonio_q():
        q = db.query(Patrimonio).filter(Patrimonio.tenant_id == tenant_id, Patrimonio.ativo.is_(True))
        return q.filter(Patrimonio.congregacao_id == cong_filtro) if cong_filtro else q

    def eventos_q():
        q = db.query(Evento).filter(Evento.tenant_id == tenant_id)
        return q.filter(Evento.congregacao_id == cong_filtro) if cong_filtro else q

    congregacoes_count = (
        db.query(Congregacao).filter(Congregacao.tenant_id == tenant_id, Congregacao.status == "ativa").count()
        if cu.perfil == "sede" else 1
    )

    aniversariantes_hoje_q = membros_q().filter(
        Membro.status == "ativo", Membro.data_nascimento.isnot(None),
        extract("month", Membro.data_nascimento) == hoje.month,
        extract("day", Membro.data_nascimento) == hoje.day,
    )
    lista_aniversariantes = aniversariantes_hoje_q.order_by(Membro.nome).limit(10).all()

    carteirinhas_q = db.query(Carteirinha).join(Membro, Carteirinha.membro_id == Membro.id).filter(
        Carteirinha.tenant_id == tenant_id, Carteirinha.status == "vencida")
    if cong_filtro:
        carteirinhas_q = carteirinhas_q.filter(Membro.congregacao_id == cong_filtro)

    datas_criacao = [c for (c,) in membros_q().with_entities(Membro.criado_em).all() if c]
    contagem_mensal = Counter(f"{c.year:04d}-{c.month:02d}" for c in datas_criacao)
    meses_ordenados = sorted(contagem_mensal)[-6:]
    crescimento = [{"mes": mes, "total": contagem_mensal[mes]} for mes in meses_ordenados]

    return {
        "congregacoes": congregacoes_count,
        "total_membros": membros_q().count(),
        "membros_ativos": membros_q().filter(Membro.status == "ativo").count(),
        "membros_inativos": membros_q().filter(Membro.status == "inativo").count(),
        "batizados": membros_q().filter(Membro.data_batismo.isnot(None)).count(),
        "nao_batizados": membros_q().filter(Membro.data_batismo.is_(None), Membro.status == "ativo").count(),
        "total_obreiros": obreiros_q().count(),
        "credenciais_vencidas": obreiros_q().filter(Obreiro.credencial_validade < hoje).count(),
        "carteirinhas_vencidas": carteirinhas_q.count(),
        "total_patrimonio": patrimonio_q().count(),
        "aniversariantes_hoje": aniversariantes_hoje_q.count(),
        "aniversariantes_mes": membros_q().filter(
            Membro.status == "ativo", Membro.data_nascimento.isnot(None),
            extract("month", Membro.data_nascimento) == hoje.month,
        ).count(),
        "eventos_proximos": eventos_q().filter(
            Evento.data_inicio >= hoje, Evento.data_inicio <= hoje + timedelta(days=30),
        ).count(),
        "lista_aniversariantes_hoje": [
            {"id": m.id, "nome": m.nome, "data_nascimento": m.data_nascimento, "foto_url": m.foto_url,
             "congregacao_id": m.congregacao_id} for m in lista_aniversariantes
        ],
        "crescimento": crescimento,
    }
