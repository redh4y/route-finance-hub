export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      billings: {
        Row: {
          amount_expected_cents: number
          amount_paid_cents: number | null
          created_at: string
          due_date: string | null
          id: string
          liquidation_at: string | null
          nosso_numero: string | null
          payer_code: string | null
          payer_id: string
          payment_method: string | null
          reference_month: string
          route: string | null
          settlement_at: string | null
          seu_numero: string | null
          source: string | null
          source_file_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_expected_cents: number
          amount_paid_cents?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          liquidation_at?: string | null
          nosso_numero?: string | null
          payer_code?: string | null
          payer_id: string
          payment_method?: string | null
          reference_month: string
          route?: string | null
          settlement_at?: string | null
          seu_numero?: string | null
          source?: string | null
          source_file_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_expected_cents?: number
          amount_paid_cents?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          liquidation_at?: string | null
          nosso_numero?: string | null
          payer_code?: string | null
          payer_id?: string
          payment_method?: string | null
          reference_month?: string
          route?: string | null
          settlement_at?: string | null
          seu_numero?: string | null
          source?: string | null
          source_file_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billings_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      ceps: {
        Row: {
          bairro: string | null
          cep: string
          cidade: string | null
          created_at: string
          logradouro: string | null
          uf: string | null
        }
        Insert: {
          bairro?: string | null
          cep: string
          cidade?: string | null
          created_at?: string
          logradouro?: string | null
          uf?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string
          cidade?: string | null
          created_at?: string
          logradouro?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      dre_categories: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          subcategory: string | null
          type: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          subcategory?: string | null
          type: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          subcategory?: string | null
          type?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount_cents: number
          billing_id: string | null
          card_id: string | null
          category: string
          competence_month: string
          cost_center_code: string | null
          cost_type: string | null
          created_at: string
          date: string
          description: string
          expense_id: string | null
          id: string
          installments_total: number | null
          parent_entry_id: string | null
          payer_id: string | null
          payment_method: string | null
          source: string
          subcategory: string | null
          type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount_cents: number
          billing_id?: string | null
          card_id?: string | null
          category: string
          competence_month: string
          cost_center_code?: string | null
          cost_type?: string | null
          created_at?: string
          date: string
          description: string
          expense_id?: string | null
          id?: string
          installments_total?: number | null
          parent_entry_id?: string | null
          payer_id?: string | null
          payment_method?: string | null
          source?: string
          subcategory?: string | null
          type: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount_cents?: number
          billing_id?: string | null
          card_id?: string | null
          category?: string
          competence_month?: string
          cost_center_code?: string | null
          cost_type?: string | null
          created_at?: string
          date?: string
          description?: string
          expense_id?: string | null
          id?: string
          installments_total?: number | null
          parent_entry_id?: string | null
          payer_id?: string | null
          payment_method?: string | null
          source?: string
          subcategory?: string | null
          type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_parent_entry_id_fkey"
            columns: ["parent_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_rows: number
          errors: Json | null
          file_name: string
          id: string
          processed_rows: number
          status: string
          success_rows: number
          total_rows: number
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          errors?: Json | null
          file_name: string
          id?: string
          processed_rows?: number
          status?: string
          success_rows?: number
          total_rows: number
          type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number
          errors?: Json | null
          file_name?: string
          id?: string
          processed_rows?: number
          status?: string
          success_rows?: number
          total_rows?: number
          type?: string
        }
        Relationships: []
      }
      payers: {
        Row: {
          address_base: string | null
          address_original: string | null
          billing_mode: string
          billing_seen_in_month: string | null
          cep: string | null
          change_log: Json | null
          city: string | null
          created_at: string
          default_route: string | null
          document: string | null
          document_digits: string | null
          document_valid: boolean | null
          email: string | null
          extra_contacts: Json | null
          id: string
          is_coordinator: boolean | null
          last_billing_ref: string | null
          last_payment_at: string | null
          manual_active_until: string | null
          match_ok: boolean | null
          name: string
          name_lower: string | null
          needs_review: boolean | null
          neighborhood: string | null
          number: string | null
          payer_code: string | null
          phone: string | null
          pix_due_day: number | null
          pix_monthly_amount_cents: number | null
          review_address: boolean | null
          review_flag: boolean | null
          review_reason: string | null
          review_status: string | null
          route: string | null
          state: string | null
          status: string
          street: string | null
          updated_at: string
        }
        Insert: {
          address_base?: string | null
          address_original?: string | null
          billing_mode?: string
          billing_seen_in_month?: string | null
          cep?: string | null
          change_log?: Json | null
          city?: string | null
          created_at?: string
          default_route?: string | null
          document?: string | null
          document_digits?: string | null
          document_valid?: boolean | null
          email?: string | null
          extra_contacts?: Json | null
          id: string
          is_coordinator?: boolean | null
          last_billing_ref?: string | null
          last_payment_at?: string | null
          manual_active_until?: string | null
          match_ok?: boolean | null
          name: string
          name_lower?: string | null
          needs_review?: boolean | null
          neighborhood?: string | null
          number?: string | null
          payer_code?: string | null
          phone?: string | null
          pix_due_day?: number | null
          pix_monthly_amount_cents?: number | null
          review_address?: boolean | null
          review_flag?: boolean | null
          review_reason?: string | null
          review_status?: string | null
          route?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
        }
        Update: {
          address_base?: string | null
          address_original?: string | null
          billing_mode?: string
          billing_seen_in_month?: string | null
          cep?: string | null
          change_log?: Json | null
          city?: string | null
          created_at?: string
          default_route?: string | null
          document?: string | null
          document_digits?: string | null
          document_valid?: boolean | null
          email?: string | null
          extra_contacts?: Json | null
          id?: string
          is_coordinator?: boolean | null
          last_billing_ref?: string | null
          last_payment_at?: string | null
          manual_active_until?: string | null
          match_ok?: boolean | null
          name?: string
          name_lower?: string | null
          needs_review?: boolean | null
          neighborhood?: string | null
          number?: string | null
          payer_code?: string | null
          phone?: string | null
          pix_due_day?: number | null
          pix_monthly_amount_cents?: number | null
          review_address?: boolean | null
          review_flag?: boolean | null
          review_reason?: string | null
          review_status?: string | null
          route?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
