from datetime import datetime, timedelta, timezone


def test_licenca_inicial_eh_teste(client, master_token):
    headers = {"Authorization": f"Bearer {master_token}"}
    res = client.get("/api/master/licenca", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "teste"

def test_atualizar_licenca_para_ativo(client, master_token):
    headers = {"Authorization": f"Bearer {master_token}"}
    res = client.put("/api/master/licenca", json={"status": "ativo", "plano": "pro"}, headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "ativo"
    assert res.json()["plano"] == "pro"

def test_licenca_expirada_bloqueia_acesso(client, master_token):
    headers = {"Authorization": f"Bearer {master_token}"}
    passado = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    client.put("/api/master/licenca", json={"status": "ativo", "data_validade": passado}, headers=headers)

    from app.main import SessionLocal
    from app.models import Licenca
    from app.services.license import sincronizar_status

    db = SessionLocal()
    try:
        licenca = db.query(Licenca).first()
        licenca = sincronizar_status(db, licenca)
        assert licenca.status == "expirado"
        assert licenca.acesso_liberado() is False
    finally:
        db.close()
