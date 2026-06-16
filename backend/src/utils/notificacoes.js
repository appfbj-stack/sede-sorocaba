const nodemailer = require('nodemailer');
const { getDb } = require('../db/schema');

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function enviarEmail(para, assunto, html) {
  try {
    const transporter = getTransporter();
    await transporter.sendMail({ from: `Kairos OBPC <${process.env.EMAIL_FROM}>`, to: para, subject: assunto, html });
  } catch (err) {
    console.error('[Email] Erro:', err.message);
  }
}

async function notificacoesdiarias() {
  const db = getDb();
  const hoje = new Date();
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const dd = String(hoje.getDate()).padStart(2, '0');
  const mmdd = `${mm}-${dd}`;

  const aniversariantes = db.prepare(`
    SELECT m.nome, m.data_nascimento, c.nome as congregacao, c.pastor_email
    FROM membros m JOIN congregacoes c ON m.congregacao_id = c.id
    WHERE m.status = 'ativo' AND substr(m.data_nascimento, 6, 5) = ?
  `).all(mmdd);

  const credenciaisVencendo = db.prepare(`
    SELECT o.credencial_validade, m.nome, c.nome as congregacao, c.pastor_email
    FROM obreiros o JOIN membros m ON o.membro_id = m.id JOIN congregacoes c ON o.congregacao_id = c.id
    WHERE o.ativo = 1 AND date(o.credencial_validade) BETWEEN date('now') AND date('now', '+30 days')
  `).all();

  // Agrupa por pastor
  const porPastor = {};
  aniversariantes.forEach(a => {
    if (!a.pastor_email) return;
    if (!porPastor[a.pastor_email]) porPastor[a.pastor_email] = { aniversariantes: [], credenciais: [], congregacao: a.congregacao };
    porPastor[a.pastor_email].aniversariantes.push(a);
  });
  credenciaisVencendo.forEach(c => {
    if (!c.pastor_email) return;
    if (!porPastor[c.pastor_email]) porPastor[c.pastor_email] = { aniversariantes: [], credenciais: [], congregacao: c.congregacao };
    porPastor[c.pastor_email].credenciais.push(c);
  });

  for (const [email, dados] of Object.entries(porPastor)) {
    const linhasAniv = dados.aniversariantes.map(a => `<li>${a.nome}</li>`).join('');
    const linhasCred = dados.credenciais.map(c => `<li>${c.nome} — vence em ${new Date(c.credencial_validade).toLocaleDateString('pt-BR')}</li>`).join('');
    const html = `
      <h2>📅 Relatório Diário Kairos — ${hoje.toLocaleDateString('pt-BR')}</h2>
      <h3>🎂 Aniversariantes hoje (${dados.aniversariantes.length})</h3>
      <ul>${linhasAniv || '<li>Nenhum</li>'}</ul>
      <h3>⚠️ Credenciais vencendo em 30 dias (${dados.credenciais.length})</h3>
      <ul>${linhasCred || '<li>Nenhuma</li>'}</ul>
    `;
    await enviarEmail(email, `Kairos: Relatório diário — ${hoje.toLocaleDateString('pt-BR')}`, html);
  }

  console.log(`[Notificações] Enviadas para ${Object.keys(porPastor).length} pastores`);
}

module.exports = { notificacoesdiarias, enviarEmail };
