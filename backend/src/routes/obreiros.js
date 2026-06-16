const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar, registrarAuditoria } = require('../services/sync');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

router.get('/', (req, res) => {
  const db = getDb();
  const filtros = ['o.1=1'];
  const params = [];
  if (req.congregacaoFiltro) { filtros.push('o.congregacao_id = ?'); params.push(req.congregacaoFiltro); }
  else if (req.query.congregacao_id) { filtros.push('o.congregacao_id = ?'); params.push(req.query.congregacao_id); }
  if (req.query.categoria) { filtros.push('o.categoria = ?'); params.push(req.query.categoria); }
  if (req.query.vencidos === 'true') { filtros.push("o.credencial_validade < date('now')"); }
  const obreiros = db.prepare(`
    SELECT o.*, m.nome, m.foto_url, m.telefone, m.whatsapp
    FROM obreiros o
    JOIN membros m ON o.membro_id = m.id
    WHERE ${filtros.join(' AND ')}
    ORDER BY m.nome
  `).all(...params);
  res.json(obreiros);
});

router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const agora = new Date().toISOString();
  const { membro_id, congregacao_id, categoria, credencial_numero, credencial_emissao, credencial_validade } = req.body;
  const cong = req.congregacaoFiltro || congregacao_id;
  const dados = { id, membro_id, congregacao_id: cong, categoria, credencial_numero, credencial_emissao, credencial_validade, ativo: 1, criado_em: agora };
  db.prepare(`INSERT INTO obreiros (id, membro_id, congregacao_id, categoria, credencial_numero, credencial_emissao, credencial_validade, ativo, criado_em)
    VALUES (@id, @membro_id, @congregacao_id, @categoria, @credencial_numero, @credencial_emissao, @credencial_validade, @ativo, @criado_em)`).run(dados);
  enfileirar('obreiros', 'upsert', dados);
  registrarAuditoria(req.usuario.id, 'create', 'obreiros', id, null, dados, req.ip);
  res.status(201).json(dados);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM obreiros WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrado' });
  const { categoria, credencial_numero, credencial_emissao, credencial_validade, ativo } = req.body;
  const agora = new Date().toISOString();
  db.prepare(`UPDATE obreiros SET categoria=@categoria, credencial_numero=@credencial_numero, credencial_emissao=@credencial_emissao,
    credencial_validade=@credencial_validade, ativo=@ativo, atualizado_em=@atualizado_em WHERE id=@id`)
    .run({ categoria, credencial_numero, credencial_emissao, credencial_validade, ativo: ativo ? 1 : 0, atualizado_em: agora, id: req.params.id });
  const depois = db.prepare('SELECT * FROM obreiros WHERE id = ?').get(req.params.id);
  enfileirar('obreiros', 'upsert', depois);
  registrarAuditoria(req.usuario.id, 'update', 'obreiros', req.params.id, antes, depois, req.ip);
  res.json(depois);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM obreiros WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrado' });
  db.prepare('DELETE FROM obreiros WHERE id = ?').run(req.params.id);
  enfileirar('obreiros', 'delete', { id: req.params.id });
  registrarAuditoria(req.usuario.id, 'delete', 'obreiros', req.params.id, antes, null, req.ip);
  res.json({ ok: true });
});

module.exports = router;
