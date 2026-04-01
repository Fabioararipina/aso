-- =========================================================
--  ASO Saúde — Migration v5: Sistema de Ausência/Hibernação
--  Idempotente: seguro para rodar mesmo que parte já exista
-- =========================================================

-- 1. Expandir CHECK constraint de fila_salas para incluir HIBERNADO
ALTER TABLE fila_salas DROP CONSTRAINT IF EXISTS fila_salas_status_check;
ALTER TABLE fila_salas ADD CONSTRAINT fila_salas_status_check
  CHECK (status IN ('PENDENTE','EM_ATENDIMENTO','CONCLUIDO_SALA','HIBERNADO'));

-- 2. Coluna de tentativas de ausência
ALTER TABLE fila_salas ADD COLUMN IF NOT EXISTS tentativas_ausencia INTEGER DEFAULT 0;
