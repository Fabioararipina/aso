const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

class WhatsAppService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    this.isReady = false;
    this.qrCodeData = null;
  }

  inicializar(io) {
    this.client.on('qr', (qr) => {
      console.log('--- NOVO QR CODE RECEBIDO ---');
      qrcode.generate(qr, { small: true });
      this.qrCodeData = qr;
      io.emit('whatsapp-qr', qr); // Envia para o frontend se alguém estiver na tela de admin
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp conectado com sucesso!');
      this.isReady = true;
      this.qrCodeData = null;
      io.emit('whatsapp-status', { status: 'conectado' });
    });

    this.client.on('authenticated', () => {
      console.log('Authenticated to WhatsApp');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('Falha na autenticação do WhatsApp:', msg);
      io.emit('whatsapp-status', { status: 'erro', mensagem: msg });
    });

    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp desconectado:', reason);
      this.isReady = false;
      io.emit('whatsapp-status', { status: 'desconectado' });
      this.client.initialize(); // Tenta reconectar
    });

    this.client.initialize();
  }

  _formatarNumero(numero) {
    // Remove tudo que não for número
    let numeroLimpo = numero.replace(/\D/g, '');
    
    // Se o número não tem o código do país (55), adiciona
    if (numeroLimpo.length <= 11) {
      numeroLimpo = '55' + numeroLimpo;
    }

    // Se o número formatado tem 13 dígitos (55 + DDD + 9 dígitos), 
    // o WhatsApp as vezes prefere sem o 9 para contas antigas, 
    // mas o padrão @c.us costuma funcionar com o número real do JID.
    // Vamos garantir que termine com @c.us
    return numeroLimpo.includes('@c.us') ? numeroLimpo : `${numeroLimpo}@c.us`;
  }

  async enviarMensagem(numero, texto) {
    if (!this.isReady) {
      console.error('Tentativa de envio de mensagem sem o WhatsApp estar pronto.');
      return false;
    }

    try {
      // Formata minimamente para perguntar ao WhatsApp
      let numeroConsulta = numero.replace(/\D/g, '');
      if (numeroConsulta.length <= 11) numeroConsulta = '55' + numeroConsulta;
      numeroConsulta = numeroConsulta + '@c.us';

      // Pergunta ao WhatsApp qual o ID real desse usuário
      const contact = await this.client.getNumberId(numeroConsulta);
      
      if (!contact) {
        console.error(`Erro: O número ${numeroConsulta} não está registrado no WhatsApp.`);
        return false;
      }

      console.log(`JID resolvido: ${contact._serialized}`);
      await this.client.sendMessage(contact._serialized, texto);
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error.message);
      return false;
    }
  }

  async enviarArquivo(numero, caminhoArquivo, legenda) {
    if (!this.isReady) return false;

    try {
      let numeroConsulta = numero.replace(/\D/g, '');
      if (numeroConsulta.length <= 11) numeroConsulta = '55' + numeroConsulta;
      numeroConsulta = numeroConsulta + '@c.us';

      const contact = await this.client.getNumberId(numeroConsulta);

      if (!contact) {
         console.error(`Erro: O número ${numeroConsulta} não está registrado no WhatsApp.`);
         return false;
      }

      const media = MessageMedia.fromFilePath(caminhoArquivo);
      await this.client.sendMessage(contact._serialized, media, { caption: legenda });
      console.log(`Arquivo enviado para ${contact._serialized}`);
      return true;
    } catch (error) {
      console.error('Erro ao enviar arquivo WhatsApp:', error);
      return false;
    }
  }
}

module.exports = new WhatsAppService();
