-- Remove hardcoded CHECK constraints to allow dynamic route names beyond BARRETOS/FRANCA
ALTER TABLE public.route_config
  DROP CONSTRAINT IF EXISTS route_config_route_check;

ALTER TABLE public.payer_groups
  DROP CONSTRAINT IF EXISTS payer_groups_route_check;
