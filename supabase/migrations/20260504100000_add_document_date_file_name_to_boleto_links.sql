-- Add document_date and file_name columns to support new JSON import format
alter table public.payer_boleto_links
  add column if not exists document_date date,
  add column if not exists file_name text;
