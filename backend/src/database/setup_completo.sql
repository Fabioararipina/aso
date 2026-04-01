-- ============================================================
-- ASO SAÚDE — Setup Completo do Banco de Dados
-- Execute este arquivo UMA VEZ para criar tudo
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Salas
CREATE TABLE IF NOT EXISTS salas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  tempo_medio_min INTEGER NOT NULL DEFAULT 15,
  limiar_contagem INTEGER NOT NULL DEFAULT 5,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

INSERT INTO salas (nome, slug, tempo_medio_min) VALUES
  ('Laboratório', 'laboratorio', 10),
  ('Médico', 'medico', 20),
  ('Audiometria', 'audiometria', 15),
  ('ECG', 'ecg', 10),
  ('Raio-X', 'raio-x', 8),
  ('Psicóloga', 'psicologa', 25)
ON CONFLICT (slug) DO NOTHING;

-- Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  whatsapp VARCHAR(20) NOT NULL,
  cpf VARCHAR(14),
  data_nascimento DATE,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Atendimentos
CREATE TABLE IF NOT EXISTS atendimentos (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER REFERENCES pacientes(id),
  empresa VARCHAR(200),
  cnpj VARCHAR(18),
  funcao VARCHAR(100),
  tipo_aso VARCHAR(30),
  status VARCHAR(20) DEFAULT 'PRESENTE',
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- Fila por sala
CREATE TABLE IF NOT EXISTS fila_salas (
  id SERIAL PRIMARY KEY,
  atendimento_id INTEGER REFERENCES atendimentos(id),
  sala_id INTEGER REFERENCES salas(id),
  posicao INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDENTE',
  ultima_contagem_enviada INTEGER DEFAULT NULL,
  chamado_em TIMESTAMP,
  concluido_em TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  usuario VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(200),
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) DEFAULT 'RECEPCAO',
  sala_id INTEGER REFERENCES salas(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Log de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS wa_mensagens_log (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER REFERENCES pacientes(id),
  tipo VARCHAR(50),
  mensagem TEXT,
  enviado_em TIMESTAMP DEFAULT NOW()
);

-- Templates de mensagens WhatsApp
CREATE TABLE IF NOT EXISTS wa_templates (
  tipo VARCHAR(50) PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  corpo TEXT NOT NULL,
  variaveis VARCHAR(500),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

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

-- Mídias da TV
CREATE TABLE IF NOT EXISTS tv_midias (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(10) DEFAULT 'IMAGEM',
  arquivo VARCHAR(500),
  conteudo TEXT,
  duracao_seg INTEGER NOT NULL DEFAULT 10,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_criado_em ON atendimentos(criado_em);
CREATE INDEX IF NOT EXISTS idx_fila_salas_atendimento ON fila_salas(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_fila_salas_sala_status ON fila_salas(sala_id, status);

-- Usuário admin padrão (senha: admin123)
INSERT INTO usuarios (nome, usuario, senha_hash, perfil)
VALUES ('Administrador', 'admin', '$2b$10$5jwRpMVPTLdaUzX5XyUVf.etLYjvzOUzzeVUs0nsO0m7rGlYClEhq', 'ADMIN')
ON CONFLICT (usuario) DO NOTHING;
