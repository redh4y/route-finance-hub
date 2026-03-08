-- Enable RLS on whatsapp_contacts
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all contacts
CREATE POLICY "whatsapp_contacts_select_auth"
  ON public.whatsapp_contacts
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can manage contacts
CREATE POLICY "whatsapp_contacts_write_auth"
  ON public.whatsapp_contacts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
