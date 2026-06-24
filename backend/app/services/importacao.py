import io
import json
import re
import httpx
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models import Congregacao, ImportacaoLog, Membro
from app.utils import new_id, parse_date

CAMPOS_KAIROS = {
    "nome": ["nome", "nome completo", "name", "membro", "pessoa"],
    "cpf": ["cpf", "documento", "doc"],
    "rg": ["rg", "identidade"],
    "data_nascimento": ["data nascimento", "nascimento", "dt nasc", "birth date"],
    "telefone": ["telefone", "fone", "phone", "tel", "celular", "contato"],
    "whatsapp": ["whatsapp", "zap", "wpp"],
    "endereco": ["endereco", "endereço", "address", "rua"],
    "estado_civil": ["estado civil", "civil", "estado_civil"],
    "data_conversao": ["data conversao", "conversao", "dt conversao"],
    "data_batismo": ["data batismo", "batismo", "dt batismo"],
    "cargo": ["cargo", "funcao", "ministerio", "role"],
    "status": ["status", "situacao", "ativo"],
    "observacoes": ["observacoes", "obs", "notas"],
    "congregacao": ["congregacao", "congregação", "igreja", "unidade"],
    "email": ["email", "e-mail"],
}


def normalizar(texto: str) -> str:
    import unicodedata
    texto = str(texto).lower().strip()
    texto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in texto if not unicodedata.combining(c))


def mapear_campos_local(colunas: list) -> dict:
    mapeamento = {}
    for col in colunas:
        col_norm = normalizar(col)
        melhor = None
        for campo_kairos, sinonimos in CAMPOS_KAIROS.items():
            for sin in sinonimos:
                if sin in col_norm or col_norm in sin:
                    melhor = campo_kairos
                    break
            if melhor:
                break
        mapeamento[col] = melhor
    return mapeamento


async def mapear_campos_ia(colunas: list, amostra: list) -> dict:
    if not settings.OPENROUTER_API_KEY:
        return mapear_campos_local(colunas)
    campos_disponiveis = list(CAMPOS_KAIROS.keys())
    prompt = f"""Voce e um especialista em migracao de dados de igrejas.
Mapeie cada coluna para o campo do Kairos ou null se nao corresponder.
Campos do Kairos: {campos_disponiveis}
Colunas: {colunas}
Amostra: {json.dumps(amostra[:2], ensure_ascii=False, default=str)}
Retorne APENAS JSON: {{"coluna": "campo_kairos_ou_null""}}"""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{settings.OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://kairos.app",
                    "X-Title": "Kairos Igreja",
                },
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 512,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                },
            )
            resp.raise_for_status()
            return json.loads(resp.json()["choices"][0]["message"]["content"])
    except Exception:
        return mapear_campos_local(colunas)


def ler_csv(conteudo: bytes) -> tuple:
    import csv, chardet
    encoding = chardet.detect(conteudo)["encoding"] or "utf-8"
    texto = conteudo.decode(encoding, errors="replace")
    reader = csv.DictReader(io.StringIO(texto))
    colunas = list(reader.fieldnames or [])
    linhas = [dict(row) for row in reader]
    return colunas, linhas


def ler_excel(conteudo: bytes) -> tuple:
    import pandas as pd
    df = pd.read_excel(io.BytesIO(conteudo), dtype=str).fillna("")
    return list(df.columns), df.to_dict(orient="records")


def ler_pdf(conteudo: bytes) -> tuple:
    import pdfplumber
    colunas, linhas_todas = [], []
    with pdfplumber.open(io.BytesIO(conteudo)) as pdf:
        for pagina in pdf.pages:
            for tabela in (pagina.extract_tables() or []):
                if not tabela:
                    continue
                if not colunas and tabela[0]:
                    colunas = [str(c).strip() for c in tabela[0] if c]
                for linha in tabela[1:]:
                    if linha and any(c for c in linha if c):
                        row = {colunas[i]: str(linha[i]).strip() if i < len(linha) and linha[i] else "" for i in range(len(colunas))}
                        linhas_todas.append(row)
    return colunas, linhas_todas


def detectar_formato(nome_arquivo: str, content_type: str = "") -> str:
    ext = nome_arquivo.lower().split(".")[-1]
    if ext in ("xlsx", "xls"):
        return "excel"
    if ext == "csv":
        return "csv"
    if ext == "pdf":
        return "pdf"
    if "excel" in content_type or "spreadsheet" in content_type:
        return "excel"
    if "pdf" in content_type:
        return "pdf"
    return "csv"


