# Contexto do Projeto - Essencial Saúde

## 🌟 Identidade Visual & UX (Concluído)
- **Cores Oficiais:** 
    - 🟢 Verde Principal: `#71ca4f`
    - 🔵 Azul Principal: `#5b8dfd`
- **Landing Page:** Página inicial de alta conversão, com fluxo "Vitrine" -> "Calendário".
- **Fila em Tempo Real:** Página exclusiva (`/agendamento/fila/[id]`) onde o paciente vê sua posição e previsão de atendimento ao vivo.
- **Mensageria:** WhatsApp 100% padronizado com tickets digitais visuais (emojis, formatação).

## 🚀 Funcionalidades Operacionais (Concluído)
- **Agendamento Inteligente:** Grade flexível (15 min), suporte a horários quebrados e validação de "Retorno" (gratuito) vs "Consulta" (pago).
- **Painel de Gestão (Admin):**
    - Controle de Equipe e Horários.
    - Configuração de Valor de Consulta por Médico.
    - **Dashboard de Métricas (BI):** Evolução diária, tipos de pacientes, especialidades e performance da equipe.
- **Recepção & Médico:** Fluxo completo de check-in, atendimento e finalização com envio de prontuário digital.

## 💳 Integração Mercado Pago (Status: 90% - Bloqueio de Ambiente)
- **O que já fizemos:**
    - Estrutura de banco de dados para pagamentos.
    - Backend configurado com SDK oficial e credenciais de produção.
    - Frontend com tela de sucesso dinâmica: exibe QR Code PIX ou botão para Checkout Pro.
    - Lógica de Webhook pronta para baixar pagamentos automaticamente.
- **Onde parou (Bloqueio):** 
    - Erro `auto_return invalid` e `QR Code Inválido` ao tentar pagar.
    - **Causa Raiz:** O Mercado Pago rejeita URLs locais (`http://192.168...` ou `localhost`) e bloqueia pagamentos feitos pelo próprio titular da conta (mesmo CPF).
    - **Solução Paliativa Tentada:** Usar URLs públicas (Google) para enganar a validação, mas o bloqueio de segurança da conta persiste.

## 📝 Próximos Passos (Plano de Ação Pós-Deploy)

A prioridade absoluta agora é tirar o sistema do ambiente local e colocá-lo na internet. Isso resolverá os problemas de pagamento e permitirá o uso real.

1.  **DEPLOY EM PRODUÇÃO (Colocar Online) 🌍**
    *   Subir o Frontend e Backend para um servidor real (VPS ou PaaS).
    *   Configurar domínio/subdomínio seguro (`https://agendamento.suaclinica.com.br`).
    *   *Por que:* O Mercado Pago exige HTTPS válido para processar pagamentos e enviar Webhooks.

2.  **REATIVAR PAGAMENTOS ✅**
    *   Atualizar o arquivo `.env` no servidor com as URLs reais (`https://...`).
    *   Testar o fluxo de pagamento novamente (agora funcionará pois o ambiente é válido).
    *   Configurar o Webhook no painel do Mercado Pago apontando para o servidor.

3.  **AJUSTES FINAIS DE CHECKOUT 🛠️**
    *   Se o PIX Transparente continuar burocrático, migrar definitivamente para o **Checkout Pro** (redirecionamento), que é infalível e aceita tudo.
    *   Validar o retorno automático (tela verde) após o pagamento.

---
*Última atualização: 13/01/2026 às 13:10 - Sistema pronto para Deploy*
