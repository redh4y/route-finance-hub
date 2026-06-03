alter table boleto_contact_log
  add column if not exists source text,
  add column if not exists batch_id uuid;