def detectar_duplicado(dados: dict, tenant_id: int, db: Session) -> Optional[Membro]:
    cpf = dados.get("cpf", "").strip()
    nome = dados.get("nome", "").strip()
    telefone = dados.get("telefone", "").strip()
    data_nasc_str = dados.get("data_nascimento", "")

    if cpf:
        m = db.query(Membro).filter(Membro.tenant_id == tenant_id, Membro.cpf == cpf).first()
        if m:
            return m

    if nome and telefone:
        tel_clean = re.sub(r"\D", "", telefone)
        for m in db.query(Membro).filter(Membro.tenant_id == tenant_id, Membro.nome.ilike(f"%{nome[:10]}%")).all():
            if m.telefone and re.sub(r"\D", "", m.telefone or "")[-8:] == tel_clean[-8:]:
                return m

    if nome and data_nasc_str:
        dn = parse_date(str(data_nasc_str)) if isinstance(data_nasc_str, str) else data_nasc_str
        if dn:
            m = db.query(Membro).filter(
                Membro.tenant_id == tenant_id,
                Membro.nome.ilike(f"%{nome[:15]}%"),
                Membro.data_nascimento == dn,
            ).first()
            if m:
                return m
    return None


def linha_para_membro(linha: dict, mapeamento: dict, congregacao_id: str, tenant_id: int) -> tuple:
    dados = {}
    erros = []
    campo_inv = {v: k for k, v in mapeamento.items() if v}
    for campo in ["nome","cpf","rg","data_nascimento","telefone","whatsapp","endereco","estado_civil","data_conversao","data_batismo","cargo","status","observacoes"]:
        col_orig = campo_inv.get(campo)
        if col_orig and col_orig in linha:
            valor = str(linha[col_orig]).strip()
            if valor and valor.lower() not in ("nan","none","null","-",""):
                dados[campo] = valor
    if not dados.get("nome"):
        erros.append("Nome obrigatorio ausente")
    for campo_data in ("data_nascimento","data_conversao","data_batismo"):
        if campo_data in dados:
            parsed = parse_date(dados[campo_data])
            if parsed:
                dados[campo_data] = parsed
            else:
                del dados[campo_data]
    dados["congregacao_id"] = congregacao_id
    dados["tenant_id"] = tenant_id
    status = dados.get("status","ativo").lower()
    dados["status"] = status if status in ("ativo","inativo","transferido","falecido") else "ativo"
    return dados, erros


def validar_preview(linhas: list, mapeamento: dict, congregacao_id: str, tenant_id: int, db: Session) -> dict:
    validos, com_problema, duplicados_encontrados = [], [], []
    for i, linha in enumerate(linhas):
        dados, erros = linha_para_membro(linha, mapeamento, congregacao_id, tenant_id)
        dup = detectar_duplicado(dados, tenant_id, db)
        if erros:
            com_problema.append({"linha": i+2, "dados": {k:str(v) for k,v in dados.items()}, "erros": erros})
        elif dup:
            duplicados_encontrados.append({"linha": i+2, "dados": {k:str(v) for k,v in dados.items()}, "existente": {"id": dup.id, "nome": dup.nome}, "acao": "ignorar"})
        else:
            validos.append({"linha": i+2, "dados": {k:str(v) for k,v in dados.items()}})
    return {"total":len(linhas),"validos":len(validos),"com_problema":len(com_problema),"duplicados":len(duplicados_encontrados),"preview_validos":validos[:20],"preview_problemas":com_problema[:20],"preview_duplicados":duplicados_encontrados[:20]}


def executar_importacao(linhas:list, mapeamento:dict, congregacao_id:str, tenant_id:int, usuario_id:str, nome_arquivo:str, formato:str, decisoes_duplicados:dict, db:Session) -> dict:
    importados, duplicados, erros, ids_importados = 0, 0, [], []
    log = ImportacaoLog(id=new_id(), tenant_id=tenant_id, usuario_id=usuario_id, nome_arquivo=nome_arquivo, formato=formato, status="processando", total_linhas=len(linhas), mapeamento=mapeamento)
    db.add(log); db.flush()
    for i, linha in enumerate(linhas):
        try:
            dados, erros_linha = linha_para_membro(linha, mapeamento, congregacao_id, tenant_id)
            if erros_linha:
                erros.append({"linha":i+2,"motivo":"; ".join(erros_linha)}); continue
            dup = detectar_duplicado(dados, tenant_id, db)
            decisao = decisoes_duplicados.get(str(i), "ignorar") if dup else None
            if dup and decisao == "ignorar":
                duplicados += 1; continue
            if dup and decisao == "atualizar":
                for campo, valor in dados.items():
                    if campo not in ("id","tenant_id","criado_em") and valor:
                        setattr(dup, campo, valor)
                ids_importados.append(dup.id); importados += 1
            else:
                membro = Membro(id=new_id(), **{k:v for k,v in dados.items()})
                db.add(membro); ids_importados.append(membro.id); importados += 1
        except Exception as e:
            erros.append({"linha":i+2,"motivo":str(e)})
    log.status="concluido"; log.importados=importados; log.duplicados=duplicados
    log.com_erro=len(erros); log.erros=erros; log.ids_importados=ids_importados
    log.concluido_em=datetime.now(timezone.utc)
    db.commit()
    return {"importacao_id":log.id,"total":len(linhas),"importados":importados,"duplicados":duplicados,"com_erro":len(erros),"erros":erros[:50],"mensagem":f"Importacao concluida: {importados} membros importados."}
