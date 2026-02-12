
-- =============================================
-- Restrict all remaining sensitive tables to authenticated users
-- =============================================

-- 1. PASSENGERS
DROP POLICY IF EXISTS "Passengers are viewable by all" ON passengers;
DROP POLICY IF EXISTS "Passengers can be inserted by all" ON passengers;
DROP POLICY IF EXISTS "Passengers can be updated by all" ON passengers;
DROP POLICY IF EXISTS "Passengers can be deleted by all" ON passengers;
CREATE POLICY "passengers_select_auth" ON passengers FOR SELECT TO authenticated USING (true);
CREATE POLICY "passengers_insert_auth" ON passengers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "passengers_update_auth" ON passengers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "passengers_delete_auth" ON passengers FOR DELETE TO authenticated USING (true);

-- 2. TICKET_SALES
DROP POLICY IF EXISTS "Ticket sales are viewable by all" ON ticket_sales;
DROP POLICY IF EXISTS "Ticket sales can be inserted by all" ON ticket_sales;
DROP POLICY IF EXISTS "Ticket sales can be updated by all" ON ticket_sales;
DROP POLICY IF EXISTS "Ticket sales can be deleted by all" ON ticket_sales;
CREATE POLICY "ticket_sales_select_auth" ON ticket_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_sales_insert_auth" ON ticket_sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ticket_sales_update_auth" ON ticket_sales FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ticket_sales_delete_auth" ON ticket_sales FOR DELETE TO authenticated USING (true);

-- 3. AFFILIATES
DROP POLICY IF EXISTS "Affiliates are viewable by all" ON affiliates;
DROP POLICY IF EXISTS "Affiliates can be inserted by all" ON affiliates;
DROP POLICY IF EXISTS "Affiliates can be updated by all" ON affiliates;
DROP POLICY IF EXISTS "Affiliates can be deleted by all" ON affiliates;
CREATE POLICY "affiliates_select_auth" ON affiliates FOR SELECT TO authenticated USING (true);
CREATE POLICY "affiliates_insert_auth" ON affiliates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "affiliates_update_auth" ON affiliates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "affiliates_delete_auth" ON affiliates FOR DELETE TO authenticated USING (true);

-- 4. AFFILIATE_COMMISSIONS
DROP POLICY IF EXISTS "Affiliate commissions viewable by all" ON affiliate_commissions;
DROP POLICY IF EXISTS "Affiliate commissions insertable by all" ON affiliate_commissions;
DROP POLICY IF EXISTS "Affiliate commissions updatable by all" ON affiliate_commissions;
DROP POLICY IF EXISTS "Affiliate commissions deletable by all" ON affiliate_commissions;
CREATE POLICY "aff_comm_select_auth" ON affiliate_commissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "aff_comm_insert_auth" ON affiliate_commissions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "aff_comm_update_auth" ON affiliate_commissions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "aff_comm_delete_auth" ON affiliate_commissions FOR DELETE TO authenticated USING (true);

-- 5. AFFILIATE_EXCURSIONS
DROP POLICY IF EXISTS "Affiliate excursions viewable by all" ON affiliate_excursions;
DROP POLICY IF EXISTS "Affiliate excursions insertable by all" ON affiliate_excursions;
DROP POLICY IF EXISTS "Affiliate excursions updatable by all" ON affiliate_excursions;
DROP POLICY IF EXISTS "Affiliate excursions deletable by all" ON affiliate_excursions;
CREATE POLICY "aff_exc_select_auth" ON affiliate_excursions FOR SELECT TO authenticated USING (true);
-- Anon needs to read affiliate_excursions for public checkout (to resolve affiliate tokens)
CREATE POLICY "aff_exc_select_anon" ON affiliate_excursions FOR SELECT TO anon USING (true);
CREATE POLICY "aff_exc_insert_auth" ON affiliate_excursions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "aff_exc_update_auth" ON affiliate_excursions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "aff_exc_delete_auth" ON affiliate_excursions FOR DELETE TO authenticated USING (true);

-- 6. CARDS
DROP POLICY IF EXISTS "Cards são visíveis para todos" ON cards;
DROP POLICY IF EXISTS "Cards podem ser inseridos por todos" ON cards;
DROP POLICY IF EXISTS "Cards podem ser atualizados por todos" ON cards;
DROP POLICY IF EXISTS "Cards podem ser deletados por todos" ON cards;
CREATE POLICY "cards_select_auth" ON cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "cards_insert_auth" ON cards FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cards_update_auth" ON cards FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cards_delete_auth" ON cards FOR DELETE TO authenticated USING (true);

-- 7. VEHICLES
DROP POLICY IF EXISTS "Vehicles are viewable by all" ON vehicles;
DROP POLICY IF EXISTS "Vehicles can be inserted by all" ON vehicles;
DROP POLICY IF EXISTS "Vehicles can be updated by all" ON vehicles;
DROP POLICY IF EXISTS "Vehicles can be deleted by all" ON vehicles;
CREATE POLICY "vehicles_select_auth" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles_insert_auth" ON vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "vehicles_update_auth" ON vehicles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "vehicles_delete_auth" ON vehicles FOR DELETE TO authenticated USING (true);

-- 8. COST_CENTERS
DROP POLICY IF EXISTS "Cost centers are viewable by all" ON cost_centers;
DROP POLICY IF EXISTS "Cost centers can be inserted by all" ON cost_centers;
DROP POLICY IF EXISTS "Cost centers can be updated by all" ON cost_centers;
DROP POLICY IF EXISTS "Cost centers can be deleted by all" ON cost_centers;
CREATE POLICY "cost_centers_select_auth" ON cost_centers FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_centers_insert_auth" ON cost_centers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cost_centers_update_auth" ON cost_centers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "cost_centers_delete_auth" ON cost_centers FOR DELETE TO authenticated USING (true);

