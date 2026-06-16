const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { autenticar, autorizar } = require('../middleware/auth');
const { enfileirar } = require('../services/sync');

const router = express.Router();
router.use(autenticar, autorizar('sede'));

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, email, nome, perfil, congregacao_id, foto_url, ativo, criado_em FROM usuarios ORDER BY nome').all());
});

router.post('/', (req, res) => {
  const db = getDb();
  const { email, nome, perfil, congregacao_id } = req.body;
  if (!email || !nome || !perfil) return res.status(400).json({ erro: 'email, nome e perfil obrigatórios' });
  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existe) return res.status(409).json({ erro: 'E-mail já cadastrado' });
  const id = uuidv4();
  const agora = new Date().toISOString();
  const dados = { id, email, nome, perfil, congregacao_id: congregacao_id || null, ativo: 1, criado_em: agora, atualizado_em: agora };
  db.prepare('INSERT INTO usuarios (id, email, nome, perfil, congregacao_id, ativo, criado_em, atualizado_em) VALUES (@id, @email, @nome, @perfil, @congregacao_id, @ativo, @criado_em, @atualizado_em)').run(dados);
  enfileirar('usuarios', 'upsert', dados);
  res.status(201).json(dados);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { nome, perfil, congregacao_id, ativo } = req.body;
  const agora = new Date().toISOString();
  db.prepare('UPDATE usuarios SET nome=@nome, perfil=@perfil, congregacao_id=@congregacao_id, ativo=@ativo, atualizado_em=@atualizado_em WHERE id=@id')
    .run({ nome, perfil, congregacao_id, ativo: ativo ? 1 : 0, atualizado_em: agora, id: req.params.id });
  const depois = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  enfileirar('usuarios', 'upsert', depois);
  res.json(depois);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  if (req.params.id === req.usuario.id) return res.status(400).json({ erro: 'Não pode remover a si mesmo' });
  db.prepare('UPDATE usuarios SET ativo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
