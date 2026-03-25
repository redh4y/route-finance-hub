-- Tabela de aliases de bairro configuráveis
-- Substitui os 27 aliases hardcoded em _mapBairroAlias() no address-match-engine.ts
-- Permite que o operador adicione/edite aliases diretamente na UI sem deploy

CREATE TABLE IF NOT EXISTS bairro_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrada text NOT NULL,
  bairro_canonico text NOT NULL,
  complemento text,
  match_type text NOT NULL DEFAULT 'CONTAINS' CHECK (match_type IN ('EXACT', 'CONTAINS')),
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bairro_aliases IS 'Aliases de bairro para normalização no match de endereços. entrada deve estar em UPPERCASE sem acentos (formato normText).';
COMMENT ON COLUMN bairro_aliases.entrada IS 'Padrão a buscar no texto do bairro normalizado (UPPERCASE, sem acentos).';
COMMENT ON COLUMN bairro_aliases.match_type IS 'EXACT = igualdade exata, CONTAINS = substring (rawNorm.includes(entrada)).';
COMMENT ON COLUMN bairro_aliases.ordem IS 'Prioridade de avaliação: menor = primeiro. Dentro do mesmo ordem, padrões mais longos têm precedência.';

CREATE INDEX IF NOT EXISTS bairro_aliases_ativo_ordem_idx ON bairro_aliases (ativo, ordem);

ALTER TABLE bairro_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read bairro_aliases"
  ON bairro_aliases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can write bairro_aliases"
  ON bairro_aliases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────
-- Seed: migração dos 27 aliases hardcoded em _mapBairroAlias()
-- Padrões mais longos/específicos têm ordem menor para garantir
-- precedência sobre padrões genéricos (ex: "COHAB II" antes de "COHAB I")
-- ──────────────────────────────────────────────────────────────
INSERT INTO bairro_aliases (entrada, bairro_canonico, complemento, match_type, ordem) VALUES
-- COHAB II / COAB II (antes de COHAB I para evitar falso match de substring)
('COHAB II',  'Mario Garcia da Costa', null, 'CONTAINS', 10),
('COAB II',   'Mario Garcia da Costa', null, 'CONTAINS', 10),
('CHOAB II',  'Mario Garcia da Costa', null, 'CONTAINS', 10),
('COHAB 2',   'Mario Garcia da Costa', null, 'CONTAINS', 10),
('COAB 2',    'Mario Garcia da Costa', null, 'CONTAINS', 10),
('COHAB2',    'Mario Garcia da Costa', null, 'CONTAINS', 10),
('COAB2',     'Mario Garcia da Costa', null, 'CONTAINS', 10),

-- COHAB I / COAB I
('COHAB I',  'Doutor Fábio Talarico', null, 'CONTAINS', 10),
('COAB I',   'Doutor Fábio Talarico', null, 'CONTAINS', 10),
('CHOAB I',  'Doutor Fábio Talarico', null, 'CONTAINS', 10),
('COHAB 1',  'Doutor Fábio Talarico', null, 'CONTAINS', 10),
('COAB 1',   'Doutor Fábio Talarico', null, 'CONTAINS', 10),
('COHAB1',   'Doutor Fábio Talarico', null, 'CONTAINS', 10),
('COAB1',    'Doutor Fábio Talarico', null, 'CONTAINS', 10),

-- MUTIRAO
('MUTIRAO 1',  'Conjunto Habitacional Padre Mário Lano', null, 'CONTAINS', 10),
('MUTIRAO1',   'Conjunto Habitacional Padre Mário Lano', null, 'CONTAINS', 10),
('MUTIRAO 3',  'Etelvina Santana da Silva',              null, 'CONTAINS', 10),
('MUTIRAO3',   'Etelvina Santana da Silva',              null, 'CONTAINS', 10),

-- CECAP (match exato para evitar colisão com outros nomes)
('CECAP', 'Conjunto Habitacional Geralda Geltrudes da Silva', null, 'EXACT', 10),

