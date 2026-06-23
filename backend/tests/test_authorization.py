def _criar_congregacao(client, master_token, nome="Congregação Teste"):
    headers = {"Authorization": f"Bearer {master_token}"}
    res = client.post("/api/congregacoes", json={"nome": nome}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()

def _criar_usuario_cliente(client, master_token):
    headers = {"Authorization": f"Bearer {master_token}"}
    congregacao = _criar_congregacao(client, master_token)
    res = client.post("/api/usuarios", json={
        "email": "cliente@teste.com", "nome": "Cliente Teste", "perfil": "cliente",
        "senha": "senha-cliente-123", "congregacao_id": congregacao["id"],
    }, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()

def _login(client, email, senha):
    res = client.post("/api/auth/login", json={"email": email, "senha": senha})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]

def test_cliente_nao_acessa_rotas_admin(client, master_token):
    _criar_usuario_cliente(client, master_token)
    cliente_token = _login(client, "cliente@teste.com", "senha-cliente-123")
    headers = {"Authorization": f"Bearer {cliente_token}"}

    assert client.get("/api/usuarios", headers=headers).status_code == 403
    assert client.get("/api/admin/logs", headers=headers).status_code == 403
    assert client.get("/api/master/licenca", headers=headers).status_code == 403

def test_master_acessa_admin_e_master(client, master_token):
    headers = {"Authorization": f"Bearer {master_token}"}
    assert client.get("/api/usuarios", headers=headers).status_code == 200
    assert client.get("/api/admin/logs", headers=headers).status_code == 200
    assert client.get("/api/master/licenca", headers=headers).status_code == 200

def test_cliente_nao_pode_se_promover_a_master(client, master_token):
    cliente = _criar_usuario_cliente(client, master_token)
    cliente_token = _login(client, "cliente@teste.com", "senha-cliente-123")
    headers = {"Authorization": f"Bearer {cliente_token}"}

    res = client.put(f"/api/usuarios/{cliente['id']}", json={
        "nome": "Cliente Teste", "perfil": "master", "ativo": True,
    }, headers=headers)
    assert res.status_code == 403
