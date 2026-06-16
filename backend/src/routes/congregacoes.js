const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { autenticar, autorizar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar, registrarAuditoria } = require('../services/sync');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

router.get('/', (req, res) => {
  const db = getDb();
  let query = 'SELECT * FROM congregacoes WHERE 1=1';
  const params = [];
  if (req.congregacaoFiltro) {
    query += ' AND id = ?';
    params.push(req.congregacaoFiltro);
  }
  query += ' ORDER BY nome';
  res.json(db.prepare(query).all(...params));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const cong = db.prepare('SELECT * FROM congregacoes WHERE id = ?').get(req.params.id);
  if (!cong) return res.status(404).json({ erro: 'Não encontrada' });
  if (req.congregacaoFiltro && cong.id !== req.congregacaoFiltro) return res.status(403).json({ erro: 'Acesso negado' });
  res.json(cong);
});

router.post('/', autorizar('sede'), (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const { nome, endereco, cidade, estado, pastor_email, telefone, whatsapp, email, status } = req.body;
  const agora = new Date().toISOString();
  const registro = { id, nome, endereco, cidade, estado, pastor_email, telefone, whatsapp, email, status: status || 'ativa', criado_em: agora, atualizado_em: agora };
  db.prepare(`INSERT INTO congregacoes (id, nome, endereco, cidade, estado, pastor_email, telefone, whatsapp, email, status, criado_em, atualizado_em)
    VALUES (@id, @nome, @endereco, @cidade, @estado, @pastor_email, @telefone, @whatsapp, @email, @status, @criado_em, @atualizado_em)`).run(registro);
  enfileirar('congregacoes', 'upsert', registro);
  registrarAuditoria(req.usuario.id, 'create', 'congregacoes', id, null, registro, req.ip);
  res.status(201).json(registro);
});

router.put('/:id', autorizar('sede'), (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM congregacoes WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrada' });
  const { nome, endereco, cidade, estado, pastor_email, telefone, whatsapp, email, status } = req.body;
  const agora = new Date().toISOString();
  db.prepare(`UPDATE congregacoes SET nome=@nome, endereco=@endereco, cidade=@cidade, estado=@estado, pastor_email=@pastor_email,
    telefone=@telefone, whatsapp=@whatsapp, email=@email, status=@status, atualizado_em=@atualizado_em WHERE id=@id`)
    .run({ nome, endereco, cidade, estado, pastor_email, telefone, whatsapp, email, status, atualizado_em: agora, id: req.params.id });
  const depois = db.prepare('SELECT * FROM congregacoes WHERE id = ?').get(req.params.id);
  enfileirar('congregacoes', 'upsert', depois);
  registrarAuditoria(req.usuario.id, 'update', 'congregacoes', req.params.id, antes, depois, req.ip);
  res.json(depois);
});

router.delete('/:id', autorizar('sede'), (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM congregacoes WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrada' });
  db.prepare('DELETE FROM congregacoes WHERE id = ?').run(req.params.id);
  enfileirar('congregacoes', 'delete', { id: req.params.id });
  registrarAuditoria(req.usuario.id, 'delete', 'congregacoes', req.params.id, antes, null, req.ip);
  res.json({ ok: true });
});

module.exports = router;
