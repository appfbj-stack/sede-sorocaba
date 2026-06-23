def _login(client, email, senha):
    res = client.post("/api/auth/login", json={"email": email, "senha": senha})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]

def _criar_congregacao(client, token, nome):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post("/api/congregacoes", json={"nome": nome}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()

def _criar_cliente(client, master_token, congregacao_id, email):
    headers = {"Authorization": f"Bearer {master_token}"}
    res = client.post("/api/usuarios", json={
        "email": email, "nome": email, "perfil": "cliente",
        "senha": "senha-123456", "congregacao_id": congregacao_id,
    }, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()

def _criar_membro(client, token, congregacao_id, nome):
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post("/api/membros", data={"nome": nome, "congregacao_id": congregacao_id}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()

def test_admin_cria_congregacao(client, master_token):
    cong = _criar_congregacao(client, master_token, "Congregação Centro")
    assert cong["nome"] == "Congregação Centro"

def test_cliente_nao_cria_congregacao(client, master_token):
    cong = _criar_congregacao(client, master_token, "Congregação A")
    cliente = _criar_cliente(client, master_token, cong["id"], "cliente1@teste.com")
    cliente_token = _login(client, cliente["email"], "senha-123456")
    headers = {"Authorization": f"Bearer {cliente_token}"}
    res = client.post("/api/congregacoes", json={"nome": "Outra"}, headers=headers)
    assert res.status_code == 403

def test_criar_cliente_sem_congregacao_e_rejeitado(client, master_token):
    headers = {"Authorization": f"Bearer {master_token}"}
    res = client.post("/api/usuarios", json={
        "email": "sem-cong@teste.com", "nome": "Sem Congregação", "perfil": "cliente", "senha": "senha-123456",
    }, headers=headers)
    assert res.status_code == 400

def test_separacao_dados_entre_congregacoes(client, master_token):
    cong_a = _criar_congregacao(client, master_token, "Congregação A")
    cong_b = _criar_congregacao(client, master_token, "Congregação B")
    cliente_a = _criar_cliente(client, master_token, cong_a["id"], "cliente.a@teste.com")
    membro_a = _criar_membro(client, master_token, cong_a["id"], "Membro da A")
    membro_b = _criar_membro(client, master_token, cong_b["id"], "Membro da B")

    token_a = _login(client, cliente_a["email"], "senha-123456")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Lista de membros do cliente A só traz membros da própria congregação.
    membros = client.get("/api/membros", headers=headers_a).json()["dados"]
    ids = {m["id"] for m in membros}
    assert membro_a["id"] in ids
    assert membro_b["id"] not in ids

    # Não pode acessar diretamente um membro de outra congregação.
    assert client.get(f"/api/membros/{membro_b['id']}", headers=headers_a).status_code == 403
    assert client.get(f"/api/membros/{membro_a['id']}", headers=headers_a).status_code == 200

    # Lista de congregações também é restrita à própria.
    congregacoes = client.get("/api/congregacoes", headers=headers_a).json()
    cong_ids = {c["id"] for c in congregacoes}
    assert cong_a["id"] in cong_ids
    assert cong_b["id"] not in cong_ids
    assert client.get(f"/api/congregacoes/{cong_b['id']}", headers=headers_a).status_code == 403

def test_admin_ve_dados_de_todas_congregacoes(client, master_token):
    cong_a = _criar_congregacao(client, master_token, "Congregação A")
    cong_b = _criar_congregacao(client, master_token, "Congregação B")
    _criar_membro(client, master_token, cong_a["id"], "Membro da A")
    _criar_membro(client, master_token, cong_b["id"], "Membro da B")

    headers = {"Authorization": f"Bearer {master_token}"}
    congregacoes = client.get("/api/congregacoes", headers=headers).json()
    assert {c["id"] for c in congregacoes} >= {cong_a["id"], cong_b["id"]}
