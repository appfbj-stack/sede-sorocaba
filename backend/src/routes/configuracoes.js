const express = require('express');
const { getDb } = require('../db/schema');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, autorizar('sede'));

router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT chave, valor FROM configuracoes').all();
  const config = {};
  rows.forEach(r => { config[r.chave] = r.valor; });
  res.json(config);
});

router.put('/', (req, res) => {
  const db = getDb();
  const agora = new Date().toISOString();
  const upsert = db.prepare(`
    INSERT INTO configuracoes (chave, valor, atualizado_em) VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em
  `);
  const upsertMany = db.transaction((pairs) => {
    for (const [chave, valor] of pairs) {
      upsert.run(chave, String(valor ?? ''), agora);
    }
  });
  upsertMany(Object.entries(req.body));
  res.json({ ok: true });
});

module.exports = router;
