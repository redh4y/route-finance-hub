-- Seed DRE groups and subgroups

-- CUSTO groups
insert into public.dre_groups (nature, name) values
('CUSTO','Motoristas'),
('CUSTO','Combustível'),
('CUSTO','Manutenção de Veículos'),
('CUSTO','Documentação e Regularização'),
('CUSTO','Seguros'),
('CUSTO','Depreciação'),
('CUSTO','Pedágios')
ON CONFLICT DO NOTHING;

-- DESPESA groups
insert into public.dre_groups (nature, name) values
('DESPESA','Administrativo'),
('DESPESA','Comercial'),
('DESPESA','Financeiro'),
('DESPESA','Estrutura Física'),
('DESPESA','Outros')
ON CONFLICT DO NOTHING;

-- RECEITA groups
insert into public.dre_groups (nature, name) values
('RECEITA','Mensalidades'),
('RECEITA','Viagens Extras')
ON CONFLICT DO NOTHING;

-- Subgroups for CUSTO: Motoristas
insert into public.dre_subgroups (group_id, name)
select id, unnest(array[
  'Salário',
  'Diárias',
  'Horas extras',
  'Encargos trabalhistas (INSS, FGTS)',
  'Férias + 1/3',
  '13º salário',
  'Rescisões'
]) from public.dre_groups where nature='CUSTO' and name='Motoristas'
ON CONFLICT DO NOTHING;

-- CUSTO: Combustível
insert into public.dre_subgroups (group_id, name)
select id, unnest(array['Diesel','Aditivos','ARLA 32'])
from public.dre_groups where nature='CUSTO' and name='Combustível'
ON CONFLICT DO NOTHING;

-- CUSTO: Manutenção de Veículos
insert into public.dre_subgroups (group_id, name)
select id, unnest(array[
  'Peças',
  'Mão de obra mecânica',
  'Troca de óleo',
  'Filtros',
  'Pneus',
  'Alinhamento e balanceamento',
  'Lavagem',
  'Manutenção preventiva',
  'Manutenção corretiva'
]) from public.dre_groups where nature='CUSTO' and name='Manutenção de Veículos'
ON CONFLICT DO NOTHING;

-- CUSTO: Documentação e Regularização
insert into public.dre_subgroups (group_id, name)
select id, unnest(array[
  'Licenciamento',
  'IPVA',
  'Vistoria',
  'ANTT / Artesp',
  'Tacógrafo (aferição)',
  'Seguro obrigatório'
]) from public.dre_groups where nature='CUSTO' and name='Documentação e Regularização'
ON CONFLICT DO NOTHING;

-- CUSTO: Seguros
insert into public.dre_subgroups (group_id, name)
select id, unnest(array[
  'Seguro do veículo',
  'Seguro de passageiros',
  'Seguro contra terceiros'
]) from public.dre_groups where nature='CUSTO' and name='Seguros'
ON CONFLICT DO NOTHING;

-- CUSTO: Depreciação
insert into public.dre_subgroups (group_id, name)
select id, unnest(array[
  'Depreciação dos ônibus',
  'Depreciação de equipamentos (ex: câmeras)'
]) from public.dre_groups where nature='CUSTO' and name='Depreciação'
ON CONFLICT DO NOTHING;

-- CUSTO: Pedágios
insert into public.dre_subgroups (group_id, name)
select id, unnest(array['Pedágios fixos da rota','Pedágios eventuais'])
from public.dre_groups where nature='CUSTO' and name='Pedágios'
ON CONFLICT DO NOTHING;

-- DESPESA: Administrativo
insert into public.dre_subgroups (group_id, name)
select id, unnest(array[
  'Pró-labore',
  'Salário administrativo',
  'Encargos',
  'Contabilidade',
  'Honorários jurídicos',
  'Sistema / Software',
  'Internet',
  'Energia elétrica',
  'Telefone'
]) from public.dre_groups where nature='DESPESA' and name='Administrativo'
ON CONFLICT DO NOTHING;

-- DESPESA: Comercial
insert into public.dre_subgroups (group_id, name)
select id, unnest(array['Marketing','Impulsionamento','Designer','Impressos'])
from public.dre_groups where nature='DESPESA' and name='Comercial'
ON CONFLICT DO NOTHING;

-- DESPESA: Financeiro
insert into public.dre_subgroups (group_id, name)
select id, unnest(array[
  'Taxas bancárias',
  'Juros',
  'Multas',
  'Tarifas de boleto / PIX',
  'Antecipação de recebíveis'
]) from public.dre_groups where nature='DESPESA' and name='Financeiro'
ON CONFLICT DO NOTHING;

-- DESPESA: Estrutura Física
insert into public.dre_subgroups (group_id, name)
select id, unnest(array['Aluguel (se houver)','IPTU','Água','Manutenção do escritório'])
from public.dre_groups where nature='DESPESA' and name='Estrutura Física'
ON CONFLICT DO NOTHING;

-- DESPESA: Outros
insert into public.dre_subgroups (group_id, name)
select id, unnest(array['Uniformes','Treinamentos','Multas de trânsito','Brindes'])
from public.dre_groups where nature='DESPESA' and name='Outros'
ON CONFLICT DO NOTHING;

-- RECEITA: Mensalidades
insert into public.dre_subgroups (group_id, name)
select id, unnest(array['Alunos','Fretamento'])
from public.dre_groups where nature='RECEITA' and name='Mensalidades'
ON CONFLICT DO NOTHING;
