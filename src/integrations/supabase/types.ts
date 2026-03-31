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
      cash_register: {
        Row: {
          card_total: number | null
          cash_denominations: Json | null
          cash_register_id: string | null
          cash_withdrawals: number | null
          cashier_id: string
          closed_at: string | null
          closing_amount: number | null
          closure_type: string | null
          credit_sales_total: number | null
          difference: number | null
          difference_reason: string | null
          empresa_id: string
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string | null
          opening_amount: number
          other_expenses: number | null
          pdf_url: string | null
          print_type: string | null
          requires_supervisor_approval: boolean | null
          status: string | null
          supervisor_approved_at: string | null
          supervisor_id: string | null
          ticket_count: number | null
        }
        Insert: {
          card_total?: number | null
          cash_denominations?: Json | null
          cash_register_id?: string | null
          cash_withdrawals?: number | null
          cashier_id: string
          closed_at?: string | null
          closing_amount?: number | null
          closure_type?: string | null
          credit_sales_total?: number | null
          difference?: number | null
          difference_reason?: string | null
          empresa_id?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opening_amount?: number
          other_expenses?: number | null
          pdf_url?: string | null
          print_type?: string | null
          requires_supervisor_approval?: boolean | null
          status?: string | null
          supervisor_approved_at?: string | null
          supervisor_id?: string | null
          ticket_count?: number | null
        }
        Update: {
          card_total?: number | null
          cash_denominations?: Json | null
          cash_register_id?: string | null
          cash_withdrawals?: number | null
          cashier_id?: string
          closed_at?: string | null
          closing_amount?: number | null
          closure_type?: string | null
          credit_sales_total?: number | null
          difference?: number | null
          difference_reason?: string | null
          empresa_id?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opening_amount?: number
          other_expenses?: number | null
          pdf_url?: string | null
          print_type?: string | null
          requires_supervisor_approval?: boolean | null
          status?: string | null
          supervisor_approved_at?: string | null
          supervisor_id?: string | null
          ticket_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_audit: {
        Row: {
          action: string
          cash_register_id: string | null
          created_at: string | null
          details: Json | null
          empresa_id: string
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          cash_register_id?: string | null
          created_at?: string | null
          details?: Json | null
          empresa_id?: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          cash_register_id?: string | null
          created_at?: string | null
          details?: Json | null
          empresa_id?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_audit_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_expenses: {
        Row: {
          amount: number
          cash_register_id: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          empresa_id: string
          id: string
        }
        Insert: {
          amount: number
          cash_register_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          empresa_id?: string
          id?: string
        }
        Update: {
          amount?: number
          cash_register_id?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          empresa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_expenses_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_register"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_expenses_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_sessions: {
        Row: {
          card_total: number | null
          cash_denominations: Json | null
          cash_register_id: string | null
          cash_withdrawals: number | null
          cashier_id: string
          closed_at: string | null
          closing_amount: number | null
          closure_type: string | null
          created_at: string | null
          credit_sales_total: number | null
          difference: number | null
          difference_reason: string | null
          empresa_id: string
          expected_amount: number | null
          id: string
          notes: string | null
          opened_at: string | null
          opening_amount: number
          other_expenses: number | null
          pdf_url: string | null
          print_type: string | null
          requires_supervisor_approval: boolean | null
          status: string | null
          supervisor_approved_at: string | null
          supervisor_id: string | null
          ticket_count: number | null
          updated_at: string | null
        }
        Insert: {
          card_total?: number | null
          cash_denominations?: Json | null
          cash_register_id?: string | null
          cash_withdrawals?: number | null
          cashier_id: string
          closed_at?: string | null
          closing_amount?: number | null
          closure_type?: string | null
          created_at?: string | null
          credit_sales_total?: number | null
          difference?: number | null
          difference_reason?: string | null
          empresa_id?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opening_amount?: number
          other_expenses?: number | null
          pdf_url?: string | null
          print_type?: string | null
          requires_supervisor_approval?: boolean | null
          status?: string | null
          supervisor_approved_at?: string | null
          supervisor_id?: string | null
          ticket_count?: number | null
          updated_at?: string | null
        }
        Update: {
          card_total?: number | null
          cash_denominations?: Json | null
          cash_register_id?: string | null
          cash_withdrawals?: number | null
          cashier_id?: string
          closed_at?: string | null
          closing_amount?: number | null
          closure_type?: string | null
          created_at?: string | null
          credit_sales_total?: number | null
          difference?: number | null
          difference_reason?: string | null
          empresa_id?: string
          expected_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string | null
          opening_amount?: number
          other_expenses?: number | null
          pdf_url?: string | null
          print_type?: string | null
          requires_supervisor_approval?: boolean | null
          status?: string | null
          supervisor_approved_at?: string | null
          supervisor_id?: string | null
          ticket_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_sessions_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_sessions_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_takeover_audit: {
        Row: {
          cash_register_id: string | null
          created_at: string | null
          empresa_id: string
          id: string
          new_cashier_id: string | null
          notes: string | null
          previous_cashier_id: string | null
          takeover_amount: number | null
        }
        Insert: {
          cash_register_id?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          new_cashier_id?: string | null
          notes?: string | null
          previous_cashier_id?: string | null
          takeover_amount?: number | null
        }
        Update: {
          cash_register_id?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          new_cashier_id?: string | null
          notes?: string | null
          previous_cashier_id?: string | null
          takeover_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_takeover_audit_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_register_takeover_audit_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_registers_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cfe_logs: {
        Row: {
          cfe_history: Json | null
          client_emission_id: string | null
          created_at: string | null
          empresa_id: string
          estado: string | null
          id: string
          intento: number | null
          payload_enviado: Json | null
          respuesta_pymo: Json | null
          sale_id: string | null
        }
        Insert: {
          cfe_history?: Json | null
          client_emission_id?: string | null
          created_at?: string | null
          empresa_id: string
          estado?: string | null
          id?: string
          intento?: number | null
          payload_enviado?: Json | null
          respuesta_pymo?: Json | null
          sale_id?: string | null
        }
        Update: {
          cfe_history?: Json | null
          client_emission_id?: string | null
          created_at?: string | null
          empresa_id?: string
          estado?: string | null
          id?: string
          intento?: number | null
          payload_enviado?: Json | null
          respuesta_pymo?: Json | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cfe_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          alert_days_critical: number
          alert_days_notice: number
          alert_days_warning: number
          cash_closure_approval_threshold: number | null
          city: string | null
          company_name: string | null
          created_at: string | null
          currency: string | null
          email: string | null
          empresa_id: string
          id: string
          logo_url: string | null
          modo_control_stock: string | null
          phone: string | null
          receipt_footer: string | null
          stock_disabled: boolean | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          alert_days_critical?: number
          alert_days_notice?: number
          alert_days_warning?: number
          cash_closure_approval_threshold?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          logo_url?: string | null
          modo_control_stock?: string | null
          phone?: string | null
          receipt_footer?: string | null
          stock_disabled?: boolean | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          alert_days_critical?: number
          alert_days_notice?: number
          alert_days_warning?: number
          cash_closure_approval_threshold?: number | null
          city?: string | null
          company_name?: string | null
          created_at?: string | null
          currency?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          logo_url?: string | null
          modo_control_stock?: string | null
          phone?: string | null
          receipt_footer?: string | null
          stock_disabled?: boolean | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_payments: {
        Row: {
          amount: number
          created_at: string | null
          credit_id: string
          customer_id: string | null
          empresa_id: string
          id: string
          notes: string | null
          payment_group_id: string | null
          payment_method: string | null
          received_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          credit_id: string
          customer_id?: string | null
          empresa_id?: string
          id?: string
          notes?: string | null
          payment_group_id?: string | null
          payment_method?: string | null
          received_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          credit_id?: string
          customer_id?: string | null
          empresa_id?: string
          id?: string
          notes?: string | null
          payment_group_id?: string | null
          payment_method?: string | null
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      credits: {
        Row: {
          balance: number
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          due_date: string | null
          empresa_id: string
          id: string
          paid_amount: number | null
          sale_id: string | null
          status: string | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          balance: number
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date?: string | null
          empresa_id?: string
          id?: string
          paid_amount?: number | null
          sale_id?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          due_date?: string | null
          empresa_id?: string
          id?: string
          paid_amount?: number | null
          sale_id?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          ciudad_recep: string | null
          cod_pais_recep: string | null
          created_at: string | null
          credit_limit: number | null
          current_balance: number | null
          depto_recep: string | null
          dir_recep: string | null
          document: string | null
          empresa_id: string
          id: string
          last_name: string | null
          name: string
          notes: string | null
          phone: string | null
          requiere_factura: boolean | null
          rut: string | null
          rzn_soc: string | null
          status: string | null
          tipo_doc_recep: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          ciudad_recep?: string | null
          cod_pais_recep?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          depto_recep?: string | null
          dir_recep?: string | null
          document?: string | null
          empresa_id?: string
          id?: string
          last_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          requiere_factura?: boolean | null
          rut?: string | null
          rzn_soc?: string | null
          status?: string | null
          tipo_doc_recep?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          ciudad_recep?: string | null
          cod_pais_recep?: string | null
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          depto_recep?: string | null
          dir_recep?: string | null
          document?: string | null
          empresa_id?: string
          id?: string
          last_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          requiere_factura?: boolean | null
          rut?: string | null
          rzn_soc?: string | null
          status?: string | null
          tipo_doc_recep?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ciudad_fiscal: string | null
          created_at: string | null
          domicilio_fiscal: string | null
          email: string | null
          estado: string
          fecha_creacion: string | null
          id: string
          nombre_empresa: string
          plan: string | null
          pymo_email: string | null
          pymo_password_enc: string | null
          pymo_rut: string | null
          razon_social: string | null
          rubro: string | null
          rut: string | null
          subdominio: string | null
          telefono: string | null
          updated_at: string | null
        }
        Insert: {
          ciudad_fiscal?: string | null
          created_at?: string | null
          domicilio_fiscal?: string | null
          email?: string | null
          estado?: string
          fecha_creacion?: string | null
          id?: string
          nombre_empresa?: string
          plan?: string | null
          pymo_email?: string | null
          pymo_password_enc?: string | null
          pymo_rut?: string | null
          razon_social?: string | null
          rubro?: string | null
          rut?: string | null
          subdominio?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Update: {
          ciudad_fiscal?: string | null
          created_at?: string | null
          domicilio_fiscal?: string | null
          email?: string | null
          estado?: string
          fecha_creacion?: string | null
          id?: string
          nombre_empresa?: string
          plan?: string | null
          pymo_email?: string | null
          pymo_password_enc?: string | null
          pymo_rut?: string | null
          razon_social?: string | null
          rubro?: string | null
          rut?: string | null
          subdominio?: string | null
          telefono?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          empresa_id: string
          expense_date: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          receipt_url: string | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          expense_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          expense_date?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          receipt_url?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          counted_at: string | null
          counted_by: string | null
          created_at: string | null
          empresa_id: string
          id: string
          notes: string | null
          product_id: string
          qty_counted: number
          source: string | null
        }
        Insert: {
          counted_at?: string | null
          counted_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          notes?: string | null
          product_id: string
          qty_counted: number
          source?: string | null
        }
        Update: {
          counted_at?: string | null
          counted_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          qty_counted?: number
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_audit: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          empresa_id: string
          id: string
          notification_id: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          empresa_id?: string
          id?: string
          notification_id?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          empresa_id?: string
          id?: string
          notification_id?: string | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_audit_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_audit_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_role: string | null
          actor_user_id: string | null
          archived: boolean | null
          created_at: string | null
          empresa_id: string
          id: string
          message: string | null
          metadata: Json | null
          read: boolean | null
          read_by: string[] | null
          related_customer_id: string | null
          related_sale_id: string | null
          severity: string | null
          target_id: string | null
          target_type: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          actor_role?: string | null
          actor_user_id?: string | null
          archived?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          read_by?: string[] | null
          related_customer_id?: string | null
          related_sale_id?: string | null
          severity?: string | null
          target_id?: string | null
          target_type?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          actor_role?: string | null
          actor_user_id?: string | null
          archived?: boolean | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean | null
          read_by?: string[] | null
          related_customer_id?: string | null
          related_sale_id?: string | null
          severity?: string | null
          target_id?: string | null
          target_type?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_sale_id_fkey"
            columns: ["related_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_sales: {
        Row: {
          cashier_id: string
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          empresa_id: string
          id: string
          items: Json
          notes: string | null
          total: number | null
        }
        Insert: {
          cashier_id: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          empresa_id?: string
          id?: string
          items?: Json
          notes?: string | null
          total?: number | null
        }
        Update: {
          cashier_id?: string
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string | null
          empresa_id?: string
          id?: string
          items?: Json
          notes?: string | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_sales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          ai_asistente: boolean
          created_at: string | null
          descripcion: string | null
          id: string
          is_active: boolean
          max_cajas: number
          max_productos: number
          max_sucursales: number
          max_usuarios: number
          nombre: string
          updated_at: string | null
          whatsapp_respuestas: boolean
        }
        Insert: {
          ai_asistente?: boolean
          created_at?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          max_cajas?: number
          max_productos?: number
          max_sucursales?: number
          max_usuarios?: number
          nombre: string
          updated_at?: string | null
          whatsapp_respuestas?: boolean
        }
        Update: {
          ai_asistente?: boolean
          created_at?: string | null
          descripcion?: string | null
          id?: string
          is_active?: boolean
          max_cajas?: number
          max_productos?: number
          max_sucursales?: number
          max_usuarios?: number
          nombre?: string
          updated_at?: string | null
          whatsapp_respuestas?: boolean
        }
        Relationships: []
      }
      price_override_logs: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          new_price: number
          original_price: number
          product_id: string | null
          sale_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          new_price: number
          original_price: number
          product_id?: string | null
          sale_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          new_price?: number
          original_price?: number
          product_id?: string | null
          sale_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_override_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_override_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_override_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_number: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          empresa_id: string
          expiration_date: string | null
          id: string
          initial_quantity: number
          location: string | null
          notes: string | null
          product_id: string
          quantity: number
          received_at: string | null
          status: string | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          batch_number?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          expiration_date?: string | null
          id?: string
          initial_quantity?: number
          location?: string | null
          notes?: string | null
          product_id: string
          quantity?: number
          received_at?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          batch_number?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          expiration_date?: string | null
          id?: string
          initial_quantity?: number
          location?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          received_at?: string | null
          status?: string | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_stock_balance: {
        Row: {
          current_balance: number
          empresa_id: string
          id: string
          last_movement_at: string | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          current_balance?: number
          empresa_id?: string
          id?: string
          last_movement_at?: string | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          current_balance?: number
          empresa_id?: string
          id?: string
          last_movement_at?: string | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_stock_balance_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_stock_balance_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          allow_negative_stock: boolean | null
          barcode: string | null
          category: string | null
          cost: number | null
          created_at: string | null
          empresa_id: string
          id: string
          min_stock: number | null
          name: string
          price: number
          stock: number
          stock_disabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          allow_negative_stock?: boolean | null
          barcode?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          min_stock?: number | null
          name: string
          price?: number
          stock?: number
          stock_disabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          allow_negative_stock?: boolean | null
          barcode?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          min_stock?: number | null
          name?: string
          price?: number
          stock?: number
          stock_disabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          can_edit_price: boolean | null
          created_at: string | null
          default_role: Database["public"]["Enums"]["app_role"] | null
          email: string | null
          empresa_id: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          pin: string | null
          price_edit_unlocked_at: string | null
          updated_at: string | null
        }
        Insert: {
          can_edit_price?: boolean | null
          created_at?: string | null
          default_role?: Database["public"]["Enums"]["app_role"] | null
          email?: string | null
          empresa_id?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          pin?: string | null
          price_edit_unlocked_at?: string | null
          updated_at?: string | null
        }
        Update: {
          can_edit_price?: boolean | null
          created_at?: string | null
          default_role?: Database["public"]["Enums"]["app_role"] | null
          email?: string | null
          empresa_id?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          pin?: string | null
          price_edit_unlocked_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          expiration_date: string | null
          id: string
          product_id: string
          product_name: string
          purchase_order_id: string
          quantity: number
          subtotal: number | null
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          product_id: string
          product_name: string
          purchase_order_id: string
          quantity: number
          subtotal?: number | null
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          expiration_date?: string | null
          id?: string
          product_id?: string
          product_name?: string
          purchase_order_id?: string
          quantity?: number
          subtotal?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          empresa_id: string
          id: string
          notes: string | null
          order_date: string
          order_number: number
          status: string
          supplier_id: string
          total: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          empresa_id: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: number
          status?: string
          supplier_id: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          empresa_id?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: number
          status?: string
          supplier_id?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          authorized_by: string | null
          cash_register_session_id: string | null
          created_at: string | null
          customer_id: string | null
          empresa_id: string
          id: string
          notes: string | null
          performed_by: string | null
          product_id: string | null
          product_name: string
          quantity: number
          reason: string | null
          refund_amount: number | null
          refund_method: string | null
          related_sale_id: string | null
          return_type: string
        }
        Insert: {
          authorized_by?: string | null
          cash_register_session_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          empresa_id?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          reason?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          related_sale_id?: string | null
          return_type: string
        }
        Update: {
          authorized_by?: string | null
          cash_register_session_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          empresa_id?: string
          id?: string
          notes?: string | null
          performed_by?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          reason?: string | null
          refund_amount?: number | null
          refund_method?: string | null
          related_sale_id?: string | null
          return_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_related_sale_id_fkey"
            columns: ["related_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      role_assignment_logs: {
        Row: {
          action: string
          assigned_by: string | null
          created_at: string | null
          empresa_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          action: string
          assigned_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          action?: string
          assigned_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_assignment_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          monto_iva: number | null
          monto_neto: number | null
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          tasa_iva: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          monto_iva?: number | null
          monto_neto?: number | null
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          tasa_iva?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          monto_iva?: number | null
          monto_neto?: number | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          tasa_iva?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_print_audit: {
        Row: {
          created_at: string | null
          empresa_id: string
          id: string
          print_type: string | null
          printed_by: string | null
          sale_id: string
        }
        Insert: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          print_type?: string | null
          printed_by?: string | null
          sale_id: string
        }
        Update: {
          created_at?: string | null
          empresa_id?: string
          id?: string
          print_type?: string | null
          printed_by?: string | null
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_print_audit_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_print_audit_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cae_number: number | null
          card_amount: number | null
          cash_amount: number | null
          cash_register_session_id: string | null
          cashier_id: string | null
          cfe_id: string | null
          cfe_nro: number | null
          cfe_serie: string | null
          client_emission_id: string | null
          created_at: string | null
          credit_amount: number | null
          customer_id: string | null
          customer_name: string | null
          empresa_id: string
          estado_cfe: string | null
          fecha_emision_cfe: string | null
          id: string
          notes: string | null
          payment_method: string | null
          pdf_cfe_url: string | null
          qr_url: string | null
          replaces_sale_id: string | null
          requiere_cfe: boolean | null
          respuesta_pymo: Json | null
          sale_number: number
          security_code: string | null
          sent_xml_hash: string | null
          status: string | null
          tipo_cfe: string | null
          total: number
        }
        Insert: {
          cae_number?: number | null
          card_amount?: number | null
          cash_amount?: number | null
          cash_register_session_id?: string | null
          cashier_id?: string | null
          cfe_id?: string | null
          cfe_nro?: number | null
          cfe_serie?: string | null
          client_emission_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          customer_id?: string | null
          customer_name?: string | null
          empresa_id?: string
          estado_cfe?: string | null
          fecha_emision_cfe?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          pdf_cfe_url?: string | null
          qr_url?: string | null
          replaces_sale_id?: string | null
          requiere_cfe?: boolean | null
          respuesta_pymo?: Json | null
          sale_number?: number
          security_code?: string | null
          sent_xml_hash?: string | null
          status?: string | null
          tipo_cfe?: string | null
          total: number
        }
        Update: {
          cae_number?: number | null
          card_amount?: number | null
          cash_amount?: number | null
          cash_register_session_id?: string | null
          cashier_id?: string | null
          cfe_id?: string | null
          cfe_nro?: number | null
          cfe_serie?: string | null
          client_emission_id?: string | null
          created_at?: string | null
          credit_amount?: number | null
          customer_id?: string | null
          customer_name?: string | null
          empresa_id?: string
          estado_cfe?: string | null
          fecha_emision_cfe?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          pdf_cfe_url?: string | null
          qr_url?: string | null
          replaces_sale_id?: string | null
          requiere_cfe?: boolean | null
          respuesta_pymo?: Json | null
          sale_number?: number
          security_code?: string | null
          sent_xml_hash?: string | null
          status?: string | null
          tipo_cfe?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          authorized_by: string | null
          created_at: string | null
          empresa_id: string
          id: string
          movement_type: string
          new_stock: number | null
          notes: string | null
          override_reason: string | null
          performed_by: string | null
          previous_stock: number | null
          product_id: string
          quantity: number
          reason: string | null
          reference_id: string | null
        }
        Insert: {
          authorized_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          movement_type: string
          new_stock?: number | null
          notes?: string | null
          override_reason?: string | null
          performed_by?: string | null
          previous_stock?: number | null
          product_id: string
          quantity: number
          reason?: string | null
          reference_id?: string | null
        }
        Update: {
          authorized_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          movement_type?: string
          new_stock?: number | null
          notes?: string | null
          override_reason?: string | null
          performed_by?: string | null
          previous_stock?: number | null
          product_id?: string
          quantity?: number
          reason?: string | null
          reference_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_override_audit: {
        Row: {
          authorized_by: string | null
          created_at: string | null
          empresa_id: string
          id: string
          product_id: string
          quantity: number
          reason: string | null
          requested_by: string | null
          sale_id: string | null
          stock_after: number | null
          stock_before: number | null
        }
        Insert: {
          authorized_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          requested_by?: string | null
          sale_id?: string | null
          stock_after?: number | null
          stock_before?: number | null
        }
        Update: {
          authorized_by?: string | null
          created_at?: string | null
          empresa_id?: string
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          requested_by?: string | null
          sale_id?: string | null
          stock_after?: number | null
          stock_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_override_audit_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_override_audit_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_override_audit_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_authorizations: {
        Row: {
          authorized_by: string
          created_at: string | null
          empresa_id: string
          id: string
          product_id: string | null
          quantity: number | null
          reason: string | null
          sale_id: string | null
        }
        Insert: {
          authorized_by: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          product_id?: string | null
          quantity?: number | null
          reason?: string | null
          sale_id?: string | null
        }
        Update: {
          authorized_by?: string
          created_at?: string | null
          empresa_id?: string
          id?: string
          product_id?: string | null
          quantity?: number | null
          reason?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_authorizations_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_authorizations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supervisor_authorizations_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string | null
          email: string | null
          empresa_id: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          empresa_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      products_expiring_soon: {
        Row: {
          barcode: string | null
          batch_id: string | null
          batch_number: string | null
          days_until_expiry: number | null
          empresa_id: string | null
          expiration_date: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      v_cash_registers_status: {
        Row: {
          cash_register_id: string | null
          cash_register_name: string | null
          cashier_id: string | null
          cashier_name: string | null
          current_session_id: string | null
          is_active: boolean | null
          location: string | null
          opened_at: string | null
          opening_amount: number | null
          status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_customer_with_initial_debt: {
        Args: {
          p_address?: string
          p_cashier_id?: string
          p_credit_limit?: number
          p_document?: string
          p_empresa_id?: string
          p_initial_debt?: number
          p_last_name?: string
          p_name: string
          p_notes?: string
          p_phone?: string
          p_rut?: string
          p_status?: string
        }
        Returns: string
      }
      get_admin_and_supervisor_user_ids: { Args: never; Returns: string[] }
      get_admin_user_ids: { Args: never; Returns: string[] }
      get_cash_registers_status:
        | {
            Args: never
            Returns: {
              cash_register_id: string
              cash_register_name: string
              cashier_id: string
              cashier_name: string
              current_session_id: string
              is_active: boolean
              location: string
              opened_at: string
              opening_amount: number
              status: string
            }[]
          }
        | {
            Args: { p_empresa_id?: string }
            Returns: {
              cash_register_id: string
              cash_register_name: string
              cashier_id: string
              cashier_name: string
              current_session_id: string
              is_active: boolean
              location: string
              opened_at: string
              opening_amount: number
              status: string
            }[]
          }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_sale_with_movements: {
        Args: { p_items: Json; p_sale_data: Json; p_stock_movements?: Json }
        Returns: Json
      }
      update_sale_items: {
        Args: { p_new_items: Json; p_performed_by: string; p_sale_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "cajero" | "repositor" | "super_admin"
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
      app_role: ["admin", "supervisor", "cajero", "repositor", "super_admin"],
    },
  },
} as const
