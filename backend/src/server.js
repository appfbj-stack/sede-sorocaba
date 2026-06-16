require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { initDb } = require('./db/schema');
const { processarFila } = require('./services/sync');
const { notificacoesdiarias } = require('./utils/notificacoes');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rotas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/congregacoes', require('./routes/congregacoes'));
app.use('/api/membros', require('./routes/membros'));
app.use('/api/obreiros', require('./routes/obreiros'));
app.use('/api/patrimonio', require('./routes/patrimonio'));
app.use('/api/agenda', require('./routes/agenda'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ia', require('./routes/ia'));
app.use('/api/importacao', require('./routes/importacao'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', versao: '1.0.0', timestamp: new Date().toISOString() }));

// Sincronização a cada 2 minutos
cron.schedule('*/2 * * * *', () => {
  processarFila().catch(err => console.error('[Cron Sync]', err.message));
});

// Notificações diárias às 7h
cron.schedule('0 7 * * *', () => {
  notificacoesdiarias().catch(err => console.error('[Cron Notif]', err.message));
}, { timezone: 'America/Sao_Paulo' });

const PORT = process.env.PORT || 3001;

initDb();
app.listen(PORT, () => {
  console.log(`[Kairos] Servidor rodando na porta ${PORT}`);
  console.log(`[Kairos] Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
