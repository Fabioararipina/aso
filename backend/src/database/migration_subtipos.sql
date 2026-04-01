-- =========================================================
--  ASO Saude - Migration v3: Sub-tipos de Exame
-- =========================================================

-- 1. Permissoes para tabelas criadas na v2 (caso ainda nao tenham sido concedidas)
GRANT ALL ON TABLE tipos_exame TO aso_user;
GRANT USAGE, SELECT ON SEQUENCE tipos_exame_id_seq TO aso_user;
GRANT ALL ON TABLE atendimento_sala_exames TO aso_user;

-- 2. Tabela de sub-tipos (Ex: Admissional, Demissional, Periodico)
CREATE TABLE IF NOT EXISTS subtipos_exame (
  id            SERIAL PRIMARY KEY,
  tipo_exame_id INTEGER NOT NULL REFERENCES tipos_exame(id) ON DELETE CASCADE,
  nome          VARCHAR(150) NOT NULL,
  ativo         BOOLEAN DEFAULT true,
  criado_em     TIMESTAMP DEFAULT NOW(),
  UNIQUE(tipo_exame_id, nome)
);
CREATE INDEX IF NOT EXISTS idx_subtipos_tipo ON subtipos_exame(tipo_exame_id);

-- 3. Adaptar atendimento_sala_exames: tipo_exame_id -> subtipo_exame_id
DO $$
BEGIN
  -- Remove unique constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'atendimento_sala_exames_fila_sala_id_tipo_exame_id_key'
      AND table_name = 'atendimento_sala_exames'
  ) THEN
    ALTER TABLE atendimento_sala_exames
      DROP CONSTRAINT atendimento_sala_exames_fila_sala_id_tipo_exame_id_key;
  END IF;

  -- Remove FK antiga se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'atendimento_sala_exames_tipo_exame_id_fkey'
      AND table_name = 'atendimento_sala_exames'
  ) THEN
    ALTER TABLE atendimento_sala_exames
      DROP CONSTRAINT atendimento_sala_exames_tipo_exame_id_fkey;
  END IF;

  -- Renomeia coluna se ainda nao foi renomeada
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atendimento_sala_exames' AND column_name = 'tipo_exame_id'
  ) THEN
    ALTER TABLE atendimento_sala_exames RENAME COLUMN tipo_exame_id TO subtipo_exame_id;
  END IF;

  -- Adiciona FK para subtipos_exame se ainda nao existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'atendimento_sala_exames_subtipo_exame_id_fkey'
      AND table_name = 'atendimento_sala_exames'
  ) THEN
    ALTER TABLE atendimento_sala_exames
      ADD CONSTRAINT atendimento_sala_exames_subtipo_exame_id_fkey
      FOREIGN KEY (subtipo_exame_id) REFERENCES subtipos_exame(id) ON DELETE CASCADE;
  END IF;

  -- Adiciona nova unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'atendimento_sala_exames_fila_sala_id_subtipo_exame_id_key'
      AND table_name = 'atendimento_sala_exames'
  ) THEN
    ALTER TABLE atendimento_sala_exames
      ADD CONSTRAINT atendimento_sala_exames_fila_sala_id_subtipo_exame_id_key
      UNIQUE(fila_sala_id, subtipo_exame_id);
  END IF;
END $$;

-- 4. Permissoes para novas tabelas
GRANT ALL ON TABLE subtipos_exame TO aso_user;
GRANT USAGE, SELECT ON SEQUENCE subtipos_exame_id_seq TO aso_user;
