const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const whatsappService = require('./services/whatsappService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'TROQUE_ESSA_CHAVE_NO_ENV';

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.set('io', io);

// Middleware JWT no Socket.IO: valida token e marca sockets de admin
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.usuario = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      // Token inválido — socket conecta mas sem perfil
    }
  }
  next();
});

// Inicializa WhatsApp
whatsappService.setIo(io);
if (process.env.WHATSAPP_ENABLED !== 'false') {
  whatsappService.inicializar();
}

// ROTAS ASO
const asoRoutes = require('./routes/index');
app.use('/api', asoRoutes);

// Compatibilidade: rota de login direta em /auth/login
app.use('/auth', require('./routes/index'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ASO Saúde API', timestamp: new Date().toISOString() });
});

const auth = require('./middleware/auth');

// WhatsApp management endpoints
app.post('/api/whatsapp/reconnect', auth, async (req, res) => {
  try {
    await whatsappService.reconectar();
    res.json({ success: true, message: 'Reconexão iniciada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/whatsapp/status', auth, (req, res) => {
  res.json(whatsappService.getStatus());
});

app.post('/api/whatsapp/pausar', auth, (req, res) => {
  whatsappService.pausarMensagens();
  res.json({ mensagensPausadas: true });
});

app.post('/api/whatsapp/retomar', auth, (req, res) => {
  whatsappService.retomarMensagens();
  res.json({ mensagensPausadas: false });
});

app.post('/api/whatsapp/enviar', auth, async (req, res) => {
  if (!req.body) return res.status(400).json({ success: false, message: 'Corpo da requisição ausente.' });
  const { numero, mensagem } = req.body;
  if (!numero || !mensagem) return res.status(400).json({ success: false, message: 'Número e mensagem são obrigatórios' });
  try {
    const enviado = await whatsappService.enviarMensagem(numero, mensagem);
    res.json({ success: enviado });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('[Socket] Cliente conectado:', socket.id, '| perfil:', socket.usuario?.perfil || 'público');

  if (socket.usuario?.perfil === 'ADMIN') {
    socket.join('sala-admin');
    const status = whatsappService.getStatus();
    socket.emit('whatsapp-status', { status: status.ready ? 'conectado' : 'desconectado' });
  }

  socket.on('disconnect', () => {
    console.log('[Socket] Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[ASO] Servidor na porta ${PORT}`);
});

// ── Follow-up cron — roda todo dia às 09:00 ──────────────────────────
const cron = require('node-cron');
const pool_cron = require('./config/database');
cron.schedule('0 9 * * *', async () => {
  console.log('[Cron] Verificando follow-ups...');
  try {
    const { rows } = await pool_cron.query(`
      SELECT a.id, p.nome, p.whatsapp, p.id as paciente_id
      FROM atendimentos a
      JOIN pacientes p ON p.id = a.paciente_id
      WHERE a.status = 'CONCLUIDO'
        AND a.criado_em::date = (CURRENT_DATE - INTERVAL '15 days')::date
        AND NOT EXISTS (
          SELECT 1 FROM wa_mensagens_log wl
          WHERE wl.paciente_id = p.id AND wl.tipo = 'FOLLOWUP'
            AND wl.enviado_em::date = CURRENT_DATE
        )
    `);
    console.log(`[Cron] ${rows.length} follow-up(s) a enviar.`);
    for (const row of rows) {
      await whatsappService.enviarFollowup({ nome: row.nome, whatsapp: row.whatsapp, id: row.paciente_id });
    }
  } catch (err) {
    console.error('[Cron] Erro no follow-up:', err.message);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[ASO] Servidor sendo desligado...');
  server.close(() => {
    console.log('[ASO] Servidor fechado.');
    process.exit(0);
  });
});

module.exports = { app, io };
