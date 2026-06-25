const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../kairos.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      nome TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'pastor',
      congregacao_id TEXT,
      foto_url TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS congregacoes (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      endereco TEXT,
      cidade TEXT,
      estado TEXT,
      pastor_email TEXT,
      telefone TEXT,
      whatsapp TEXT,
      email TEXT,
      status TEXT NOT NULL DEFAULT 'ativa',
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS membros (
      id TEXT PRIMARY KEY,
      congregacao_id TEXT NOT NULL,
      foto_url TEXT,
      nome TEXT NOT NULL,
      cpf TEXT,
      rg TEXT,
      email TEXT,
      data_nascimento TEXT,
      telefone TEXT,
      whatsapp TEXT,
      endereco TEXT,
      estado_civil TEXT,
      data_conversao TEXT,
      data_batismo TEXT,
      cargo TEXT,
      status TEXT NOT NULL DEFAULT 'ativo',
      observacoes TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (congregacao_id) REFERENCES congregacoes(id)
    );

    CREATE TABLE IF NOT EXISTS obreiros (
      id TEXT PRIMARY KEY,
      membro_id TEXT NOT NULL,
      congregacao_id TEXT NOT NULL,
      categoria TEXT NOT NULL,
      credencial_numero TEXT,
      credencial_emissao TEXT,
      credencial_validade TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (membro_id) REFERENCES membros(id),
      FOREIGN KEY (congregacao_id) REFERENCES congregacoes(id)
    );

    CREATE TABLE IF NOT EXISTS carteirinhas (
      id TEXT PRIMARY KEY,
      membro_id TEXT NOT NULL,
      obreiro_id TEXT,
      qrcode_hash TEXT,
      foto_url TEXT,
      emissao TEXT,
      validade TEXT,
      status TEXT NOT NULL DEFAULT 'nao_emitida',
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE IF NOT EXISTS patrimonio (
      id TEXT PRIMARY KEY,
      congregacao_id TEXT NOT NULL,
      codigo TEXT,
      categoria TEXT,
      descricao TEXT NOT NULL,
      valor REAL,
      foto_url TEXT,
      localizacao TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (congregacao_id) REFERENCES congregacoes(id)
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id TEXT PRIMARY KEY,
      congregacao_id TEXT NOT NULL,
      titulo TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT,
      data_inicio TEXT NOT NULL,
      data_fim TEXT,
      local TEXT,
      responsavel_email TEXT,
      google_event_id TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (congregacao_id) REFERENCES congregacoes(id)
    );

    CREATE TABLE IF NOT EXISTS batismos (
      id TEXT PRIMARY KEY,
      congregacao_id TEXT NOT NULL,
      membro_id TEXT NOT NULL,
      data TEXT NOT NULL,
      local TEXT,
      pastor_id TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (congregacao_id) REFERENCES congregacoes(id),
      FOREIGN KEY (membro_id) REFERENCES membros(id)
    );

    CREATE TABLE IF NOT EXISTS documentos (
      id TEXT PRIMARY KEY,
      congregacao_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT,
      drive_file_id TEXT,
      drive_url TEXT,
      pasta TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (congregacao_id) REFERENCES congregacoes(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabela TEXT NOT NULL,
      operacao TEXT NOT NULL,
      payload TEXT NOT NULL,
      tentativas INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendente',
      erro TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      processado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT,
      acao TEXT NOT NULL,
      tabela TEXT NOT NULL,
      registro_id TEXT,
      dados_antes TEXT,
      dados_depois TEXT,
      ip TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_membros_congregacao ON membros(congregacao_id);
    CREATE INDEX IF NOT EXISTS idx_membros_status ON membros(status);
    CREATE INDEX IF NOT EXISTS idx_membros_nascimento ON membros(data_nascimento);
    CREATE INDEX IF NOT EXISTS idx_obreiros_congregacao ON obreiros(congregacao_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON auditoria(tabela, registro_id);
  `);

  // Seed: admin padrão
  const adminExiste = db.prepare('SELECT id FROM usuarios WHERE perfil = ?').get('sede');
  if (!adminExiste) {
    const { v4: uuidv4 } = require('uuid');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@obpcsorocaba.com.br';
    db.prepare(`
      INSERT OR IGNORE INTO usuarios (id, email, nome, perfil, ativo)
      VALUES (?, ?, 'Administrador Sede', 'sede', 1)
    `).run(uuidv4(), adminEmail);
    console.log(`[DB] Admin criado: ${adminEmail}`);
  }

  console.log('[DB] Banco inicializado com sucesso');
  return db;
}

module.exports = { getDb, initDb };
