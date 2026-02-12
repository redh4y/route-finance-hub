
-- Create storage bucket for financial entry attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-attachments', 'financial-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "auth_users_upload_attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'financial-attachments');

-- Allow authenticated users to view
CREATE POLICY "auth_users_view_attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'financial-attachments');

-- Allow authenticated users to delete their uploads
CREATE POLICY "auth_users_delete_attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'financial-attachments');

-- Allow public read for viewing attachments
CREATE POLICY "public_view_attachments"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'financial-attachments');

-- Add attachment_url column to financial_entries
ALTER TABLE public.financial_entries
ADD COLUMN IF NOT EXISTS attachment_url text DEFAULT NULL;
