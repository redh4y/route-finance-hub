-- Update default and existing public contact data to the official WhatsApp number.

update public.landing_settings
set content = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(content, '{whatsapp}', to_jsonb('5517981606721'::text), true),
      '{phone}',
      to_jsonb('(17) 98160-6721'::text),
      true
    ),
    '{email}',
    to_jsonb('tavarestransportes017@gmail.com'::text),
    true
  ),
  '{address}',
  to_jsonb('Guaíra - SP'::text),
  true
)
where section = 'contact';

update public.public_site_content
set content_json =
  jsonb_set(
    jsonb_set(
      jsonb_set(content_json, '{whatsappUrl}', to_jsonb('https://wa.me/5517981606721'::text), true),
      '{contactPhone}',
      to_jsonb('(17) 98160-6721'::text),
      true
    ),
    '{contactEmail}',
    to_jsonb('tavarestransportes017@gmail.com'::text),
    true
  )
where page_key = 'public-excursoes-home';

update public.public_site_content
set content_json = jsonb_set(content_json, '{contactAddress}', to_jsonb('Guaíra - SP'::text), true)
where page_key = 'public-excursoes-home';
