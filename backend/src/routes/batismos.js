const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar } = require('../services/sync');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

router.get('/', (req, res) => {
  const db = getDb();
  const where = req.congregacaoFiltro ? `AND b.congregacao_id = '${req.congregacaoFiltro}'` : '';
  const rows = db.prepare(`
    SELECT b.*, m.nome as membro_nome, m.foto_url,
           p.nome as pastor_nome
    FROM batismos b
    JOIN membros m ON b.membro_id = m.id
    LEFT JOIN membros p ON b.pastor_id = p.id
    WHERE 1=1 ${where}
    ORDER BY b.data DESC
  `).all();
  res.json(rows);
});

// Membros não batizados
router.get('/pendentes', (req, res) => {
  const db = getDb();
  const where = req.congregacaoFiltro ? `AND congregacao_id = '${req.congregacaoFiltro}'` : '';
  const rows = db.prepare(`
    SELECT id, nome, foto_url, data_conversao, congregacao_id
    FROM membros
    WHERE status = 'ativo'
    AND (data_batismo IS NULL OR data_batismo = '')
    ${where}
    ORDER BY nome
  `).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { membro_id, data, local, pastor_id } = req.body;
  const congregacao_id = req.congregacaoFiltro || req.body.congregacao_id;
  const id = uuidv4();
  const agora = new Date().toISOString();

  db.prepare(`INSERT INTO batismos (id, congregacao_id, membro_id, data, local, pastor_id, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, congregacao_id, membro_id, data, local, pastor_id || null, agora);

  // Atualiza data_batismo no membro
  db.prepare('UPDATE membros SET data_batismo = ? WHERE id = ?').run(data, membro_id);

  const batismo = db.prepare(`
    SELECT b.*, m.nome as membro_nome, m.foto_url
    FROM batismos b JOIN membros m ON b.membro_id = m.id
    WHERE b.id = ?
  `).get(id);

  enfileirar('batismos', 'upsert', { id, congregacao_id, membro_id, data, local, pastor_id, criado_em: agora });
  res.status(201).json(batismo);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const b = db.prepare('SELECT * FROM batismos WHERE id = ?').get(req.params.id);
  if (!b) return res.status(404).json({ erro: 'Não encontrado' });
  db.prepare('DELETE FROM batismos WHERE id = ?').run(req.params.id);
  // Remove data_batismo do membro
  db.prepare('UPDATE membros SET data_batismo = NULL WHERE id = ?').run(b.membro_id);
  res.json({ ok: true });
});

module.exports = router;
