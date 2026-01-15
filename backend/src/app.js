const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const whatsappService = require('./services/whatsapp/whatsappService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["https://portal.primeatende.com.br", "http://localhost:3000"],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

app.use(cors({
  origin: ["https://portal.primeatende.com.br", "http://localhost:3000"],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (fotos, pdfs)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.set('io', io);

// Inicializa WhatsApp
whatsappService.setIo(io);
whatsappService.inicializar();

// Inicializa Serviços de Cron
// require('./services/nps/npsService');
require('./services/followup/followupService');
require('./services/confirmacao/confirmacaoService');

// ROTAS
app.use('/api/medicos', require('./routes/medicos'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/tv-midias', require('./routes/tv_midias'));
app.use('/api/metricas', require('./routes/metricas'));
app.use('/api/pagamentos', require('./routes/pagamentos'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Rodando' });
});

// Endpoint para reconectar WhatsApp
app.post('/api/whatsapp/reconnect', async (req, res) => {
  try {
    console.log('[API] Solicitação de reconexão recebida');
    await whatsappService.reconectar();
    res.json({ success: true, message: 'Reconexão iniciada' });
  } catch (error) {
    console.error('[API] Erro na reconexão:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para status do WhatsApp
app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    status: whatsappService.getStatus(),
    isReady: whatsappService.isReady
  });
});

// Endpoint para enviar mensagem de teste
app.post('/api/whatsapp/enviar', async (req, res) => {
  console.log(`[API] Recebida solicitação para enviar mensagem para: ${req.body.numero}`);
  const { numero, mensagem } = req.body;

  if (!numero || !mensagem) {
    return res.status(400).json({ success: false, message: 'Número e mensagem são obrigatórios' });
  }

  try {
    const enviado = await whatsappService.enviarMensagem(numero, mensagem);
    res.json({ success: enviado, message: enviado ? 'Mensagem enviada!' : 'Falha ao enviar' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Envia o estado atual para o novo cliente
  const currentStatus = whatsappService.isReady ? 'conectado' : 'desconectado';
  socket.emit('whatsapp-status', { status: currentStatus });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('🚀 Servidor na porta ' + PORT);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🔴 Servidor sendo desligado...');
  if (whatsappService.sock) {
    // Apenas fecha o websocket, a lib cuida do resto
    await whatsappService.sock.ws.close();
    console.log('🔌 Cliente WhatsApp desconectado.');
  }
  server.close(() => {
    console.log('🚪 Servidor fechado.');
    process.exit(0);
  });
});

module.exports = { app, io };