-- 9. DRE_GROUPS
DROP POLICY IF EXISTS "DRE groups are viewable by all" ON dre_groups;
DROP POLICY IF EXISTS "DRE groups can be inserted by all" ON dre_groups;
DROP POLICY IF EXISTS "DRE groups can be updated by all" ON dre_groups;
DROP POLICY IF EXISTS "DRE groups can be deleted by all" ON dre_groups;
CREATE POLICY "dre_groups_select_auth" ON dre_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "dre_groups_insert_auth" ON dre_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dre_groups_update_auth" ON dre_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dre_groups_delete_auth" ON dre_groups FOR DELETE TO authenticated USING (true);

-- 10. DRE_SUBGROUPS
DROP POLICY IF EXISTS "DRE subgroups are viewable by all" ON dre_subgroups;
DROP POLICY IF EXISTS "DRE subgroups can be inserted by all" ON dre_subgroups;
DROP POLICY IF EXISTS "DRE subgroups can be updated by all" ON dre_subgroups;
DROP POLICY IF EXISTS "DRE subgroups can be deleted by all" ON dre_subgroups;
CREATE POLICY "dre_subgroups_select_auth" ON dre_subgroups FOR SELECT TO authenticated USING (true);
CREATE POLICY "dre_subgroups_insert_auth" ON dre_subgroups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dre_subgroups_update_auth" ON dre_subgroups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "dre_subgroups_delete_auth" ON dre_subgroups FOR DELETE TO authenticated USING (true);

-- 11. DRE_CATEGORIES
DROP POLICY IF EXISTS "DRE categories são visíveis para todos" ON dre_categories;
DROP POLICY IF EXISTS "DRE categories podem ser inseridos por todos" ON dre_categories;
CREATE POLICY "dre_cat_select_auth" ON dre_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "dre_cat_insert_auth" ON dre_categories FOR INSERT TO authenticated WITH CHECK (true);

-- 12. FINANCIAL_ENTRY_ALLOCATIONS - Enable RLS first
ALTER TABLE financial_entry_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fea_select_auth" ON financial_entry_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "fea_insert_auth" ON financial_entry_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fea_update_auth" ON financial_entry_allocations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "fea_delete_auth" ON financial_entry_allocations FOR DELETE TO authenticated USING (true);

-- 13. INSTALLMENT_CONTRACTS
DROP POLICY IF EXISTS "Installment contracts são visíveis para todos" ON installment_contracts;
DROP POLICY IF EXISTS "Installment contracts podem ser inseridos por todos" ON installment_contracts;
DROP POLICY IF EXISTS "Installment contracts podem ser atualizados por todos" ON installment_contracts;
DROP POLICY IF EXISTS "Installment contracts podem ser deletados por todos" ON installment_contracts;
CREATE POLICY "ic_select_auth" ON installment_contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "ic_insert_auth" ON installment_contracts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ic_update_auth" ON installment_contracts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ic_delete_auth" ON installment_contracts FOR DELETE TO authenticated USING (true);

-- 14. IMPORT_LOGS
DROP POLICY IF EXISTS "Import logs são visíveis para todos" ON import_logs;
DROP POLICY IF EXISTS "Import logs podem ser inseridos por todos" ON import_logs;
DROP POLICY IF EXISTS "Import logs podem ser atualizados por todos" ON import_logs;
CREATE POLICY "import_logs_select_auth" ON import_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "import_logs_insert_auth" ON import_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "import_logs_update_auth" ON import_logs FOR UPDATE TO authenticated USING (true);

-- 15. BILLINGS - restrict to authenticated
DROP POLICY IF EXISTS "Billings são visíveis para todos" ON billings;
DROP POLICY IF EXISTS "Billings podem ser inseridos por todos" ON billings;
DROP POLICY IF EXISTS "Billings podem ser atualizados por todos" ON billings;
DROP POLICY IF EXISTS "Billings podem ser deletados por todos" ON billings;
CREATE POLICY "billings_select_auth" ON billings FOR SELECT TO authenticated USING (true);
CREATE POLICY "billings_insert_auth" ON billings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "billings_update_auth" ON billings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "billings_delete_auth" ON billings FOR DELETE TO authenticated USING (true);

-- 16. LANDING_SETTINGS - anon can read (public site), auth can write
DROP POLICY IF EXISTS "Landing settings viewable by all" ON landing_settings;
DROP POLICY IF EXISTS "Landing settings insertable by all" ON landing_settings;
DROP POLICY IF EXISTS "Landing settings updatable by all" ON landing_settings;
DROP POLICY IF EXISTS "Landing settings deletable by all" ON landing_settings;
CREATE POLICY "ls_select_all" ON landing_settings FOR SELECT USING (true);
CREATE POLICY "ls_insert_auth" ON landing_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ls_update_auth" ON landing_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "ls_delete_auth" ON landing_settings FOR DELETE TO authenticated USING (true);

-- 17. Fix SECURITY DEFINER view: excursion_orders
DROP VIEW IF EXISTS excursion_orders;
CREATE VIEW excursion_orders WITH (security_invoker = true) AS
  SELECT id, excursion_id, affiliate_id, seat_ids, seat_numbers,
         passenger_name, passenger_document, passenger_phone, passenger_email, passenger_address,
         payment_type, pix_code, pix_qr_data, pix_expires_at, lock_expires_at,
         amount_total_cents, amount_paid_cents, amount_pending_cents,
         status, created_at, updated_at
  FROM public_orders;
