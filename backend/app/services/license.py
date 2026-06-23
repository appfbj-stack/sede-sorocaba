from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import Licenca

def get_or_create_licenca(db: Session, tenant_id: int, dias_teste: int) -> Licenca:
    licenca = db.query(Licenca).filter(Licenca.tenant_id == tenant_id).first()
    if licenca:
        return licenca
    from app.models import nova_validade_teste
    licenca = Licenca(tenant_id=tenant_id, plano="trial", status="teste",
                       data_validade=nova_validade_teste(dias_teste))
    db.add(licenca)
    db.commit()
    db.refresh(licenca)
    return licenca

def sincronizar_status(db: Session, licenca: Licenca) -> Licenca:
    """Expira automaticamente a licença local quando a data de validade passou."""
    if licenca.status in ("ativo", "teste") and licenca.expirada():
        licenca.status = "expirado"
        db.commit()
        db.refresh(licenca)
    return licenca
