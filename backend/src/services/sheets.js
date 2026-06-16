const { getSheetsClient } = require('./google');
const { getDb } = require('../db/schema');

const ABAS = [
  'Usuarios', 'Congregacoes', 'Membros', 'Obreiros',
  'Carteirinhas', 'Patrimonio', 'Agenda', 'Batismos',
  'Documentos', 'Configuracoes',
];

const HEADERS = {
  Usuarios: ['id', 'email', 'nome', 'perfil', 'congregacao_id', 'ativo', 'criado_em'],
  Congregacoes: ['id', 'nome', 'endereco', 'cidade', 'estado', 'pastor_email', 'telefone', 'whatsapp', 'email', 'status', 'criado_em'],
  Membros: ['id', 'congregacao_id', 'nome', 'cpf', 'rg', 'data_nascimento', 'telefone', 'whatsapp', 'endereco', 'estado_civil', 'data_conversao', 'data_batismo', 'cargo', 'status', 'observacoes', 'foto_url', 'criado_em', 'atualizado_em'],
  Obreiros: ['id', 'membro_id', 'congregacao_id', 'categoria', 'credencial_numero', 'credencial_emissao', 'credencial_validade', 'ativo', 'criado_em'],
  Carteirinhas: ['id', 'membro_id', 'obreiro_id', 'qrcode_hash', 'emissao', 'validade', 'status', 'criado_em'],
  Patrimonio: ['id', 'congregacao_id', 'codigo', 'categoria', 'descricao', 'valor', 'localizacao', 'foto_url', 'ativo', 'criado_em'],
  Agenda: ['id', 'congregacao_id', 'titulo', 'tipo', 'descricao', 'data_inicio', 'data_fim', 'local', 'responsavel_email', 'google_event_id', 'criado_em'],
  Batismos: ['id', 'congregacao_id', 'membro_id', 'data', 'local', 'pastor_id', 'criado_em'],
  Documentos: ['id', 'congregacao_id', 'nome', 'tipo', 'drive_file_id', 'drive_url', 'pasta', 'criado_em'],
  Configuracoes: ['chave', 'valor', 'atualizado_em'],
};

async function getAdminTokens() {
  const db = getDb();
  const cfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'admin_tokens'").get();
  if (!cfg) throw new Error('Tokens do admin não configurados. Faça login como sede primeiro.');
  return JSON.parse(cfg.valor);
}

async function ensurePlanilha() {
  const db = getDb();
  const spreadsheetIdCfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'spreadsheet_id'").get();
  if (spreadsheetIdCfg) return spreadsheetIdCfg.valor;

  const tokens = await getAdminTokens();
  const sheets = getSheetsClient(tokens);

  const { data } = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'Kairos OBPC Sorocaba - Banco de Dados' },
      sheets: ABAS.map((aba) => ({ properties: { title: aba } })),
    },
  });

  const spreadsheetId = data.spreadsheetId;

  // Adiciona headers em cada aba
  const requests = ABAS.map((aba) => ({
    range: `${aba}!A1`,
    values: [HEADERS[aba]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'RAW', data: requests },
  });

  db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('spreadsheet_id', ?)").run(spreadsheetId);
  console.log('[Sheets] Planilha criada:', spreadsheetId);
  return spreadsheetId;
}

async function syncToSheets(tabela, dados, operacao = 'upsert') {
  try {
    const tokens = await getAdminTokens();
    const sheets = getSheetsClient(tokens);
    const spreadsheetId = await ensurePlanilha();
    const aba = capitalize(tabela);
    const headers = HEADERS[aba];
    if (!headers) return;

    if (operacao === 'delete') {
      // Busca a linha pelo id e limpa
      const { data } = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${aba}!A:A`,
      });
      const rows = data.values || [];
      const rowIndex = rows.findIndex((r) => r[0] === dados.id);
      if (rowIndex > 0) {
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: `${aba}!A${rowIndex + 1}:Z${rowIndex + 1}`,
        });
      }
      return;
    }

    // Upsert: busca linha existente ou adiciona nova
    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${aba}!A:A`,
    });
    const rows = data.values || [];
    const rowIndex = rows.findIndex((r) => r[0] === dados.id);
    const rowValues = [headers.map((h) => dados[h] ?? '')];

    if (rowIndex > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${aba}!A${rowIndex + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: rowValues },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${aba}!A1`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: rowValues },
      });
    }
  } catch (err) {
    console.error('[Sheets] Erro ao sincronizar:', err.message);
    throw err;
  }
}

function capitalize(str) {
  const map = {
    usuarios: 'Usuarios', congregacoes: 'Congregacoes', membros: 'Membros',
    obreiros: 'Obreiros', carteirinhas: 'Carteirinhas', patrimonio: 'Patrimonio',
    eventos: 'Agenda', batismos: 'Batismos', documentos: 'Documentos',
    configuracoes: 'Configuracoes',
  };
  return map[str] || str;
}

module.exports = { ensurePlanilha, syncToSheets };
