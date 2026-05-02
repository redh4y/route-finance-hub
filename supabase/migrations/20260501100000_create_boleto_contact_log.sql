create table boleto_contact_log (
  id uuid primary key default gen_random_uuid(),
  reference_month text not null,
  cpf_digits text not null,
  message_type text not null, -- 'emissao' | 'link' | 'vencimento' | 'urgente'
  created_at timestamptz not null default now()
);

create index boleto_contact_log_lookup on boleto_contact_log (reference_month, cpf_digits);
