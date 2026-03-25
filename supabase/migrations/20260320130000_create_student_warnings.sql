-- Tabela de advertências e suspensões de alunos
-- Registra infrações ao regulamento do transporte (contrato Tavares 2026)

CREATE TABLE student_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_nome text NOT NULL,
  aluno_id uuid REFERENCES payers(id) ON DELETE SET NULL,
  coordenador_nome text NOT NULL,
  onibus_cor text,
  data_ocorrencia date NOT NULL DEFAULT CURRENT_DATE,
  infracoes text[] NOT NULL DEFAULT '{}',
  outro_motivo text,
  gravidade text NOT NULL CHECK (gravidade IN ('LEVE_MODERADA', 'GRAVE')),
  penalidade text NOT NULL CHECK (penalidade IN ('ADVERTENCIA_ESCRITA', 'SUSPENSAO', 'EXCLUSAO')),
  numero_advertencia integer,
  suspensao_dias integer,
  suspensao_data date,
  suspensao_motivo text CHECK (suspensao_motivo IN ('REINCIDENCIA', 'FALTA_GRAVE')),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE student_warnings IS 'Advertências e suspensões emitidas a alunos por descumprimento do regulamento de transporte.';
COMMENT ON COLUMN student_warnings.infracoes IS 'Array de códigos: DESRESPEITO, BRIGAS, BARULHO, CONSUMO, LIMPEZA, ASSENTOS, OUTRO';
COMMENT ON COLUMN student_warnings.numero_advertencia IS 'Qual número de advertência escrita (1ª, 2ª, etc.)';

CREATE INDEX student_warnings_aluno_idx ON student_warnings (aluno_nome);
CREATE INDEX student_warnings_data_idx ON student_warnings (data_ocorrencia DESC);
CREATE INDEX student_warnings_aluno_id_idx ON student_warnings (aluno_id) WHERE aluno_id IS NOT NULL;

ALTER TABLE student_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can manage student_warnings"
  ON student_warnings FOR ALL TO authenticated USING (true) WITH CHECK (true);
