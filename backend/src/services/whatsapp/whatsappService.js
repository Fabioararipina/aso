const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

class WhatsAppService {
  constructor() {
    this.sock = null;
    this.isReady = false;
    this.io = null;
    this.qrCode = null;
    this.logger = pino({ level: 'debug' }, pino.destination(path.join(__dirname, '../../../baileys_backend.log')));
    this._queue = [];
    this._processing = false;
  }

  // Processa a fila enviando uma mensagem por vez com delay aleatório (anti-ban)
  async _processQueue() {
    if (this._processing) return;
    this._processing = true;
    while (this._queue.length > 0) {
      const { numero, texto, resolve } = this._queue.shift();
      const result = await this._enviarDireto(numero, texto);
      resolve(result);
      if (this._queue.length > 0) {
        // Delay aleatório entre 4 e 9 segundos entre cada mensagem
        const delay = 4000 + Math.floor(Math.random() * 5000);
        console.log(`[WhatsAppService] Aguardando ${delay}ms antes do próximo envio (anti-ban)...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    this._processing = false;
  }

  setIo(ioInstance) {
    console.log('[WhatsAppService] Socket.IO configurado');
    this.io = ioInstance;
  }

  _formatarNumero(numero) {
    if (!numero) return null;
    let num = numero.replace(/\D/g, '');

    if (num.length < 10) {
      console.error(`[WhatsAppService] Número inválido (muito curto): ${numero}`);
      return null;
    }

    // Adiciona o 55 se não tiver
    if (!num.startsWith('55')) {
      num = '55' + num;
    }

    // Lógica do 9º dígito para números do Brasil
    if (num.startsWith('55')) {
      // Remove o '55' para analisar o DDD e o número
      let tempNum = num.substring(2); 
      const ddd = tempNum.substring(0, 2);
      const numeroSemDDD = tempNum.substring(2);

      // Se for um DDD válido (geralmente 11 a 99) e o número sem DDD tem 8 dígitos,
      // assume-se que é um celular antigo que precisa do '9'.
      // Ou seja, antes (DDD)XXXX-XXXX vira (DDD)9XXXX-XXXX
      if (parseInt(ddd, 10) >= 11 && numeroSemDDD.length === 8) {
        num = '55' + ddd + '9' + numeroSemDDD;
        console.log(`[WhatsAppService] Adicionado 9º dígito para: ${num}`);
      }
    }
    
    // Verifica se o número final tem o tamanho correto para um celular brasileiro (55 + DD + 9 digitos = 13 digitos)
    if (num.startsWith('55') && num.length !== 13) {
      console.warn(`[WhatsAppService] Número ${numero} pode estar em formato incorreto após formatação. Resultado: ${num}`);
    }

    return num + '@s.whatsapp.net';
  }

  async inicializar() {
    if (!this.io) {
      console.error('[WhatsAppService] Socket.IO não configurado!');
      return;
    }

    // Fecha conexão anterior se existir
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        await this.sock.ws.close();
      } catch (e) {
        // Ignora erros ao fechar
      }
      this.sock = null;
    }

    console.log('[WhatsAppService] Inicializando cliente Baileys...');
    this.io.emit('whatsapp-status', { status: 'iniciando' });

    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, '../../../whatsapp-session-baileys'));
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsAppService] Usando Baileys v${version.join('.')}, é a última versão: ${isLatest}`);

    this.sock = makeWASocket({
      version,
      auth: state,
      logger: this.logger,
      printQRInTerminal: false // Gerenciamos o QR manualmente
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // DEBUG: Log completo do update
      console.log('[WhatsAppService] connection.update:', JSON.stringify({ connection, qr: qr ? 'QR_EXISTS' : null, lastDisconnect: lastDisconnect?.error?.message }));

      this.qrCode = qr;
      if (qr) {
        console.log('[WhatsAppService] QR Code gerado');
        try {
          const qrBase64 = await QRCode.toDataURL(qr);
          this.io.emit('whatsapp-qr', qrBase64);
          this.io.emit('whatsapp-status', { status: 'aguardando_leitura' });
        } catch (e) {
            console.error('[WhatsAppService] Erro ao converter QR para base64', e);
        }
      }

      if (connection === 'open') {
        console.log('========================================');
        console.log('[WhatsAppService] PRONTO! WhatsApp conectado.');
        console.log('[WhatsAppService] Setando isReady = true');
        console.log('========================================');
        this.isReady = true;
        this.qrCode = null;
        this.io.emit('whatsapp-status', { status: 'conectado' });
        this.io.emit('whatsapp-qr', null); // Limpa o QR da tela
        console.log('[WhatsAppService] Eventos emitidos para o frontend');
      } else if (connection === 'close') {
        this.isReady = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || '';

        // Código 515 = Stream Errored (restart required) - acontece após pareamento
        // Código 401 = Logged Out - precisa novo QR
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isStreamError = statusCode === 515 || errorMessage.includes('Stream Errored');

        console.log(`[WhatsAppService] Conexão fechada. Código: ${statusCode}, Motivo: ${errorMessage}`);

        if (isStreamError) {
          // Após pareamento, o Baileys precisa reiniciar - isso é NORMAL
          console.log('[WhatsAppService] Stream error após pareamento - reiniciando conexão...');
          this.io.emit('whatsapp-status', { status: 'reconectando' });
          setTimeout(() => this.inicializar(), 2000);
        } else if (isLoggedOut) {
          console.log('[WhatsAppService] Deslogado. Limpando sessão para novo QR...');
          await this.limparSessao();
          this.io.emit('whatsapp-status', { status: 'deslogado' });
          await this.inicializar();
        } else {
          // Outros erros - tentar reconectar
          console.log('[WhatsAppService] Erro de conexão - tentando reconectar...');
          this.io.emit('whatsapp-status', { status: 'reconectando' });
          setTimeout(() => this.inicializar(), 3000);
        }
      } else if (connection === 'connecting') {
        console.log('[WhatsAppService] Conectando...');
        this.io.emit('whatsapp-status', { status: 'conectando' });
      }
    });
  }

  async limparSessao() {
    const sessionPath = path.join(__dirname, '../../../whatsapp-session-baileys');
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log('[WhatsAppService] Sessão anterior removida com sucesso.');
      } catch (error) {
        console.error('[WhatsAppService] Erro ao remover sessão:', error);
        // Mesmo com erro, tentamos recriar o diretório para evitar falhas na próxima inicialização
      }
    }
    
    // Garante que o diretório exista para a próxima inicialização
    if (!fs.existsSync(sessionPath)) {
      try {
        fs.mkdirSync(sessionPath);
        console.log('[WhatsAppService] Diretório da sessão recriado.');
      } catch (error) {
        console.error('[WhatsAppService] Erro ao recriar diretório da sessão:', error);
        return false; // Retorna false pois a inicialização pode falhar
      }
    }
    return true;
  }

