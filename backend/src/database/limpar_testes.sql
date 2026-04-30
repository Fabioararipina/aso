-- =========================================================
--  LIMPEZA DE DADOS DE TESTE — rodar UMA única vez
--  Remove todos os atendimentos, fila e pacientes de teste
-- =========================================================
TRUNCATE TABLE fila_salas RESTART IDENTITY CASCADE;
TRUNCATE TABLE atendimentos RESTART IDENTITY CASCADE;
TRUNCATE TABLE pacientes RESTART IDENTITY CASCADE;
