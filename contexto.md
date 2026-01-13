# Contexto do Projeto - Essencial Saúde

## Configurações Globais
- **Idioma:** PT-BR (Português Brasil)
- **Regra de Ouro:** Sempre pedir autorização antes de criar ou modificar qualquer arquivo.
- **Transparência:** Informar detalhadamente o que pretendo fazer antes de executar.

## Status do Desenvolvimento

### Ferramentas de Desenvolvimento ✅
- [x] Backend: Instalado `nodemon` e configurado script `npm run dev` para reinicialização automática.

### 1. Painel Recepção ✅
... (Já concluído)

### 2. Painel Médico ✅
- [x] Check-in, Chamar Próximo, Concluir.
- [x] Envio de Prontuário PDF via WhatsApp ao finalizar.

### 3. TV Sala de Espera ✅
- [x] Chamada visual e sonora (TTS) em tempo real.

### 4. WhatsApp (whatsapp-web.js) ✅
- [x] Conexão via QR Code no Painel Admin.
- [x] Mensagens automáticas de Confirmação e Chamada.

### 5. NPS Automatizado ✅
- [x] Tarefa agendada (Cron) para enviar pesquisa 2h após consulta.
- [x] Página de feedback para o paciente dar nota 0-10.
- [x] Registro de notas e comentários no banco.

### 6. Sistema de Estimativas ✅
- [x] Cálculo de tempo médio por médico.
- [x] Aviso WhatsApp para o próximo da fila ("Prepare-se").
- [x] Registro exato do início do atendimento.

### 7. Follow-up 15 Dias ✅
- [x] Cron Job diário (09:00).
- [x] Mensagem automática de reconexão.

## Status do Desenvolvimento (REFATORAÇÃO MAIOR - FASE 2) - CONCLUÍDO ✅

### 1. Gestão de Equipe & Médicos ✅
- [x] CRUD completo de Médicos com upload de fotos e CRM obrigatório.
- [x] Exclusão em cascata (limpa agenda ao remover médico).
- [x] Edição de dados e troca de fotos.
- [x] Configuração de intervalo (duração) personalizado por turno de atendimento.

### 2. Agendamento Inteligente (Híbrido) ✅
- [x] Suporte a Grade Recorrente (Semanal) e Datas Específicas.
- [x] Prioridade para datas exatas na busca de vagas.
- [x] Wizard de 3 Passos: Seleção de Médico -> Calendário Visual -> Dados Finais.
- [x] Correção de Timezone (Fuso Horário) no calendário.

### 3. Recepção: Centro de Comando ✅
- [x] Calendário Visual Diário (Day View) com colunas por médico.
- [x] Status coloridos: Pendente, Confirmado, Presente, Em Atendimento, Concluído.
- [x] Agendamento Balcão: Criação rápida de pacientes direto no calendário.
- [x] Check-in (Marcar Chegada) simplificado.

### 4. TV Dashboard 2.0 (Mídia Indoor) ✅
- [x] Painel de Atendimento completo com nomes gigantes para visibilidade.
- [x] Cálculo automático de Previsão de Espera cumulativa por médico.
- [x] Carrossel Multimídia Dinâmico:
    - [x] Gestão de Slides no Admin.
    - [x] Slide de Previsão do Tempo (Open-Meteo) com detalhes (vento, umidade, min/max).
    - [x] Slide de Notícias RSS (G1 Saúde) em tempo real.
- [x] Chamada Visual e Sonora (TTS) com foto do médico no overlay.

### 5. Marketing & Retenção ✅
- [x] Landing Page do Cartão Essencial Saúde (`/cartao`).
- [x] Ticket Digital rico na tela de sucesso.
- [x] Sistema de Indicação Viral ("Member Get Member") via WhatsApp.
- [x] Robô de Cobrança: Mensagens de hora em hora para pendentes e auto-cancelamento após 4h.

---
## Próximas Tarefas (Amanhã)

1.  **INTEGRAÇÃO MERCADO PAGO:**
    *   Botão de pagamento no Ticket Digital.
    *   Webhook para confirmação automática via PIX/Cartão.
2.  **AJUSTES MÉDICO:**
    *   Botão para informar atraso e recalcular fila.
3.  **POLIMENTO FINAL:**
    *   Revisão de textos e testes de carga.

---
*Última atualização: 13/01/2026 às 09:00*

