-- =========================================================
--  ASO Saúde — Migration v6: WhatsApp opcional
--  Idempotente: seguro para rodar mesmo que parte já exista
-- =========================================================

-- Tornar whatsapp opcional na tabela pacientes
ALTER TABLE pacientes ALTER COLUMN whatsapp DROP NOT NULL;
