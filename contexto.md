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
- **TV Corporativa:** 
    - Painel moderno (`/tv`) para Smart TVs novas.
    - Painel Legacy (`/tv/legacy`) otimizado para LG WebOS e TVs antigas (sem Flex/Grid, API via XMLHttpRequest).

## 💳 Integração Mercado Pago (Status: 95% - Ajuste Fino)
- **O que já funciona:**
    - Token de Produção configurado.
    - Checkout Pro (Cartão) abre e processa.
    - PIX gera QR Code e processa pagamento (validado em aba anônima).
- **Onde parou (PENDÊNCIA):** 
    - **Webhook:** O pagamento é confirmado no banco (dinheiro sai da conta), mas o sistema Essencial Saúde não recebe o aviso de volta para mudar o status para "CONFIRMADO".
    - **Causa Provável:** URL do Webhook no `.env` do servidor precisa de revisão final ou o Mercado Pago está rejeitando o certificado SSL no callback.

## 📝 Próximos Passos (Plano de Ação - Manhã)

1.  **DEBUGAR WEBHOOK 🕵️‍♂️**
    *   Verificar logs do Nginx para ver se o Mercado Pago está batendo na rota `/api/pagamentos/webhook`.
    *   Testar a rota de Webhook manualmente via Postman/Curl.
    *   Se necessário, configurar um log específico para capturar o corpo do aviso do Mercado Pago.

2.  **AJUSTES FINAIS TV 📺**
    *   Confirmar se a TV Legacy carregou os vídeos (limite do Nginx aumentado para 100MB).
    *   Validar a hora da TV do cliente para garantir HTTPS.

---
*Última atualização: 14/01/2026 às 03:00 - Sistema em Produção (Beta)*