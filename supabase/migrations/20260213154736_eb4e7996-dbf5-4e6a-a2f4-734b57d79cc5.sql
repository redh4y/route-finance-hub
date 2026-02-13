
-- 1. Drivers table
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cpf text,
  rg text,
  address text,
  phone text,
  status text NOT NULL DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_select_auth" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_insert_auth" ON public.drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "drivers_update_auth" ON public.drivers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "drivers_delete_auth" ON public.drivers FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Maintenance tickets table
CREATE TYPE public.maintenance_priority AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');
CREATE TYPE public.maintenance_status AS ENUM ('ABERTO', 'EM_ANALISE', 'EM_EXECUCAO', 'AGUARDANDO_PECA', 'CONCLUIDO', 'CANCELADO');

CREATE TABLE public.maintenance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES public.vehicles(id),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  title text NOT NULL,
  description text,
  priority maintenance_priority NOT NULL DEFAULT 'MEDIA',
  status maintenance_status NOT NULL DEFAULT 'ABERTO',
  reported_by text,
  reported_at timestamptz NOT NULL DEFAULT now(),
  category text,
  subcategory text,
  impact_type text,
  sla_deadline timestamptz,
  -- Completion/financial fields
  completed_at timestamptz,
  parts_cost_cents integer DEFAULT 0,
  labor_cost_cents integer DEFAULT 0,
  total_cost_cents integer DEFAULT 0,
  cost_type text, -- CUSTO or DESPESA
  group_id uuid REFERENCES public.dre_groups(id),
  subgroup_id uuid REFERENCES public.dre_subgroups(id),
  payment_method text,
  service_date date,
  supplier text,
  financial_entry_id uuid REFERENCES public.financial_entries(id),
  attachment_urls text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicle_or_cost_center CHECK (vehicle_id IS NOT NULL OR cost_center_id IS NOT NULL)
);

ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mt_select_auth" ON public.maintenance_tickets FOR SELECT TO authenticated USING (true);
CREATE POLICY "mt_insert_auth" ON public.maintenance_tickets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mt_update_auth" ON public.maintenance_tickets FOR UPDATE TO authenticated USING (true);
CREATE POLICY "mt_delete_auth" ON public.maintenance_tickets FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_mt_updated_at BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Inspection checklists table
CREATE TABLE public.inspection_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
  driver_id uuid REFERENCES public.drivers(id),
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_name text,
  items jsonb NOT NULL DEFAULT '[]',
  observations text,
  status text NOT NULL DEFAULT 'PENDENTE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspection_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ic_select_auth" ON public.inspection_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY "ic_insert_auth" ON public.inspection_checklists FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ic_update_auth" ON public.inspection_checklists FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ic_delete_auth" ON public.inspection_checklists FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_ic_updated_at BEFORE UPDATE ON public.inspection_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Storage bucket for maintenance attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('maintenance-attachments', 'maintenance-attachments', true);

CREATE POLICY "maint_att_select" ON storage.objects FOR SELECT USING (bucket_id = 'maintenance-attachments');
CREATE POLICY "maint_att_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'maintenance-attachments');
CREATE POLICY "maint_att_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'maintenance-attachments');
CREATE POLICY "maint_att_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'maintenance-attachments');

-- 5. Indexes
CREATE INDEX idx_mt_vehicle ON public.maintenance_tickets(vehicle_id);
CREATE INDEX idx_mt_status ON public.maintenance_tickets(status);
CREATE INDEX idx_mt_priority ON public.maintenance_tickets(priority);
CREATE INDEX idx_ic_vehicle ON public.inspection_checklists(vehicle_id);
CREATE INDEX idx_ic_date ON public.inspection_checklists(inspection_date);

-- 6. Enable audit on maintenance_tickets
CREATE TRIGGER audit_maintenance_tickets
  AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
