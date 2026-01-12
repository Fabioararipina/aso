const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const whatsappService = require('./services/whatsapp/whatsappService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*", // Permite qualquer origem para facilitar o acesso de TVs e outros dispositivos na rede local
    methods: ['GET', 'POST', 'PUT']
  }
});

const path = require('path');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (fotos, pdfs)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.set('io', io);

// Inicializa WhatsApp
whatsappService.inicializar(io);

// Inicializa Serviços de Cron
require('./services/nps/npsService');
require('./services/followup/followupService');
require('./services/confirmacao/confirmacaoService');

// ROTAS
app.use('/api/medicos', require('./routes/medicos'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/tv-midias', require('./routes/tv_midias'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API Rodando' });
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('🚀 Servidor na porta ' + PORT);
});

module.exports = { app, io };
