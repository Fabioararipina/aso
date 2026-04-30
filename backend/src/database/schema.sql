-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS salas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  tempo_medio_min INTEGER NOT NULL DEFAULT 15,
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

CREATE TABLE IF NOT EXISTS pacientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  whatsapp VARCHAR(20),
  cpf VARCHAR(14),
  data_nascimento DATE,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS atendimentos (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER REFERENCES pacientes(id),
  empresa VARCHAR(200),
  cnpj VARCHAR(18),
  funcao VARCHAR(100),
  tipo_aso VARCHAR(30) CHECK (tipo_aso IN ('ADMISSIONAL','PERIODICO','DEMISSIONAL','RETORNO','MUDANCA_FUNCAO')),
  status VARCHAR(20) DEFAULT 'PRESENTE' CHECK (status IN ('EM_CADASTRO','PRESENTE','EM_ATENDIMENTO','CONCLUIDO','CANCELADO')),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fila_salas (
  id SERIAL PRIMARY KEY,
  atendimento_id INTEGER REFERENCES atendimentos(id),
  sala_id INTEGER REFERENCES salas(id),
  posicao INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','EM_ATENDIMENTO','CONCLUIDO_SALA')),
  chamado_em TIMESTAMP,
  concluido_em TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  usuario VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(200),
  senha_hash VARCHAR(255) NOT NULL,
  perfil VARCHAR(20) CHECK (perfil IN ('ADMIN','RECEPCAO','OPERADOR','TV')),
  sala_id INTEGER REFERENCES salas(id),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wa_mensagens_log (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER REFERENCES pacientes(id),
  tipo VARCHAR(50),
  mensagem TEXT,
  enviado_em TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_atendimentos_status ON atendimentos(status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_criado_em ON atendimentos(criado_em);
CREATE INDEX IF NOT EXISTS idx_fila_salas_atendimento ON fila_salas(atendimento_id);
CREATE INDEX IF NOT EXISTS idx_fila_salas_sala_status ON fila_salas(sala_id, status);

CREATE TABLE IF NOT EXISTS tv_midias (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(10) CHECK (tipo IN ('IMAGEM','VIDEO')) NOT NULL,
  arquivo VARCHAR(500) NOT NULL,
  duracao_seg INTEGER NOT NULL DEFAULT 10,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);
