-- =========================================================
--  ASO Saúde — Migration v4: Funcionalidades 2026-03-31
--  Idempotente: seguro para rodar mesmo que parte já exista
-- =========================================================

-- 1. Colunas novas em SALAS
ALTER TABLE salas ADD COLUMN IF NOT EXISTS administrativa      BOOLEAN     DEFAULT false;
ALTER TABLE salas ADD COLUMN IF NOT EXISTS requer_adm          BOOLEAN     DEFAULT false;
ALTER TABLE salas ADD COLUMN IF NOT EXISTS limiar_contagem     INTEGER     DEFAULT 5;
ALTER TABLE salas ADD COLUMN IF NOT EXISTS hora_inicio         TIME        DEFAULT NULL;

-- 2. Coluna nova em FILA_SALAS
ALTER TABLE fila_salas ADD COLUMN IF NOT EXISTS ultima_contagem_enviada INTEGER DEFAULT NULL;

-- 3. Tabela de templates WhatsApp
CREATE TABLE IF NOT EXISTS wa_templates (
  tipo          VARCHAR(50)  PRIMARY KEY,
  titulo        VARCHAR(200) NOT NULL,
  corpo         TEXT         NOT NULL,
  variaveis     VARCHAR(500),
  atualizado_em TIMESTAMP    DEFAULT NOW()
);

-- 4. Seeds dos templates (INSERT sem substituir customizações existentes)
INSERT INTO wa_templates (tipo, titulo, corpo, variaveis) VALUES
('CHECKIN', 'Check-in confirmado',
'Olá, *{nome}*! 👋

Seu check-in no *ASO Saúde* foi confirmado com sucesso.

Você será atendido nas seguintes salas:
{lista_salas}

Por favor, aguarde ser chamado. Você receberá uma mensagem quando for sua vez em cada sala.

_Não saia das dependências da clínica._',
'{nome}, {lista_salas}'),

('CHAMADA', 'Paciente chamado',
'🔔 *{nome}*, é a sua vez!

Por favor, dirija-se agora à sala:
*{sala_nome}*{previsoes}

_Apresente-se imediatamente ao atendente._',
'{nome}, {sala_nome}, {previsoes}'),

('CONTAGEM_PROXIMO', 'Você é o próximo',
'🚨 *{nome}*, *VOCÊ É O PRÓXIMO!*

Sala: *{sala_nome}*

Apresente-se imediatamente ao atendente.',
'{nome}, {sala_nome}'),

('CONTAGEM_FILA', 'Posição na fila',
'{emoji} *{nome}*, você tem *{posicao} pessoa(s)* na frente.

Sala: *{sala_nome}*
Previsão: ~{tempo_estimado} min

{tom}',
'{nome}, {sala_nome}, {posicao}, {tempo_estimado}, {emoji}, {tom}'),

('CONCLUSAO', 'Atendimento concluído',
'✅ *{nome}*, seu *ASO* foi concluído!

Todos os exames e consultas foram realizados com sucesso.

Dirija-se à *recepção* para receber os próximos passos e orientações sobre o laudo.

Obrigado por utilizar o *ASO Saúde*. Até a próxima! 😊',
'{nome}'),

('FOLLOWUP', 'Follow-up 15 dias',
'Olá, *{nome}*! 👋

Há 15 dias você realizou seu *ASO* conosco. Esperamos que tudo tenha corrido bem!

Como você avalia nosso atendimento?
⭐ 1 - Ruim
⭐⭐ 2 - Regular
⭐⭐⭐ 3 - Bom
⭐⭐⭐⭐ 4 - Muito Bom
⭐⭐⭐⭐⭐ 5 - Excelente

Responda com o número correspondente.

_ASO Saúde — Medicina Ocupacional_',
'{nome}'),

('ATRASO', 'Aviso de atraso',
'⚠️ *{nome}*, informamos que houve um atraso no atendimento.

Sala: *{sala_nome}*
Nova previsão: ~{nova_previsao}

Você pode continuar fora da clínica. Iremos avisá-lo quando sua vez se aproximar.

_Pedimos desculpas pelo transtorno._',
'{nome}, {sala_nome}, {nova_previsao}')

ON CONFLICT (tipo) DO NOTHING;
