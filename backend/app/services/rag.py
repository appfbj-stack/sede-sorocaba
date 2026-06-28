import re
from sqlalchemy.orm import Session
from app.models import DocumentoIA

STOPWORDS = {
    "a", "ao", "aos", "aquela", "aquelas", "aquele", "aqueles", "aquilo",
    "as", "até", "com", "como", "da", "das", "de", "dela", "delas",
    "dele", "deles", "depois", "do", "dos", "e", "ela", "elas", "ele",
    "eles", "em", "entre", "era", "eram", "essa", "essas", "esse",
    "esses", "esta", "estas", "este", "estes", "eu", "foi", "foram",
    "há", "isso", "isto", "já", "lhe", "lhes", "mais", "mas", "me",
    "mesmo", "minha", "minhas", "muito", "na", "nas", "não", "nem",
    "no", "nos", "nossa", "nossas", "nosso", "nossos", "num", "numa",
    "o", "os", "ou", "para", "pela", "pelas", "pelo", "pelos", "por",
    "qual", "quando", "que", "quem", "se", "sem", "sua", "suas",
    "seu", "seus", "só", "também", "te", "tem", "tendo", "ter",
    "teu", "teus", "tive", "to", "tu", "tua", "tuas", "um", "uma",
    "umas", "uns", "você", "vocês", "é", "está", "estão", "muito",
    "pode", "podem", "sobre", "ser", "sido", "sendo",
}

def _tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^a-záàâãéèêíïóôõöúç\s]", " ", text)
    tokens = [t for t in text.split() if t not in STOPWORDS and len(t) > 2]
    return tokens

def _overlap_score(query_tokens: list[str], text: str) -> float:
    text_tokens = _tokenize(text)
    if not query_tokens or not text_tokens:
        return 0.0
    matches = sum(1 for t in query_tokens if t in text_tokens)
    return matches / len(query_tokens)

async def build_rag_context(query: str, tenant_id: int, db: Session) -> str:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return ""
    docs = db.query(DocumentoIA).filter(DocumentoIA.tenant_id == tenant_id, DocumentoIA.texto_extraido.isnot(None)).all()
    scored = []
    for doc in docs:
        if doc.texto_extraido:
            score = _overlap_score(query_tokens, doc.texto_extraido)
            if score > 0:
                scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:5]
    if not top:
        return ""
    partes = []
    for score, doc in top:
        excerpt = doc.texto_extraido[:1500] if doc.texto_extraido else ""
        partes.append(f"[{doc.nome_original} | score: {score:.2f}]\n{excerpt}")
    return "\n\n---\n\n".join(partes)

def search_documents_sync(query: str, tenant_id: int, db: Session, limit: int = 4) -> list[dict]:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []
    docs = db.query(DocumentoIA).filter(DocumentoIA.tenant_id == tenant_id, DocumentoIA.texto_extraido.isnot(None)).all()
    scored = []
    for doc in docs:
        if doc.texto_extraido:
            score = _overlap_score(query_tokens, doc.texto_extraido)
            if score > 0:
                scored.append((score, doc))
    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for score, doc in scored[:limit]:
        excerpt = (doc.texto_extraido or "")[:800]
        results.append({"nome": doc.nome_original, "excerpt": excerpt, "relevance": f"{score:.0%}"})
    return results
