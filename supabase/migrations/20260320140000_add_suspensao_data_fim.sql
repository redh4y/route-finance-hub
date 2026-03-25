-- Renomeia suspensao_data para suspensao_data_inicio e adiciona suspensao_data_fim
ALTER TABLE student_warnings
  RENAME COLUMN suspensao_data TO suspensao_data_inicio;

ALTER TABLE student_warnings
  ADD COLUMN suspensao_data_fim date;
