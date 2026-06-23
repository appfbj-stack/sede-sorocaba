from app.models import PasswordResetToken
from app.utils import hash_token

def test_forgot_password_nao_revela_email_inexistente(client):
    res = client.post("/api/auth/forgot-password", json={"email": "nao-existe@teste.com"})
    assert res.status_code == 200

def test_fluxo_completo_de_recuperacao(client):
    forgot = client.post("/api/auth/forgot-password", json={"email": "master@teste.com"})
    assert forgot.status_code == 200

    from app.main import SessionLocal
    db = SessionLocal()
    try:
        reset = db.query(PasswordResetToken).order_by(PasswordResetToken.criado_em.desc()).first()
        assert reset is not None
    finally:
        db.close()

    # Como o token original é gerado internamente e só seu hash é persistido,
    # validamos a função de hashing e o endpoint com um token forjado correspondente.
    db = SessionLocal()
    try:
        token_texto = "token-de-teste-1234567890"
        reset.token_hash = hash_token(token_texto)
        db.merge(reset)
        db.commit()
    finally:
        db.close()

    res = client.post("/api/auth/reset-password", json={"token": token_texto, "nova_senha": "nova-senha-segura"})
    assert res.status_code == 200

    login = client.post("/api/auth/login", json={"email": "master@teste.com", "senha": "nova-senha-segura"})
    assert login.status_code == 200

def test_reset_password_token_invalido(client):
    res = client.post("/api/auth/reset-password", json={"token": "invalido", "nova_senha": "qualquer-senha"})
    assert res.status_code == 400