  async reconectar() {
    console.log('[WhatsAppService] Tentando forçar a reconexão...');
    if (this.sock) {
      try {
        await this.sock.ws.close();
      } catch {}
    }
    await this.limparSessao();
    await this.inicializar();
    return true;
  }

  // Adiciona mensagem à fila (chamado pelos controllers)
  async enviarMensagem(numero, texto) {
    return new Promise((resolve) => {
      this._queue.push({ numero, texto, resolve });
      console.log(`[WhatsAppService] Mensagem enfileirada para ${numero}. Fila: ${this._queue.length} item(s).`);
      this._processQueue();
    });
  }

  // Envia diretamente (uso interno pela fila)
  async _enviarDireto(numero, texto) {
    if (!this.isReady || !this.sock) {
      console.error('[WhatsAppService] Cliente não está pronto para enviar mensagem.');
      return false;
    }

    // Limpa o número (só dígitos) e adiciona 55 se necessário
    let numLimpo = numero.replace(/\D/g, '');
    if (!numLimpo.startsWith('55')) {
      numLimpo = '55' + numLimpo;
    }

    const jidConsulta = `${numLimpo}@s.whatsapp.net`;
    console.log(`[WhatsAppService] Consultando número: ${jidConsulta}`);

    try {
      // onWhatsApp retorna o JID correto (corrige o 9º dígito automaticamente)
      const [result] = await this.sock.onWhatsApp(jidConsulta);

      if (!result?.exists) {
        console.error(`[WhatsAppService] Número ${numero} não existe no WhatsApp`);
        return false;
      }

      // Usa o JID corrigido retornado pelo WhatsApp
      const jidCorreto = result.jid;
      console.log(`[WhatsAppService] Enviando para JID corrigido: ${jidCorreto}`);

      await this.sock.sendMessage(jidCorreto, { text: texto });
      console.log(`[WhatsAppService] Mensagem enviada com sucesso para ${jidCorreto}`);
      return true;

    } catch (error) {
      console.error(`[WhatsAppService] Erro ao enviar para ${numero}:`, error.message);
      return false;
    }
  }

  async enviarArquivo(numero, caminhoArquivo, legenda = '') {
    if (!this.isReady || !this.sock) {
      console.error('[WhatsAppService] Cliente não está pronto para enviar arquivo.');
      return false;
    }

    if (!fs.existsSync(caminhoArquivo)) {
      console.error('[WhatsAppService] Arquivo não encontrado:', caminhoArquivo);
      return false;
    }

    // Limpa o número (só dígitos) e adiciona 55 se necessário
    let numLimpo = numero.replace(/\D/g, '');
    if (!numLimpo.startsWith('55')) {
      numLimpo = '55' + numLimpo;
    }

    const jidConsulta = `${numLimpo}@s.whatsapp.net`;

    try {
      // onWhatsApp retorna o JID correto (corrige o 9º dígito automaticamente)
      const [result] = await this.sock.onWhatsApp(jidConsulta);

      if (!result?.exists) {
        console.error(`[WhatsAppService] Número ${numero} não existe no WhatsApp`);
        return false;
      }

      const jidCorreto = result.jid;
      const ext = path.extname(caminhoArquivo).slice(1).toLowerCase();
      const media = {
        [ext === 'pdf' ? 'document' : 'image']: { url: caminhoArquivo },
        caption: legenda
      };

      console.log(`[WhatsAppService] Enviando arquivo para ${jidCorreto}`);
      await this.sock.sendMessage(jidCorreto, media);
      console.log(`[WhatsAppService] Arquivo enviado com sucesso para ${jidCorreto}`);
      return true;
    } catch (error) {
      console.error(`[WhatsAppService] Erro ao enviar arquivo para ${numero}:`, error.message);
      return false;
    }
  }

  getStatus() {
    return {
      ready: this.isReady,
      qr: this.qrCode
    };
  }
}

module.exports = new WhatsAppService();