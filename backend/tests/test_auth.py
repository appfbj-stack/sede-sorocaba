def test_login_credenciais_invalidas(client):
    res = client.post("/api/auth/login", json={"email": "master@teste.com", "senha": "errada"})
    assert res.status_code == 401

def test_login_sucesso_e_me(client):
    res = client.post("/api/auth/login", json={"email": "master@teste.com", "senha": "senha-master-123"})
    assert res.status_code == 200
    token = res.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "master@teste.com"
    assert me.json()["perfil"] == "master"

def test_acesso_sem_token_eh_negado(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401

def test_logout_revoga_sessao(client, master_token):
    headers = {"Authorization": f"Bearer {master_token}"}
    assert client.get("/api/auth/me", headers=headers).status_code == 200

    logout = client.post("/api/auth/logout", headers=headers)
    assert logout.status_code == 200

    apos_logout = client.get("/api/auth/me", headers=headers)
    assert apos_logout.status_code == 401