-- Campos Elíseos (padrões compostos antes do fragmento curto)
('CAMPOS ELIZIO', 'Campos Elíseos', null, 'CONTAINS', 10),
('CAMPOS ELISA',  'Campos Elíseos', null, 'CONTAINS', 10),
('ELIZIO',        'Campos Elíseos', null, 'CONTAINS', 20),

-- Jardim Eliza (padrões compostos antes de ELIZA sozinho)
('JARDIM ELIZA', 'Jardim Eliza', null, 'CONTAINS', 10),
('JARDIM ELISA', 'Jardim Eliza', null, 'CONTAINS', 10),
('JD ELIZA',     'Jardim Eliza', null, 'CONTAINS', 10),
('ELIZA',        'Jardim Eliza', null, 'CONTAINS', 20),

-- João Vaccaro
('BAIRRO JOAO VACARO', 'João Vaccaro', null, 'CONTAINS', 10),
('JOAO VACCARO',       'João Vaccaro', null, 'CONTAINS', 10),
('JOAO VACARO',        'João Vaccaro', null, 'CONTAINS', 10),

-- Conjunto Habitacional Prefeito José Pugliesi
('JOSE PUGLIESI', 'Conjunto Habitacional Prefeito José Pugliesi', null, 'CONTAINS', 10),
('JOSE PUGLIESE', 'Conjunto Habitacional Prefeito José Pugliesi', null, 'CONTAINS', 10),

-- Residencial Reynaldo Stein
('REINALDO STEIN', 'Residencial Reynaldo Stein', null, 'CONTAINS', 10),
('REYNALDO STEIN', 'Residencial Reynaldo Stein', null, 'CONTAINS', 10),
('REINALDO STEM',  'Residencial Reynaldo Stein', null, 'CONTAINS', 10),

-- Residencial Nobre Ville
('VILLE', 'Residencial Nobre Ville', null, 'CONTAINS', 10),

-- Vila São Bom Jesus Lapa
('BOM JESUS', 'Vila São Bom Jesus Lapa', null, 'CONTAINS', 10),

-- Residencial Nadia (4 antes do genérico)
('NADIA 4', 'Residencial Nadia 4', null, 'CONTAINS', 10),
('NADIA',   'Residencial Nadia',   null, 'CONTAINS', 20),

-- Desmembramento Recreio Santa Isabel
('SANTA ISABEL', 'Desmembramento Recreio Santa Isabel', null, 'CONTAINS', 10),

-- Jardim São Francisco I (match exato)
('SAO FRANCISCO', 'Jardim São Francisco I', null, 'EXACT', 10),

-- Vivendas do Bom Jardim
('VIVENDAS', 'Vivendas do Bom Jardim', null, 'CONTAINS', 10),

-- Conjunto Residencial Antonio Garcia
('TONICO GARCIA', 'Conjunto Residencial Antonio Garcia', null, 'CONTAINS', 10),

-- Conjunto Habitacional Gabriel Garcia de Carvalho
('BAIRRO GUAIRA E', 'Conjunto Habitacional Gabriel Garcia de Carvalho', null, 'CONTAINS', 10),
('GUAIRA E',        'Conjunto Habitacional Gabriel Garcia de Carvalho', null, 'CONTAINS', 10),

-- Portal do Lago (com complemento A/B; variantes específicas antes do genérico)
('PORTAL DO LAGO A', 'Portal do Lago', 'A', 'CONTAINS', 10),
('PORTAL DO LAGO B', 'Portal do Lago', 'B', 'CONTAINS', 10),
('PORTAL DO LAGO',   'Portal do Lago', null, 'CONTAINS', 20),

-- Residencial Muraishi (II antes do genérico)
('MURAISHI II', 'Residencial Muraishi II', null, 'CONTAINS', 10),
('MURAISHI 2',  'Residencial Muraishi II', null, 'CONTAINS', 10),
('MURAISHI',    'Residencial Muraishi',    null, 'CONTAINS', 20),

-- Residencial Antonio Nery Lopes
('BANESPINHA', 'Residencial Antonio Nery Lopes', null, 'CONTAINS', 10);
