// backend/utils/force_nps.js - Script para forçar a execução do envio de NPS para debug

// *** CORREÇÃO: Corrigido o caminho para o arquivo .env ***
// Carrega as variáveis de ambiente do arquivo .env na pasta 'backend'
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });


// Importa a instância já criada do NpsService e a configuração do DB
const npsService = require('../src/services/nps/npsService');
const db = require('../src/config/database'); 

async function run() {
  console.log('--- Forçando a execução do envio de NPS para debug (v2) ---');
  
  try {
    // Invocamos diretamente o método que busca agendamentos e tenta enviar o NPS
    await npsService.enviarPesquisasPendentes();
    console.log('--- Execução forçada do NPS finalizada. Verifique os logs para o resultado e erros. ---');
  } catch (error) {
    console.error('Erro durante a execução forçada do NPS:', error);
  } finally {
    // É crucial fechar a conexão com o banco para que o script termine sua execução.
    if (db.end) {
        await db.end();
        console.log('Conexão com o banco de dados fechada.');
    }
  }
}

// A instância do NpsService no módulo já está com o cron rodando em background.
// O que fazemos aqui é apenas chamar o método de envio diretamente nessa instância.
// A linha abaixo desativa o cron para evitar que o script fique "preso" esperando.
// Isso garante que ele rode uma vez e saia.
if (npsService.iniciarCron) {
    npsService.iniciarCron = () => {}; // Sobrescrevemos para não agendar de novo
}


run();