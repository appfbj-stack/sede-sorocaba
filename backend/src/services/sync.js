const { getDb } = require('../db/schema');
const { syncToSheets } = require('./sheets');

async function processarFila() {
  const db = getDb();
  const pendentes = db.prepare(
    "SELECT * FROM sync_queue WHERE status = 'pendente' AND tentativas < 5 ORDER BY id LIMIT 20"
  ).all();

  for (const item of pendentes) {
    db.prepare("UPDATE sync_queue SET status = 'processando', tentativas = tentativas + 1 WHERE id = ?").run(item.id);
    try {
      const payload = JSON.parse(item.payload);
      await syncToSheets(item.tabela, payload, item.operacao);
      db.prepare("UPDATE sync_queue SET status = 'concluido', processado_em = datetime('now') WHERE id = ?").run(item.id);
    } catch (err) {
      const novoStatus = item.tentativas >= 4 ? 'erro' : 'pendente';
      db.prepare("UPDATE sync_queue SET status = ?, erro = ? WHERE id = ?").run(novoStatus, err.message, item.id);
    }
  }
}

function enfileirar(tabela, operacao, payload) {
  const db = getDb();
  db.prepare(
    "INSERT INTO sync_queue (tabela, operacao, payload) VALUES (?, ?, ?)"
  ).run(tabela, operacao, JSON.stringify(payload));
  // Tenta processar de forma não bloqueante
  processarFila().catch(() => {});
}

function registrarAuditoria(usuarioId, acao, tabela, registroId, antes, depois, ip) {
  const db = getDb();
  db.prepare(`
    INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, dados_antes, dados_depois, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    usuarioId, acao, tabela, registroId,
    antes ? JSON.stringify(antes) : null,
    depois ? JSON.stringify(depois) : null,
    ip
  );
}

module.exports = { processarFila, enfileirar, registrarAuditoria };
