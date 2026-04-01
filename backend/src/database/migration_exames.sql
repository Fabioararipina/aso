-- Migration v2: Tipos de Exame por Sala
-- Executar com: 4_MIGRAR.bat

-- Tipos de exame configurados por sala (ex: Admissional, Demissional, Periódico)
CREATE TABLE IF NOT EXISTS tipos_exame (
  id        SERIAL PRIMARY KEY,
  sala_id   INTEGER REFERENCES salas(id) ON DELETE CASCADE,
  nome      VARCHAR(150) NOT NULL,
  ativo     BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tipos_exame_sala ON tipos_exame(sala_id);

-- Exames selecionados para cada paciente em cada sala
CREATE TABLE IF NOT EXISTS atendimento_sala_exames (
  id            SERIAL PRIMARY KEY,
  fila_sala_id  INTEGER REFERENCES fila_salas(id) ON DELETE CASCADE,
  tipo_exame_id INTEGER REFERENCES tipos_exame(id) ON DELETE CASCADE,
  concluido     BOOLEAN DEFAULT false,
  criado_em     TIMESTAMP DEFAULT NOW(),
  UNIQUE(fila_sala_id, tipo_exame_id)
);

CREATE INDEX IF NOT EXISTS idx_ase_fila_sala ON atendimento_sala_exames(fila_sala_id);
