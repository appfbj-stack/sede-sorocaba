const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar } = require('../services/sync');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

router.get('/', (req, res) => {
  const db = getDb();
  const filtros = ['1=1'];
  const params = [];
  if (req.congregacaoFiltro) { filtros.push('m.congregacao_id = ?'); params.push(req.congregacaoFiltro); }
  if (req.query.status) { filtros.push('c.status = ?'); params.push(req.query.status); }
  const rows = db.prepare(`
    SELECT c.*, m.nome, m.foto_url, m.cargo, m.congregacao_id,
           cg.nome as congregacao_nome
    FROM carteirinhas c
    JOIN membros m ON c.membro_id = m.id
    JOIN congregacoes cg ON m.congregacao_id = cg.id
    WHERE ${filtros.join(' AND ')}
    ORDER BY m.nome
  `).all(...params);
  res.json(rows);
});

// Lista membros sem carteirinha
router.get('/pendentes', (req, res) => {
  const db = getDb();
  const where = req.congregacaoFiltro ? `AND m.congregacao_id = '${req.congregacaoFiltro}'` : '';
  const rows = db.prepare(`
    SELECT m.id, m.nome, m.foto_url, m.cargo, m.congregacao_id
    FROM membros m
    WHERE m.status = 'ativo' ${where}
    AND m.id NOT IN (SELECT membro_id FROM carteirinhas WHERE status != 'nao_emitida')
    ORDER BY m.nome
  `).all();
  res.json(rows);
});

router.post('/emitir', (req, res) => {
  const db = getDb();
  const { membro_id, obreiro_id, validade_meses = 12 } = req.body;
  if (!membro_id) return res.status(400).json({ erro: 'membro_id obrigatório' });

  const hoje = new Date();
  const validade = new Date(hoje);
  validade.setMonth(validade.getMonth() + parseInt(validade_meses));

  const id = uuidv4();
  const qrcode_hash = Buffer.from(`KAIROS:${membro_id}:${id}`).toString('base64');

  // Desativa carteirinha anterior se existir
  db.prepare("UPDATE carteirinhas SET status = 'vencida' WHERE membro_id = ? AND status = 'ativa'").run(membro_id);

  const dados = {
    id,
    membro_id,
    obreiro_id: obreiro_id || null,
    qrcode_hash,
    emissao: hoje.toISOString().split('T')[0],
    validade: validade.toISOString().split('T')[0],
    status: 'ativa',
    criado_em: hoje.toISOString(),
  };

  db.prepare(`INSERT INTO carteirinhas (id, membro_id, obreiro_id, qrcode_hash, emissao, validade, status, criado_em)
    VALUES (@id, @membro_id, @obreiro_id, @qrcode_hash, @emissao, @validade, @status, @criado_em)`).run(dados);

  enfileirar('carteirinhas', 'upsert', dados);

  // Atualiza vencidas automaticamente
  db.prepare("UPDATE carteirinhas SET status = 'vencida' WHERE date(validade) < date('now') AND status = 'ativa'").run();

  const carteirinha = db.prepare(`
    SELECT c.*, m.nome, m.foto_url, m.cargo, cg.nome as congregacao_nome
    FROM carteirinhas c
    JOIN membros m ON c.membro_id = m.id
    JOIN congregacoes cg ON m.congregacao_id = cg.id
    WHERE c.id = ?
  `).get(id);

  res.status(201).json(carteirinha);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM carteirinhas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
