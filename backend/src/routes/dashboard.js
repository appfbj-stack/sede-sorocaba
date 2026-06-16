const express = require('express');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

router.get('/', (req, res) => {
  const db = getDb();
  const isSede = req.usuario.perfil === 'sede';
  const congId = req.congregacaoFiltro;

  const where = congId ? `WHERE congregacao_id = '${congId}'` : '';
  const whereM = congId ? `WHERE m.congregacao_id = '${congId}'` : '';

  const hoje = new Date();
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const dd = String(hoje.getDate()).padStart(2, '0');

  const stats = {
    congregacoes: isSede ? db.prepare('SELECT COUNT(*) as c FROM congregacoes WHERE status = "ativa"').get().c : 1,
    total_membros: db.prepare(`SELECT COUNT(*) as c FROM membros ${where}`).get().c,
    membros_ativos: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE status = 'ativo'${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    membros_inativos: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE status = 'inativo'${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    batizados: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE data_batismo IS NOT NULL AND data_batismo != ''${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    nao_batizados: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE (data_batismo IS NULL OR data_batismo = '') AND status = 'ativo'${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    total_obreiros: db.prepare(`SELECT COUNT(*) as c FROM obreiros WHERE ativo = 1${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    credenciais_vencidas: db.prepare(`SELECT COUNT(*) as c FROM obreiros WHERE ativo = 1 AND credencial_validade < date('now')${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    carteirinhas_vencidas: db.prepare(`SELECT COUNT(*) as c FROM carteirinhas WHERE status = 'vencida'`).get().c,
    total_patrimonio: db.prepare(`SELECT COUNT(*) as c FROM patrimonio WHERE ativo = 1${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    aniversariantes_hoje: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE status = 'ativo' AND substr(data_nascimento, 6, 5) = '${mm}-${dd}'${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    aniversariantes_mes: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE status = 'ativo' AND substr(data_nascimento, 6, 2) = '${mm}'${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
    eventos_proximos: db.prepare(`SELECT COUNT(*) as c FROM eventos WHERE date(data_inicio) >= date('now') AND date(data_inicio) <= date('now', '+30 days')${congId ? ` AND congregacao_id = '${congId}'` : ''}`).get().c,
  };

  // Aniversariantes hoje (lista)
  stats.lista_aniversariantes_hoje = db.prepare(
    `SELECT id, nome, data_nascimento, foto_url, congregacao_id FROM membros WHERE status = 'ativo' AND substr(data_nascimento, 6, 5) = '${mm}-${dd}'${congId ? ` AND congregacao_id = '${congId}'` : ''} ORDER BY nome LIMIT 10`
  ).all();

  // Crescimento mensal (últimos 6 meses)
  stats.crescimento = db.prepare(`
    SELECT strftime('%Y-%m', criado_em) as mes, COUNT(*) as total
    FROM membros
    ${congId ? `WHERE congregacao_id = '${congId}'` : ''}
    GROUP BY mes ORDER BY mes DESC LIMIT 6
  `).all().reverse();

  res.json(stats);
});

module.exports = router;
