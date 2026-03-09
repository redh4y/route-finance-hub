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
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount_sold_cents: number
          commission_cents: number
          created_at: string
          excursion_id: string
          id: string
          order_id: string
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount_sold_cents?: number
          commission_cents?: number
          created_at?: string
          excursion_id: string
          id?: string
          order_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount_sold_cents?: number
          commission_cents?: number
          created_at?: string
          excursion_id?: string
          id?: string
          order_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "excursion_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_excursions: {
        Row: {
          affiliate_id: string
          affiliate_token: string
          commission_type_override: string | null
          commission_value_override: number | null
          created_at: string
          excursion_id: string
          id: string
        }
        Insert: {
          affiliate_id: string
          affiliate_token: string
          commission_type_override?: string | null
          commission_value_override?: number | null
          created_at?: string
          excursion_id: string
          id?: string
        }
        Update: {
          affiliate_id?: string
          affiliate_token?: string
          commission_type_override?: string | null
          commission_value_override?: number | null
          created_at?: string
          excursion_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_excursions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_excursions_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          commission_type: string
          commission_value: number
          created_at: string
          email: string | null
          id: string
          name: string
          responsible: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          email?: string | null
          id?: string
          name: string
          responsible?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          commission_type?: string
          commission_value?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          responsible?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          accuracy: number | null
          bus_id: string
          check_in_time: string
          created_at: string
          date: string
          evidence: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          method: string
          notes: string | null
          status: string
          student_id: string
          trip_id: string
          trip_type: string
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          bus_id: string
          check_in_time?: string
          created_at?: string
          date: string
          evidence?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          method: string
          notes?: string | null
          status?: string
          student_id: string
          trip_id: string
          trip_type: string
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          bus_id?: string
          check_in_time?: string
          created_at?: string
          date?: string
          evidence?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          method?: string
          notes?: string | null
          status?: string
          student_id?: string
          trip_id?: string
          trip_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "transport_buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_events: {
        Row: {
          attendance_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json | null
        }
        Insert: {
          attendance_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
        }
        Update: {
          attendance_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_events_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          actor_email: string | null
          actor_user_id: string | null
          changed_fields: string[]
          created_at: string
          id: string
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string | null
          request_meta: Json | null
          request_path: string | null
          table_name: string
        }
        Insert: {
          actor_email?: string | null
          actor_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id?: string | null
          request_meta?: Json | null
          request_path?: string | null
          table_name: string
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string | null
          request_meta?: Json | null
          request_path?: string | null
          table_name?: string
        }
        Relationships: []
      }
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
          payer_id: string | null
          payment_method: string | null
          reference_month: string
          route: string | null
          run_id: string | null
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
          payer_id?: string | null
          payment_method?: string | null
          reference_month: string
          route?: string | null
          run_id?: string | null
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
          payer_id?: string | null
          payment_method?: string | null
          reference_month?: string
          route?: string | null
          run_id?: string | null
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
      bus_assignments: {
        Row: {
          active: boolean
          bus_id: string
          created_at: string
          id: string
          trip_id: string
        }
        Insert: {
          active?: boolean
          bus_id: string
          created_at?: string
          id?: string
          trip_id: string
        }
        Update: {
          active?: boolean
          bus_id?: string
          created_at?: string
          id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_assignments_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "transport_buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_assignments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          active: boolean
          card_last4: string | null
          card_number: string | null
          closing_day: number | null
          created_at: string
          due_day: number | null
          id: string
          name: string
          provider: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          card_last4?: string | null
          card_number?: string | null
          closing_day?: number | null
          created_at?: string
          due_day?: number | null
          id?: string
          name: string
          provider?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          card_last4?: string | null
          card_number?: string | null
          closing_day?: number | null
          created_at?: string
          due_day?: number | null
          id?: string
          name?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
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
      cost_centers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
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
      dre_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          nature: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          nature: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          nature?: string
          updated_at?: string
        }
        Relationships: []
      }
      dre_subgroups: {
        Row: {
          created_at: string
          group_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_subgroups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dre_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          address: string | null
          cpf: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          rg: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          rg?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cpf?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          rg?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      excursion_seats: {
        Row: {
          blocked: boolean
          created_at: string
          excursion_id: string
          id: string
          seat_number: number
          status: string
          updated_at: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          excursion_id: string
          id?: string
          seat_number: number
          status?: string
          updated_at?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          excursion_id?: string
          id?: string
          seat_number?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "excursion_seats_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
        ]
      }
      excursions: {
        Row: {
          boarding_location: string | null
          cost_center_id: string | null
          created_at: string
          departure_at: string
          destination: string
          destination_state: string | null
          drivers: string[] | null
          id: string
          name: string
          notes: string | null
          pix_expiration_minutes: number
          public_enabled: boolean
          public_token: string | null
          return_at: string | null
          seat_price_cents: number
          status: string
          total_seats: number
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          boarding_location?: string | null
          cost_center_id?: string | null
          created_at?: string
          departure_at: string
          destination: string
          destination_state?: string | null
          drivers?: string[] | null
          id?: string
          name: string
          notes?: string | null
          pix_expiration_minutes?: number
          public_enabled?: boolean
          public_token?: string | null
          return_at?: string | null
          seat_price_cents?: number
          status?: string
          total_seats?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          boarding_location?: string | null
          cost_center_id?: string | null
          created_at?: string
          departure_at?: string
          destination?: string
          destination_state?: string | null
          drivers?: string[] | null
          id?: string
          name?: string
          notes?: string | null
          pix_expiration_minutes?: number
          public_enabled?: boolean
          public_token?: string | null
          return_at?: string | null
          seat_price_cents?: number
          status?: string
          total_seats?: number
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "excursions_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "excursions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount_cents: number
          attachment_url: string | null
          billing_id: string | null
          card_id: string | null
          category: string
          competence_month: string
          contract_id: string | null
          cost_center_code: string | null
          cost_center_id: string | null
          cost_type: string | null
          created_at: string
          date: string
          description: string
          expense_id: string | null
          group_id: string | null
          id: string
          installment_current: number | null
          installment_total: number | null
          installments_total: number | null
          invoice_month: string | null
          needs_classification: boolean
          needs_review: boolean
          operation_date: string | null
          parent_entry_id: string | null
          payer_id: string | null
          payment_method: string | null
          review_reasons: string[]
          run_id: string | null
          source: string
          status: string | null
          subcategory: string | null
          subgroup_id: string | null
          type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount_cents: number
          attachment_url?: string | null
          billing_id?: string | null
          card_id?: string | null
          category: string
          competence_month: string
          contract_id?: string | null
          cost_center_code?: string | null
          cost_center_id?: string | null
          cost_type?: string | null
          created_at?: string
          date: string
          description: string
          expense_id?: string | null
          group_id?: string | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          installments_total?: number | null
          invoice_month?: string | null
          needs_classification?: boolean
          needs_review?: boolean
          operation_date?: string | null
          parent_entry_id?: string | null
          payer_id?: string | null
          payment_method?: string | null
          review_reasons?: string[]
          run_id?: string | null
          source?: string
          status?: string | null
          subcategory?: string | null
          subgroup_id?: string | null
          type: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount_cents?: number
          attachment_url?: string | null
          billing_id?: string | null
          card_id?: string | null
          category?: string
          competence_month?: string
          contract_id?: string | null
          cost_center_code?: string | null
          cost_center_id?: string | null
          cost_type?: string | null
          created_at?: string
          date?: string
          description?: string
          expense_id?: string | null
          group_id?: string | null
          id?: string
          installment_current?: number | null
          installment_total?: number | null
          installments_total?: number | null
          invoice_month?: string | null
          needs_classification?: boolean
          needs_review?: boolean
          operation_date?: string | null
          parent_entry_id?: string | null
          payer_id?: string | null
          payment_method?: string | null
          review_reasons?: string[]
          run_id?: string | null
          source?: string
          status?: string | null
          subcategory?: string | null
          subgroup_id?: string | null
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
            foreignKeyName: "financial_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dre_groups"
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
          {
            foreignKeyName: "financial_entries_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "dre_subgroups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entry_allocations: {
        Row: {
          amount_cents: number | null
          created_at: string
          entry_id: string
          id: string
          percent: number | null
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          entry_id: string
          id?: string
          percent?: number | null
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          entry_id?: string
          id?: string
          percent?: number | null
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entry_allocations_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entry_allocations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          diff_summary: Json | null
          error_rows: number
          errors: Json | null
          file_name: string
          id: string
          processed_rows: number
          run_id: string | null
          status: string
          success_rows: number
          total_rows: number
          type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          diff_summary?: Json | null
          error_rows?: number
          errors?: Json | null
          file_name: string
          id?: string
          processed_rows?: number
          run_id?: string | null
          status?: string
          success_rows?: number
          total_rows: number
          type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          diff_summary?: Json | null
          error_rows?: number
          errors?: Json | null
          file_name?: string
          id?: string
          processed_rows?: number
          run_id?: string | null
          status?: string
          success_rows?: number
          total_rows?: number
          type?: string
        }
        Relationships: []
      }
      inspection_checklists: {
        Row: {
          created_at: string
          driver_id: string | null
          id: string
          inspection_date: string
          inspector_name: string | null
          items: Json
          observations: string | null
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          driver_id?: string | null
          id?: string
          inspection_date?: string
          inspector_name?: string | null
          items?: Json
          observations?: string | null
          status?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string | null
          id?: string
          inspection_date?: string
          inspector_name?: string | null
          items?: Json
          observations?: string | null
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklists_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_checklists_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_contracts: {
        Row: {
          card_id: string
          card_name: string | null
          created_at: string
          id: string
          installment_amount_cents: number
          installment_total: number
          merchant_base: string
          provider: string
          purchase_date: string
          run_id: string | null
          updated_at: string
        }
        Insert: {
          card_id: string
          card_name?: string | null
          created_at?: string
          id: string
          installment_amount_cents: number
          installment_total?: number
          merchant_base: string
          provider?: string
          purchase_date: string
          run_id?: string | null
          updated_at?: string
        }
        Update: {
          card_id?: string
          card_name?: string | null
          created_at?: string
          id?: string
          installment_amount_cents?: number
          installment_total?: number
          merchant_base?: string
          provider?: string
          purchase_date?: string
          run_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          level: string
          message: string
          module: string
          payload: Json | null
          reference_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          level?: string
          message: string
          module?: string
          payload?: Json | null
          reference_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          level?: string
          message?: string
          module?: string
          payload?: Json | null
          reference_id?: string | null
        }
        Relationships: []
      }
      landing_settings: {
        Row: {
          content: Json
          enabled: boolean
          id: string
          section: string
          updated_at: string
        }
        Insert: {
          content?: Json
          enabled?: boolean
          id?: string
          section: string
          updated_at?: string
        }
        Update: {
          content?: Json
          enabled?: boolean
          id?: string
          section?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_tickets: {
        Row: {
          attachment_urls: string[] | null
          category: string | null
          completed_at: string | null
          cost_center_id: string | null
          cost_type: string | null
          created_at: string
          description: string | null
          financial_entry_id: string | null
          group_id: string | null
          id: string
          impact_type: string | null
          labor_cost_cents: number | null
          parts_cost_cents: number | null
          payment_method: string | null
          priority: Database["public"]["Enums"]["maintenance_priority"]
          reported_at: string
          reported_by: string | null
          service_date: string | null
          sla_deadline: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          subcategory: string | null
          subgroup_id: string | null
          supplier: string | null
          title: string
          total_cost_cents: number | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          attachment_urls?: string[] | null
          category?: string | null
          completed_at?: string | null
          cost_center_id?: string | null
          cost_type?: string | null
          created_at?: string
          description?: string | null
          financial_entry_id?: string | null
          group_id?: string | null
          id?: string
          impact_type?: string | null
          labor_cost_cents?: number | null
          parts_cost_cents?: number | null
          payment_method?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          reported_at?: string
          reported_by?: string | null
          service_date?: string | null
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          subcategory?: string | null
          subgroup_id?: string | null
          supplier?: string | null
          title: string
          total_cost_cents?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          attachment_urls?: string[] | null
          category?: string | null
          completed_at?: string | null
          cost_center_id?: string | null
          cost_type?: string | null
          created_at?: string
          description?: string | null
          financial_entry_id?: string | null
          group_id?: string | null
          id?: string
          impact_type?: string | null
          labor_cost_cents?: number | null
          parts_cost_cents?: number | null
          payment_method?: string | null
          priority?: Database["public"]["Enums"]["maintenance_priority"]
          reported_at?: string
          reported_by?: string | null
          service_date?: string | null
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          subcategory?: string | null
          subgroup_id?: string | null
          supplier?: string | null
          title?: string
          total_cost_cents?: number | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tickets_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dre_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_subgroup_id_fkey"
            columns: ["subgroup_id"]
            isOneToOne: false
            referencedRelation: "dre_subgroups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tickets_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      passengers: {
        Row: {
          created_at: string
          document: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payer_boleto_links: {
        Row: {
          amount_cents: number | null
          cpf_digits: string
          created_at: string
          digitable_line: string | null
          drive_url: string
          due_date: string | null
          file_id: string | null
          id: string
          our_number: string | null
          payer_id: string | null
          phone_digits: string
          reference_month: string
          source: string | null
          student_name: string
          view_url: string | null
        }
        Insert: {
          amount_cents?: number | null
          cpf_digits: string
          created_at?: string
          digitable_line?: string | null
          drive_url: string
          due_date?: string | null
          file_id?: string | null
          id?: string
          our_number?: string | null
          payer_id?: string | null
          phone_digits: string
          reference_month: string
          source?: string | null
          student_name: string
          view_url?: string | null
        }
        Update: {
          amount_cents?: number | null
          cpf_digits?: string
          created_at?: string
          digitable_line?: string | null
          drive_url?: string
          due_date?: string | null
          file_id?: string | null
          id?: string
          our_number?: string | null
          payer_id?: string | null
          phone_digits?: string
          reference_month?: string
          source?: string | null
          student_name?: string
          view_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payer_boleto_links_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          address_base: string | null
          address_original: string | null
          billing_mode: string
          billing_seen_in_month: string | null
          birth_date: string | null
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
          legacy_id: string
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
          run_id: string | null
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
          birth_date?: string | null
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
          legacy_id: string
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
          run_id?: string | null
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
          birth_date?: string | null
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
          legacy_id?: string
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
          run_id?: string | null
          state?: string | null
          status?: string
          street?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      poll_dispatch_jobs: {
        Row: {
          active: boolean
          created_at: string
          cron_expression: string | null
          error_message: string | null
          group_id: string
          id: string
          last_run_at: string | null
          schedule_type: string
          scheduled_for: string | null
          status: string
          template_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cron_expression?: string | null
          error_message?: string | null
          group_id: string
          id?: string
          last_run_at?: string | null
          schedule_type?: string
          scheduled_for?: string | null
          status?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cron_expression?: string | null
          error_message?: string | null
          group_id?: string
          id?: string
          last_run_at?: string | null
          schedule_type?: string
          scheduled_for?: string | null
          status?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_dispatch_jobs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_dispatch_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "poll_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          options: Json
          question: string
          selectable_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name: string
          options?: Json
          question: string
          selectable_count?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          options?: Json
          question?: string
          selectable_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      poll_vote_history: {
        Row: {
          changed_at: string
          id: string
          new_option: string
          poll_vote_id: string
          previous_option: string | null
          raw_payload: Json | null
        }
        Insert: {
          changed_at?: string
          id?: string
          new_option: string
          poll_vote_id: string
          previous_option?: string | null
          raw_payload?: Json | null
        }
        Update: {
          changed_at?: string
          id?: string
          new_option?: string
          poll_vote_id?: string
          previous_option?: string | null
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_vote_history_poll_vote_id_fkey"
            columns: ["poll_vote_id"]
            isOneToOne: false
            referencedRelation: "poll_votes"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          poll_id: string
          raw_payload: Json | null
          selected_option: string
          selected_option_index: number | null
          student_id: string | null
          updated_at: string
          vote_status: string
          voted_at: string
          voter_jid: string | null
          voter_phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          poll_id: string
          raw_payload?: Json | null
          selected_option: string
          selected_option_index?: number | null
          student_id?: string | null
          updated_at?: string
          vote_status?: string
          voted_at?: string
          voter_jid?: string | null
          voter_phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          poll_id?: string
          raw_payload?: Json | null
          selected_option?: string
          selected_option_index?: number | null
          student_id?: string | null
          updated_at?: string
          vote_status?: string
          voted_at?: string
          voter_jid?: string | null
          voter_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string | null
          external_poll_id: string | null
          group_id: string | null
          id: string
          instance_id: string | null
          options: Json
          poll_date: string
          question: string
          selectable_count: number
          sent_at: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_poll_id?: string | null
          group_id?: string | null
          id?: string
          instance_id?: string | null
          options?: Json
          poll_date?: string
          question: string
          selectable_count?: number
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_poll_id?: string | null
          group_id?: string | null
          id?: string
          instance_id?: string | null
          options?: Json
          poll_date?: string
          question?: string
          selectable_count?: number
          sent_at?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "poll_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          input_hash: string | null
          progress: number
          result: Json | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          input_hash?: string | null
          progress?: number
          result?: Json | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          input_hash?: string | null
          progress?: number
          result?: Json | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_boleto_access_logs: {
        Row: {
          action: string
          cpf_digits: string
          created_at: string
          drive_url: string | null
          found_count: number | null
          id: string
          reference_month: string | null
          request_id: string | null
          source: string
          student_name: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          cpf_digits: string
          created_at?: string
          drive_url?: string | null
          found_count?: number | null
          id?: string
          reference_month?: string | null
          request_id?: string | null
          source?: string
          student_name?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          cpf_digits?: string
          created_at?: string
          drive_url?: string | null
          found_count?: number | null
          id?: string
          reference_month?: string | null
          request_id?: string | null
          source?: string
          student_name?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      public_excursion_leads: {
        Row: {
          address: string | null
          affiliate_id: string | null
          amount_total_cents: number
          cpf_digits: string
          created_at: string
          email: string | null
          excursion_id: string
          first_captured_at: string
          id: string
          ip_hash: string | null
          last_step_at: string
          name: string
          order_id: string | null
          payment_type: string | null
          phone_digits: string
          public_token: string
          ref_code: string | null
          seat_count: number
          session_id: string | null
          source: string
          status: Database["public"]["Enums"]["public_lead_status"]
          status_history: Json
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          address?: string | null
          affiliate_id?: string | null
          amount_total_cents?: number
          cpf_digits: string
          created_at?: string
          email?: string | null
          excursion_id: string
          first_captured_at?: string
          id?: string
          ip_hash?: string | null
          last_step_at?: string
          name: string
          order_id?: string | null
          payment_type?: string | null
          phone_digits: string
          public_token: string
          ref_code?: string | null
          seat_count?: number
          session_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["public_lead_status"]
          status_history?: Json
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          address?: string | null
          affiliate_id?: string | null
          amount_total_cents?: number
          cpf_digits?: string
          created_at?: string
          email?: string | null
          excursion_id?: string
          first_captured_at?: string
          id?: string
          ip_hash?: string | null
          last_step_at?: string
          name?: string
          order_id?: string | null
          payment_type?: string | null
          phone_digits?: string
          public_token?: string
          ref_code?: string | null
          seat_count?: number
          session_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["public_lead_status"]
          status_history?: Json
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_excursion_leads_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_excursion_leads_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_excursion_leads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "excursion_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_excursion_leads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "public_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      public_leads: {
        Row: {
          affiliate_ref: string | null
          created_at: string
          id: string
          interest_type: string | null
          message: string | null
          name: string
          phone: string
          referrer: string | null
          source_page: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          affiliate_ref?: string | null
          created_at?: string
          id?: string
          interest_type?: string | null
          message?: string | null
          name: string
          phone: string
          referrer?: string | null
          source_page?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          affiliate_ref?: string | null
          created_at?: string
          id?: string
          interest_type?: string | null
          message?: string | null
          name?: string
          phone?: string
          referrer?: string | null
          source_page?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      public_orders: {
        Row: {
          affiliate_id: string | null
          affiliate_ref: string | null
          amount_paid_cents: number
          amount_pending_cents: number
          amount_total_cents: number
          created_at: string
          excursion_id: string
          id: string
          lock_expires_at: string | null
          passenger_address: string | null
          passenger_document: string
          passenger_email: string | null
          passenger_name: string
          passenger_phone: string
          payment_type: string
          pix_code: string | null
          pix_expires_at: string | null
          pix_qr_data: string | null
          seat_ids: string[]
          seat_numbers: number[]
          status: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_id?: string | null
          affiliate_ref?: string | null
          amount_paid_cents?: number
          amount_pending_cents?: number
          amount_total_cents?: number
          created_at?: string
          excursion_id: string
          id?: string
          lock_expires_at?: string | null
          passenger_address?: string | null
          passenger_document: string
          passenger_email?: string | null
          passenger_name: string
          passenger_phone: string
          payment_type?: string
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_data?: string | null
          seat_ids?: string[]
          seat_numbers?: number[]
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_id?: string | null
          affiliate_ref?: string | null
          amount_paid_cents?: number
          amount_pending_cents?: number
          amount_total_cents?: number
          created_at?: string
          excursion_id?: string
          id?: string
          lock_expires_at?: string | null
          passenger_address?: string | null
          passenger_document?: string
          passenger_email?: string | null
          passenger_name?: string
          passenger_phone?: string
          payment_type?: string
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_data?: string | null
          seat_ids?: string[]
          seat_numbers?: number[]
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_orders_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
        ]
      }
      public_tracking_events: {
        Row: {
          affiliate_ref: string | null
          created_at: string
          event_name: string
          excursion_id: string | null
          id: string
          metadata: Json | null
          public_token: string | null
          referrer: string | null
          source_page: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          affiliate_ref?: string | null
          created_at?: string
          event_name: string
          excursion_id?: string | null
          id?: string
          metadata?: Json | null
          public_token?: string | null
          referrer?: string | null
          source_page?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          affiliate_ref?: string | null
          created_at?: string
          event_name?: string
          excursion_id?: string | null
          id?: string
          metadata?: Json | null
          public_token?: string | null
          referrer?: string | null
          source_page?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_tracking_events_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          active: boolean
          auth_user_id: string | null
          course: string | null
          created_at: string
          default_route_id: string | null
          id: string
          name: string
          payer_id: string | null
          phone_e164: string | null
          registration: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_user_id?: string | null
          course?: string | null
          created_at?: string
          default_route_id?: string | null
          id?: string
          name: string
          payer_id?: string | null
          phone_e164?: string | null
          registration: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_user_id?: string | null
          course?: string | null
          created_at?: string
          default_route_id?: string | null
          id?: string
          name?: string
          payer_id?: string | null
          phone_e164?: string | null
          registration?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_default_route_id_fkey"
            columns: ["default_route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_sales: {
        Row: {
          amount_cents: number
          created_at: string
          excursion_id: string
          id: string
          installments: number
          notes: string | null
          passenger_id: string
          payment_method: string
          payment_status: string
          seat_ids: string[]
          seat_numbers: number[]
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          excursion_id: string
          id?: string
          installments?: number
          notes?: string | null
          passenger_id: string
          payment_method?: string
          payment_status?: string
          seat_ids?: string[]
          seat_numbers?: number[]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          excursion_id?: string
          id?: string
          installments?: number
          notes?: string | null
          passenger_id?: string
          payment_method?: string
          payment_status?: string
          seat_ids?: string[]
          seat_numbers?: number[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sales_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_sales_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "passengers"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_buses: {
        Row: {
          active: boolean
          created_at: string
          id: string
          identifier_code: string
          name: string
          notes: string | null
          plate: string | null
          qr_code_value: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          identifier_code: string
          name: string
          notes?: string | null
          plate?: string | null
          qr_code_value?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          identifier_code?: string
          name?: string
          notes?: string | null
          plate?: string | null
          qr_code_value?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transport_buses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          active: boolean
          boarding_latitude: number | null
          boarding_location_name: string | null
          boarding_longitude: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          radius_meters: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          boarding_latitude?: number | null
          boarding_location_name?: string | null
          boarding_longitude?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          radius_meters?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          boarding_latitude?: number | null
          boarding_location_name?: string | null
          boarding_longitude?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          radius_meters?: number
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          active: boolean
          boarding_end_time: string
          boarding_start_time: string
          created_at: string
          date: string
          id: string
          route_id: string
          trip_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          boarding_end_time: string
          boarding_start_time: string
          created_at?: string
          date: string
          id?: string
          route_id: string
          trip_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          boarding_end_time?: string
          boarding_start_time?: string
          created_at?: string
          date?: string
          id?: string
          route_id?: string
          trip_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          model: string | null
          name: string
          plate: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          model?: string | null
          name: string
          plate?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          model?: string | null
          name?: string
          plate?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      whatsapp_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          failed_messages: number
          id: string
          name: string
          provider_id: string | null
          sent_messages: number
          source: string
          status: Database["public"]["Enums"]["whatsapp_campaign_status"]
          total_messages: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_messages?: number
          id?: string
          name: string
          provider_id?: string | null
          sent_messages?: number
          source?: string
          status?: Database["public"]["Enums"]["whatsapp_campaign_status"]
          total_messages?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_messages?: number
          id?: string
          name?: string
          provider_id?: string | null
          sent_messages?: number
          source?: string
          status?: Database["public"]["Enums"]["whatsapp_campaign_status"]
          total_messages?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          created_at: string
          display_name: string | null
          id: number
          instance_name: string
          provider_id: string
          raw: Json
          updated_at: string
          wa_jid: string | null
          wa_number: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: number
          instance_name: string
          provider_id: string
          raw?: Json
          updated_at?: string
          wa_jid?: string | null
          wa_number: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: number
          instance_name?: string
          provider_id?: string
          raw?: Json
          updated_at?: string
          wa_jid?: string | null
          wa_number?: string
        }
        Relationships: []
      }
      whatsapp_group_students: {
        Row: {
          active: boolean
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_students_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          group_jid: string
          id: string
          instance_id: string | null
          metadata: Json | null
          name: string
          route_id: string | null
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          group_jid: string
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          name: string
          route_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          group_jid?: string
          id?: string
          instance_id?: string | null
          metadata?: Json | null
          name?: string
          route_id?: string | null
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_groups_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          attempt_count: number
          body: string
          campaign_id: string
          created_at: string
          delivered_at: string | null
          id: string
          last_error: string | null
          payer_id: string | null
          phone_e164: string
          provider_message_id: string | null
          read_at: string | null
          scheduled_at: string
          sent_at: string | null
          status: Database["public"]["Enums"]["whatsapp_message_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          body: string
          campaign_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          payer_id?: string | null
          phone_e164: string
          provider_message_id?: string | null
          read_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          body?: string
          campaign_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          payer_id?: string | null
          phone_e164?: string
          provider_message_id?: string | null
          read_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["whatsapp_message_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_providers: {
        Row: {
          active: boolean
          api_key: string
          base_url: string
          created_at: string
          id: string
          instance_name: string
          name: string
          provider_type: Database["public"]["Enums"]["whatsapp_provider_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_key: string
          base_url: string
          created_at?: string
          id?: string
          instance_name: string
          name: string
          provider_type?: Database["public"]["Enums"]["whatsapp_provider_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_key?: string
          base_url?: string
          created_at?: string
          id?: string
          instance_name?: string
          name?: string
          provider_type?: Database["public"]["Enums"]["whatsapp_provider_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      excursion_orders: {
        Row: {
          affiliate_id: string | null
          amount_paid_cents: number | null
          amount_pending_cents: number | null
          amount_total_cents: number | null
          created_at: string | null
          excursion_id: string | null
          id: string | null
          lock_expires_at: string | null
          passenger_address: string | null
          passenger_document: string | null
          passenger_email: string | null
          passenger_name: string | null
          passenger_phone: string | null
          payment_type: string | null
          pix_code: string | null
          pix_expires_at: string | null
          pix_qr_data: string | null
          seat_ids: string[] | null
          seat_numbers: number[] | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          affiliate_id?: string | null
          amount_paid_cents?: number | null
          amount_pending_cents?: number | null
          amount_total_cents?: number | null
          created_at?: string | null
          excursion_id?: string | null
          id?: string | null
          lock_expires_at?: string | null
          passenger_address?: string | null
          passenger_document?: string | null
          passenger_email?: string | null
          passenger_name?: string | null
          passenger_phone?: string | null
          payment_type?: string | null
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_data?: string | null
          seat_ids?: string[] | null
          seat_numbers?: number[] | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          affiliate_id?: string | null
          amount_paid_cents?: number | null
          amount_pending_cents?: number | null
          amount_total_cents?: number | null
          created_at?: string | null
          excursion_id?: string | null
          id?: string | null
          lock_expires_at?: string | null
          passenger_address?: string | null
          passenger_document?: string | null
          passenger_email?: string | null
          passenger_name?: string | null
          passenger_phone?: string | null
          payment_type?: string | null
          pix_code?: string | null
          pix_expires_at?: string | null
          pix_qr_data?: string | null
          seat_ids?: string[] | null
          seat_numbers?: number[] | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_orders_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_orders_excursion_id_fkey"
            columns: ["excursion_id"]
            isOneToOne: false
            referencedRelation: "excursions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ensure_today_trips: { Args: never; Returns: undefined }
      get_billings_summary: { Args: { p_month: string }; Returns: Json }
      get_dre_summary: { Args: { p_month: string }; Returns: Json }
      release_expired_locks: { Args: never; Returns: number }
      reserve_seats: {
        Args: {
          p_affiliate_id?: string
          p_excursion_token: string
          p_passenger_address?: string
          p_passenger_document: string
          p_passenger_email?: string
          p_passenger_name: string
          p_passenger_phone: string
          p_payment_type?: string
          p_seat_numbers: number[]
        }
        Returns: Json
      }
    }
    Enums: {
      maintenance_priority: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA"
      maintenance_status:
        | "ABERTO"
        | "EM_ANALISE"
        | "EM_EXECUCAO"
        | "AGUARDANDO_PECA"
        | "CONCLUIDO"
        | "CANCELADO"
      public_lead_status:
        | "CAPTURADO"
        | "INTERESSE_ASSENTOS"
        | "PIX_GERADO"
        | "RESERVADO"
        | "CONVERTIDO"
        | "ABANDONADO"
      whatsapp_campaign_status:
        | "DRAFT"
        | "QUEUED"
        | "PROCESSING"
        | "COMPLETED"
        | "FAILED"
      whatsapp_message_status:
        | "PENDING"
        | "SENT"
        | "DELIVERED"
        | "READ"
        | "FAILED"
      whatsapp_provider_type: "EVOLUTION"
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
    Enums: {
      maintenance_priority: ["BAIXA", "MEDIA", "ALTA", "CRITICA"],
      maintenance_status: [
        "ABERTO",
        "EM_ANALISE",
        "EM_EXECUCAO",
        "AGUARDANDO_PECA",
        "CONCLUIDO",
        "CANCELADO",
      ],
      public_lead_status: [
        "CAPTURADO",
        "INTERESSE_ASSENTOS",
        "PIX_GERADO",
        "RESERVADO",
        "CONVERTIDO",
        "ABANDONADO",
      ],
      whatsapp_campaign_status: [
        "DRAFT",
        "QUEUED",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
      ],
      whatsapp_message_status: [
        "PENDING",
        "SENT",
        "DELIVERED",
        "READ",
        "FAILED",
      ],
      whatsapp_provider_type: ["EVOLUTION"],
    },
  },
} as const
