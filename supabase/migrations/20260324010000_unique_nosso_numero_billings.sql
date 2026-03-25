-- Garante que nosso_numero é único por boleto.
-- nosso_numero é o identificador do boleto no banco emissor — nunca deve haver dois
-- registros com o mesmo valor neste campo.
--
-- A limpeza de duplicatas deve ser feita ANTES de aplicar esta migration.
-- Query de limpeza: ver docs/obsidian/ ou histórico de sessão.

ALTER TABLE billings
  ADD CONSTRAINT billings_nosso_numero_unique UNIQUE (nosso_numero);
