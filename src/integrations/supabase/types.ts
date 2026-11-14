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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      accounting_accounts: {
        Row: {
          account_type: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_control_account: boolean
          is_system_account: boolean
          name: string
          parent_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_type: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_control_account?: boolean
          is_system_account?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_type?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_control_account?: boolean
          is_system_account?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
        ]
      }
      accounting_approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          entity_id: string
          entity_type: string
          id: string
          status: string
          submitted_at: string
          submitted_by: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id: string
          entity_type: string
          id?: string
          status?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          status?: string
          submitted_at?: string
          submitted_by?: string | null
        }
        Relationships: []
      }
      accounting_asset_depreciation: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          asset_id: string
          created_at: string
          created_by: string | null
          depreciation_date: string
          id: string
          journal_entry_id: string | null
          period_id: string
          rejection_reason: string | null
          status: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          asset_id: string
          created_at?: string
          created_by?: string | null
          depreciation_date: string
          id?: string
          journal_entry_id?: string | null
          period_id: string
          rejection_reason?: string | null
          status?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          asset_id?: string
          created_at?: string
          created_by?: string | null
          depreciation_date?: string
          id?: string
          journal_entry_id?: string | null
          period_id?: string
          rejection_reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "accounting_fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_asset_depreciation_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_asset_depreciation_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["period_id"]
          },
          {
            foreignKeyName: "accounting_asset_depreciation_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_audit_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: number
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: never
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      accounting_bank_accounts: {
        Row: {
          account_id: string
          account_name: string
          account_number_masked: string | null
          bank_name: string
          branch_name: string | null
          created_at: string
          created_by: string | null
          currency_code: string
          id: string
          is_active: boolean
          opening_balance: number
          opening_balance_date: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          account_name: string
          account_number_masked?: string | null
          bank_name: string
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_active?: boolean
          opening_balance?: number
          opening_balance_date?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          account_name?: string
          account_number_masked?: string | null
          bank_name?: string
          branch_name?: string | null
          created_at?: string
          created_by?: string | null
          currency_code?: string
          id?: string
          is_active?: boolean
          opening_balance?: number
          opening_balance_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
        ]
      }
      accounting_bank_reconciliations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          bank_account_id: string
          book_closing_balance: number
          created_at: string
          created_by: string | null
          difference: number
          id: string
          notes: string | null
          period_id: string
          rejection_reason: string | null
          statement_closing_balance: number
          statement_opening_balance: number
          status: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id: string
          book_closing_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          id?: string
          notes?: string | null
          period_id: string
          rejection_reason?: string | null
          statement_closing_balance: number
          statement_opening_balance?: number
          status?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          bank_account_id?: string
          book_closing_balance?: number
          created_at?: string
          created_by?: string | null
          difference?: number
          id?: string
          notes?: string | null
          period_id?: string
          rejection_reason?: string | null
          statement_closing_balance?: number
          statement_opening_balance?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_bank_reconciliations_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_bank_reconciliations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["period_id"]
          },
          {
            foreignKeyName: "accounting_bank_reconciliations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_bank_statement_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          direction: string
          id: string
          matched_journal_line_id: string | null
          reconciliation_id: string
          reference: string | null
          status: string
          transaction_date: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          direction: string
          id?: string
          matched_journal_line_id?: string | null
          reconciliation_id: string
          reference?: string | null
          status?: string
          transaction_date: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          direction?: string
          id?: string
          matched_journal_line_id?: string | null
          reconciliation_id?: string
          reference?: string | null
          status?: string
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_bank_statement_lines_matched_journal_line_id_fkey"
            columns: ["matched_journal_line_id"]
            isOneToOne: false
            referencedRelation: "journal_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_bank_statement_lines_reconciliation_id_fkey"
            columns: ["reconciliation_id"]
            isOneToOne: false
            referencedRelation: "accounting_bank_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_budget_lines: {
        Row: {
          account_id: string
          amount: number
          budget_id: string
          created_at: string
          id: string
          notes: string | null
          period_id: string
        }
        Insert: {
          account_id: string
          amount?: number
          budget_id: string
          created_at?: string
          id?: string
          notes?: string | null
          period_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          budget_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_budget_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["budget_id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "accounting_budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["period_id"]
          },
          {
            foreignKeyName: "accounting_budget_lines_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_budgets: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          financial_year_id: string
          id: string
          name: string
          notes: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year_id: string
          id?: string
          name: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          financial_year_id?: string
          id?: string
          name?: string
          notes?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_budgets_financial_year_id_fkey"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "accounting_financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_financial_years: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          name: string
          starts_on: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on: string
          id?: string
          name: string
          starts_on: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string
          id?: string
          name?: string
          starts_on?: string
          status?: string
        }
        Relationships: []
      }
      accounting_fixed_assets: {
        Row: {
          accumulated_depreciation: number
          accumulated_depreciation_account_id: string | null
          approved_at: string | null
          approved_by: string | null
          asset_account_id: string | null
          asset_code: string
          category: string
          created_at: string
          created_by: string | null
          depreciation_expense_account_id: string | null
          depreciation_method: string
          description: string | null
          disposal_date: string | null
          disposal_proceeds: number | null
          id: string
          name: string
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payment_reference: string | null
          purchase_cost: number
          purchase_date: string
          rejection_reason: string | null
          residual_value: number
          source_expense_id: string | null
          status: string
          updated_at: string
          useful_life_months: number | null
        }
        Insert: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_account_id?: string | null
          asset_code: string
          category?: string
          created_at?: string
          created_by?: string | null
          depreciation_expense_account_id?: string | null
          depreciation_method?: string
          description?: string | null
          disposal_date?: string | null
          disposal_proceeds?: number | null
          id?: string
          name: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          purchase_cost: number
          purchase_date: string
          rejection_reason?: string | null
          residual_value?: number
          source_expense_id?: string | null
          status?: string
          updated_at?: string
          useful_life_months?: number | null
        }
        Update: {
          accumulated_depreciation?: number
          accumulated_depreciation_account_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          asset_account_id?: string | null
          asset_code?: string
          category?: string
          created_at?: string
          created_by?: string | null
          depreciation_expense_account_id?: string | null
          depreciation_method?: string
          description?: string | null
          disposal_date?: string | null
          disposal_proceeds?: number | null
          id?: string
          name?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          purchase_cost?: number
          purchase_date?: string
          rejection_reason?: string | null
          residual_value?: number
          source_expense_id?: string | null
          status?: string
          updated_at?: string
          useful_life_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_fixed_assets_accumulated_depreciation_account_i_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_fixed_assets_accumulated_depreciation_account_i_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounting_fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounting_fixed_assets_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_fixed_assets_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "accounting_fixed_assets_source_expense_id_fkey"
            columns: ["source_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          financial_year_id: string | null
          id: string
          name: string
          starts_on: string
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on: string
          financial_year_id?: string | null
          id?: string
          name: string
          starts_on: string
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          ends_on?: string
          financial_year_id?: string | null
          id?: string
          name?: string
          starts_on?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_financial_year_id_fkey"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "accounting_financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_settings: {
        Row: {
          approval_required: boolean
          currency_code: string
          financial_year_start_month: number
          id: string
          is_default: boolean
          tax_configuration: Json
          tax_registration_notes: string | null
          updated_at: string
          updated_by: string | null
          vat_rate: number
          vat_registered: boolean
        }
        Insert: {
          approval_required?: boolean
          currency_code?: string
          financial_year_start_month?: number
          id?: string
          is_default?: boolean
          tax_configuration?: Json
          tax_registration_notes?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
          vat_registered?: boolean
        }
        Update: {
          approval_required?: boolean
          currency_code?: string
          financial_year_start_month?: number
          id?: string
          is_default?: boolean
          tax_configuration?: Json
          tax_registration_notes?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
          vat_registered?: boolean
        }
        Relationships: []
      }
      assets: {
        Row: {
          bucket: string
          category: string | null
          content_type: string | null
          filename: string
          id: string
          metadata: Json | null
          path: string
          public_url: string | null
          size: number | null
          uploaded_at: string
          user_id: string | null
        }
        Insert: {
          bucket?: string
          category?: string | null
          content_type?: string | null
          filename: string
          id?: string
          metadata?: Json | null
          path: string
          public_url?: string | null
          size?: number | null
          uploaded_at?: string
          user_id?: string | null
        }
        Update: {
          bucket?: string
          category?: string | null
          content_type?: string | null
          filename?: string
          id?: string
          metadata?: Json | null
          path?: string
          public_url?: string | null
          size?: number | null
          uploaded_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          author_name: string
          category: string
          content: string
          cover_image: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          category?: string
          content?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          author_id?: string | null
          author_name?: string
          category?: string
          content?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      booking_engine_attribute_prompts: {
        Row: {
          attribute_key: string
          category: string | null
          created_at: string
          display_order: number | null
          help_text: string | null
          input_type: string
          options: Json | null
          question_text: string
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          attribute_key: string
          category?: string | null
          created_at?: string
          display_order?: number | null
          help_text?: string | null
          input_type: string
          options?: Json | null
          question_text: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          attribute_key?: string
          category?: string | null
          created_at?: string
          display_order?: number | null
          help_text?: string | null
          input_type?: string
          options?: Json | null
          question_text?: string
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: []
      }
      booking_engine_flags: {
        Row: {
          action_required: string | null
          created_at: string
          description: string | null
          dismissal_reason: string | null
          extracted_facts: Json | null
          id: string
          photo_count: number | null
          priority: string
          reason: string
          request_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_required?: string | null
          created_at?: string
          description?: string | null
          dismissal_reason?: string | null
          extracted_facts?: Json | null
          id?: string
          photo_count?: number | null
          priority?: string
          reason: string
          request_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_required?: string | null
          created_at?: string
          description?: string | null
          dismissal_reason?: string | null
          extracted_facts?: Json | null
          id?: string
          photo_count?: number | null
          priority?: string
          reason?: string
          request_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_flags_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_pricing_rules: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          currency: string
          id: string
          maximum_quantity: number | null
          minimum_quantity: number | null
          pricing_type: string
          rate: number | null
          service_config_id: string
          unit_key: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number | null
          pricing_type: string
          rate?: number | null
          service_config_id: string
          unit_key?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          maximum_quantity?: number | null
          minimum_quantity?: number | null
          pricing_type?: string
          rate?: number | null
          service_config_id?: string
          unit_key?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_pricing_rules_service_config_id_fkey"
            columns: ["service_config_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_service_config"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_question_conditions: {
        Row: {
          action: string
          created_at: string
          depends_on_question_id: string
          expected_value: Json
          id: string
          operator: string
          question_id: string
          updated_at: string
        }
        Insert: {
          action: string
          created_at?: string
          depends_on_question_id: string
          expected_value: Json
          id?: string
          operator: string
          question_id: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          depends_on_question_id?: string
          expected_value?: Json
          id?: string
          operator?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_question_conditions_depends_on_question_id_fkey"
            columns: ["depends_on_question_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_engine_question_conditions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_questions: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          input_type: string
          label: string
          options: Json
          question_key: string
          required: boolean
          service_config_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          input_type: string
          label: string
          options?: Json
          question_key: string
          required?: boolean
          service_config_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          input_type?: string
          label?: string
          options?: Json
          question_key?: string
          required?: boolean
          service_config_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_questions_service_config_id_fkey"
            columns: ["service_config_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_service_config"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_request_events: {
        Row: {
          actor_name: string | null
          actor_role: string | null
          actor_user_id: string | null
          created_at: string
          event_type: string
          from_status:
            | Database["public"]["Enums"]["booking_engine_request_status"]
            | null
          id: string
          message: string | null
          metadata: Json
          request_id: string
          to_status:
            | Database["public"]["Enums"]["booking_engine_request_status"]
            | null
        }
        Insert: {
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["booking_engine_request_status"]
            | null
          id?: string
          message?: string | null
          metadata?: Json
          request_id: string
          to_status?:
            | Database["public"]["Enums"]["booking_engine_request_status"]
            | null
        }
        Update: {
          actor_name?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["booking_engine_request_status"]
            | null
          id?: string
          message?: string | null
          metadata?: Json
          request_id?: string
          to_status?:
            | Database["public"]["Enums"]["booking_engine_request_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_request_items: {
        Row: {
          answers: Json
          created_at: string
          display_order: number
          id: string
          measurements: Json
          pricing_snapshot: Json
          quantity: number | null
          request_id: string
          scope_snapshot: Json
          selected_extras: Json
          service_config_id: string | null
          service_config_version: number | null
          service_id: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          created_at?: string
          display_order?: number
          id?: string
          measurements?: Json
          pricing_snapshot?: Json
          quantity?: number | null
          request_id: string
          scope_snapshot?: Json
          selected_extras?: Json
          service_config_id?: string | null
          service_config_version?: number | null
          service_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          created_at?: string
          display_order?: number
          id?: string
          measurements?: Json
          pricing_snapshot?: Json
          quantity?: number | null
          request_id?: string
          scope_snapshot?: Json
          selected_extras?: Json
          service_config_id?: string | null
          service_config_version?: number | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_engine_request_items_service_config_id_fkey"
            columns: ["service_config_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_service_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_engine_request_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_request_photos: {
        Row: {
          created_at: string
          display_order: number
          file_size_bytes: number
          height: number | null
          id: string
          mime_type: string
          original_filename: string | null
          photo_category: string
          request_id: string
          request_item_id: string | null
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          file_size_bytes: number
          height?: number | null
          id?: string
          mime_type: string
          original_filename?: string | null
          photo_category: string
          request_id: string
          request_item_id?: string | null
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          display_order?: number
          file_size_bytes?: number
          height?: number | null
          id?: string
          mime_type?: string
          original_filename?: string | null
          photo_category?: string
          request_id?: string
          request_item_id?: string | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_request_photos_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_engine_request_photos_request_item_id_fkey"
            columns: ["request_item_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_requests: {
        Row: {
          converted_at: string | null
          converted_booking_id: string | null
          created_at: string
          customer_acknowledged_scope: boolean
          customer_id: string | null
          customer_notes: string | null
          customer_user_id: string | null
          dialogue_transcript: Json | null
          extracted_facts: Json | null
          id: string
          original_customer_request: string | null
          quotation_id: string | null
          request_number: string
          requested_date: string | null
          requested_time: string | null
          scope_acknowledged_at: string | null
          service_location: string | null
          status: Database["public"]["Enums"]["booking_engine_request_status"]
          submission_key: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          converted_booking_id?: string | null
          created_at?: string
          customer_acknowledged_scope?: boolean
          customer_id?: string | null
          customer_notes?: string | null
          customer_user_id?: string | null
          dialogue_transcript?: Json | null
          extracted_facts?: Json | null
          id?: string
          original_customer_request?: string | null
          quotation_id?: string | null
          request_number?: string
          requested_date?: string | null
          requested_time?: string | null
          scope_acknowledged_at?: string | null
          service_location?: string | null
          status?: Database["public"]["Enums"]["booking_engine_request_status"]
          submission_key?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          converted_booking_id?: string | null
          created_at?: string
          customer_acknowledged_scope?: boolean
          customer_id?: string | null
          customer_notes?: string | null
          customer_user_id?: string | null
          dialogue_transcript?: Json | null
          extracted_facts?: Json | null
          id?: string
          original_customer_request?: string | null
          quotation_id?: string | null
          request_number?: string
          requested_date?: string | null
          requested_time?: string | null
          scope_acknowledged_at?: string | null
          service_location?: string | null
          status?: Database["public"]["Enums"]["booking_engine_request_status"]
          submission_key?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_requests_converted_booking_id_fkey"
            columns: ["converted_booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_engine_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_engine_requests_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_service_aliases: {
        Row: {
          alias_service_id: string
          created_at: string
          id: string
          match_confidence: number
          notes: string | null
          primary_service_id: string
          updated_at: string
        }
        Insert: {
          alias_service_id: string
          created_at?: string
          id?: string
          match_confidence: number
          notes?: string | null
          primary_service_id: string
          updated_at?: string
        }
        Update: {
          alias_service_id?: string
          created_at?: string
          id?: string
          match_confidence?: number
          notes?: string | null
          primary_service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_service_aliases_alias_service_id_fkey"
            columns: ["alias_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_engine_service_aliases_primary_service_id_fkey"
            columns: ["primary_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_service_config: {
        Row: {
          availability_config: Json
          config_version: number
          created_at: string
          created_by: string | null
          customer_instructions: string | null
          enabled: boolean
          id: string
          measurement_config: Json
          photo_max: number
          photo_min: number
          photo_mode: string
          service_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          availability_config?: Json
          config_version?: number
          created_at?: string
          created_by?: string | null
          customer_instructions?: string | null
          enabled?: boolean
          id?: string
          measurement_config?: Json
          photo_max?: number
          photo_min?: number
          photo_mode?: string
          service_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          availability_config?: Json
          config_version?: number
          created_at?: string
          created_by?: string | null
          customer_instructions?: string | null
          enabled?: boolean
          id?: string
          measurement_config?: Json
          photo_max?: number
          photo_min?: number
          photo_mode?: string
          service_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_service_config_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_service_intelligence: {
        Row: {
          aliases: string[] | null
          assessment_required: boolean | null
          created_at: string
          disambiguation_attributes: string[] | null
          id: string
          keywords: string[] | null
          notes: string | null
          optional_attributes: string[] | null
          pricing_drivers: Json | null
          primary_service_id: string
          required_attributes: string[] | null
          requires_photos: boolean | null
          service_category: string | null
          service_family: string
          updated_at: string
        }
        Insert: {
          aliases?: string[] | null
          assessment_required?: boolean | null
          created_at?: string
          disambiguation_attributes?: string[] | null
          id?: string
          keywords?: string[] | null
          notes?: string | null
          optional_attributes?: string[] | null
          pricing_drivers?: Json | null
          primary_service_id: string
          required_attributes?: string[] | null
          requires_photos?: boolean | null
          service_category?: string | null
          service_family: string
          updated_at?: string
        }
        Update: {
          aliases?: string[] | null
          assessment_required?: boolean | null
          created_at?: string
          disambiguation_attributes?: string[] | null
          id?: string
          keywords?: string[] | null
          notes?: string | null
          optional_attributes?: string[] | null
          pricing_drivers?: Json | null
          primary_service_id?: string
          required_attributes?: string[] | null
          requires_photos?: boolean | null
          service_category?: string | null
          service_family?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_service_intelligence_primary_service_id_fkey"
            columns: ["primary_service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_engine_service_scope: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          scope_type: string
          service_config_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          scope_type: string
          service_config_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          scope_type?: string
          service_config_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_engine_service_scope_service_config_id_fkey"
            columns: ["service_config_id"]
            isOneToOne: false
            referencedRelation: "booking_engine_service_config"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          agent_id: string
          agent_margin: number | null
          agent_price: number | null
          amount_paid: number | null
          booking_code: string | null
          client_consent: boolean | null
          client_id: string | null
          client_name: string
          client_phone: string
          client_signature: string | null
          client_signed_at: string | null
          commission_created: boolean
          completion_percent: number | null
          created_at: string
          created_by_name: string | null
          created_by_role: string | null
          discount_amount: number
          discount_approval_comment: string | null
          discount_approval_status: string
          discount_approved_at: string | null
          discount_approved_by: string | null
          discount_reason: string | null
          discount_requested_at: string | null
          discount_type: string | null
          discount_value: number
          id: string
          last_modified_at: string | null
          last_modified_by: string | null
          last_modified_by_name: string | null
          line_items: Json | null
          local_id: string | null
          location: string
          mpesa_code: string | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          price: number
          quantity: string | null
          salesperson_id: string | null
          salesperson_name: string | null
          salesperson_role: string | null
          service_date: string
          service_id: string
          size_sqm: number | null
          staff_signature: string | null
          staff_signed_at: string | null
          staff_signed_name: string | null
          status: Database["public"]["Enums"]["booking_status"]
          subtotal: number | null
          system_price: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_margin?: number | null
          agent_price?: number | null
          amount_paid?: number | null
          booking_code?: string | null
          client_consent?: boolean | null
          client_id?: string | null
          client_name: string
          client_phone: string
          client_signature?: string | null
          client_signed_at?: string | null
          commission_created?: boolean
          completion_percent?: number | null
          created_at?: string
          created_by_name?: string | null
          created_by_role?: string | null
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_approval_status?: string
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_reason?: string | null
          discount_requested_at?: string | null
          discount_type?: string | null
          discount_value?: number
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          last_modified_by_name?: string | null
          line_items?: Json | null
          local_id?: string | null
          location: string
          mpesa_code?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          price: number
          quantity?: string | null
          salesperson_id?: string | null
          salesperson_name?: string | null
          salesperson_role?: string | null
          service_date: string
          service_id: string
          size_sqm?: number | null
          staff_signature?: string | null
          staff_signed_at?: string | null
          staff_signed_name?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number | null
          system_price?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_margin?: number | null
          agent_price?: number | null
          amount_paid?: number | null
          booking_code?: string | null
          client_consent?: boolean | null
          client_id?: string | null
          client_name?: string
          client_phone?: string
          client_signature?: string | null
          client_signed_at?: string | null
          commission_created?: boolean
          completion_percent?: number | null
          created_at?: string
          created_by_name?: string | null
          created_by_role?: string | null
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_approval_status?: string
          discount_approved_at?: string | null
          discount_approved_by?: string | null
          discount_reason?: string | null
          discount_requested_at?: string | null
          discount_type?: string | null
          discount_value?: number
          id?: string
          last_modified_at?: string | null
          last_modified_by?: string | null
          last_modified_by_name?: string | null
          line_items?: Json | null
          local_id?: string | null
          location?: string
          mpesa_code?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          price?: number
          quantity?: string | null
          salesperson_id?: string | null
          salesperson_name?: string | null
          salesperson_role?: string | null
          service_date?: string
          service_id?: string
          size_sqm?: number | null
          staff_signature?: string | null
          staff_signed_at?: string | null
          staff_signed_name?: string | null
          status?: Database["public"]["Enums"]["booking_status"]
          subtotal?: number | null
          system_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          booking_count: number
          client_code: string | null
          created_at: string
          created_by: string
          created_by_role: string
          email: string | null
          full_name: string
          id: string
          last_booking_date: string | null
          local_id: string | null
          location: string | null
          notes: string | null
          phone: string
          status: string
          total_spend: number
          updated_at: string
          user_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          booking_count?: number
          client_code?: string | null
          created_at?: string
          created_by: string
          created_by_role?: string
          email?: string | null
          full_name: string
          id?: string
          last_booking_date?: string | null
          local_id?: string | null
          location?: string | null
          notes?: string | null
          phone: string
          status?: string
          total_spend?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          booking_count?: number
          client_code?: string | null
          created_at?: string
          created_by?: string
          created_by_role?: string
          email?: string | null
          full_name?: string
          id?: string
          last_booking_date?: string | null
          local_id?: string | null
          location?: string | null
          notes?: string | null
          phone?: string
          status?: string
          total_spend?: number
          updated_at?: string
          user_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agent_id: string
          amount: number
          bonus_amount: number
          booking_id: string
          created_at: string
          id: string
          tier_at_time: Database["public"]["Enums"]["commission_tier"]
        }
        Insert: {
          agent_id: string
          amount?: number
          bonus_amount?: number
          booking_id: string
          created_at?: string
          id?: string
          tier_at_time?: Database["public"]["Enums"]["commission_tier"]
        }
        Update: {
          agent_id?: string
          amount?: number
          bonus_amount?: number
          booking_id?: string
          created_at?: string
          id?: string
          tier_at_time?: Database["public"]["Enums"]["commission_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "commissions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          activity_date: string
          activity_type: string
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string | null
          outcome: string | null
          subject: string
        }
        Insert: {
          activity_date?: string
          activity_type: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          subject: string
        }
        Update: {
          activity_date?: string
          activity_type?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          priority: string
          status: string
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_feedback: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          booking_id: string | null
          client_id: string | null
          client_name: string
          comment: string | null
          created_at: string
          id: string
          is_complaint: boolean
          local_id: string | null
          rating: number
          service_name: string | null
          submitted_by: string | null
          submitted_by_role: string | null
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          booking_id?: string | null
          client_id?: string | null
          client_name: string
          comment?: string | null
          created_at?: string
          id?: string
          is_complaint?: boolean
          local_id?: string | null
          rating: number
          service_name?: string | null
          submitted_by?: string | null
          submitted_by_role?: string | null
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          booking_id?: string | null
          client_id?: string | null
          client_name?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_complaint?: boolean
          local_id?: string | null
          rating?: number
          service_name?: string | null
          submitted_by?: string | null
          submitted_by_role?: string | null
        }
        Relationships: []
      }
      customer_notifications: {
        Row: {
          body: string | null
          client_id: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          amount: number
          booking_id: string | null
          client_id: string | null
          client_location: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          created_by: string
          created_by_name: string
          created_by_role: string
          department: string | null
          description: string | null
          document_number: string
          document_type: string
          id: string
          invoice_id: string | null
          line_items: Json | null
          payment_reason: string | null
          payment_status: string | null
          quantity: string | null
          quotation_id: string | null
          salesperson_name: string | null
          service_name: string | null
          staff_name: string | null
          status: string
          unit_price: number | null
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          client_id?: string | null
          client_location?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by: string
          created_by_name: string
          created_by_role?: string
          department?: string | null
          description?: string | null
          document_number: string
          document_type?: string
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          payment_reason?: string | null
          payment_status?: string | null
          quantity?: string | null
          quotation_id?: string | null
          salesperson_name?: string | null
          service_name?: string | null
          staff_name?: string | null
          status?: string
          unit_price?: number | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          client_id?: string | null
          client_location?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string
          created_by_role?: string
          department?: string | null
          description?: string | null
          document_number?: string
          document_type?: string
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          payment_reason?: string | null
          payment_status?: string | null
          quantity?: string | null
          quotation_id?: string | null
          salesperson_name?: string | null
          service_name?: string | null
          staff_name?: string | null
          status?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensation: {
        Row: {
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          basic_salary: number
          created_at: string
          effective_date: string
          employee_id: string
          housing_levy_exempt: boolean
          id: string
          kra_pin: string | null
          mpesa_number: string | null
          nssf_exempt: boolean
          nssf_number: string | null
          paye_exempt: boolean
          payment_method: string
          shif_exempt: boolean
          shif_number: string | null
          updated_at: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number
          created_at?: string
          effective_date?: string
          employee_id: string
          housing_levy_exempt?: boolean
          id?: string
          kra_pin?: string | null
          mpesa_number?: string | null
          nssf_exempt?: boolean
          nssf_number?: string | null
          paye_exempt?: boolean
          payment_method?: string
          shif_exempt?: boolean
          shif_number?: string | null
          updated_at?: string
        }
        Update: {
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          basic_salary?: number
          created_at?: string
          effective_date?: string
          employee_id?: string
          housing_levy_exempt?: boolean
          id?: string
          kra_pin?: string | null
          mpesa_number?: string | null
          nssf_exempt?: boolean
          nssf_number?: string | null
          paye_exempt?: boolean
          payment_method?: string
          shif_exempt?: boolean
          shif_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_employment: {
        Row: {
          contract_reference: string | null
          created_at: string
          department_id: string | null
          employee_id: string
          employment_status: string | null
          employment_type: string | null
          end_date: string | null
          id: string
          notes: string | null
          position_id: string | null
          salary_amount: number | null
          salary_frequency: string | null
          start_date: string | null
          supervisor_employee_id: string | null
          work_location: string | null
        }
        Insert: {
          contract_reference?: string | null
          created_at?: string
          department_id?: string | null
          employee_id: string
          employment_status?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          position_id?: string | null
          salary_amount?: number | null
          salary_frequency?: string | null
          start_date?: string | null
          supervisor_employee_id?: string | null
          work_location?: string | null
        }
        Update: {
          contract_reference?: string | null
          created_at?: string
          department_id?: string | null
          employee_id?: string
          employment_status?: string | null
          employment_type?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          position_id?: string | null
          salary_amount?: number | null
          salary_frequency?: string | null
          start_date?: string | null
          supervisor_employee_id?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_employment_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_employment_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_employment_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hr_positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_employment_supervisor_employee_id_fkey"
            columns: ["supervisor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_pay_components: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          is_active: boolean
          is_taxable: boolean
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          employee_id: string
          id?: string
          is_active?: boolean
          is_taxable?: boolean
          kind: string
          name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          is_active?: boolean
          is_taxable?: boolean
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_pay_components_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_timeline: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          employee_id: string
          event_title: string
          event_type: string
          id: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id: string
          event_title: string
          event_type: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          employee_id?: string
          event_title?: string
          event_type?: string
          id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_timeline_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          alternate_phone: string | null
          county: string | null
          created_at: string
          date_of_birth: string | null
          department_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employee_code: string
          employment_status: string
          employment_type: string | null
          first_name: string
          full_name: string | null
          gender: string | null
          hire_date: string | null
          id: string
          last_name: string
          manager_id: string | null
          marital_status: string | null
          middle_name: string | null
          national_id: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          physical_address: string | null
          position_id: string | null
          probation_end_date: string | null
          termination_date: string | null
          town: string | null
          updated_at: string
          user_id: string | null
          work_location: string | null
        }
        Insert: {
          alternate_phone?: string | null
          county?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_code: string
          employment_status?: string
          employment_type?: string | null
          first_name: string
          full_name?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string
          last_name: string
          manager_id?: string | null
          marital_status?: string | null
          middle_name?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          physical_address?: string | null
          position_id?: string | null
          probation_end_date?: string | null
          termination_date?: string | null
          town?: string | null
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
        }
        Update: {
          alternate_phone?: string | null
          county?: string | null
          created_at?: string
          date_of_birth?: string | null
          department_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_code?: string
          employment_status?: string
          employment_type?: string | null
          first_name?: string
          full_name?: string | null
          gender?: string | null
          hire_date?: string | null
          id?: string
          last_name?: string
          manager_id?: string | null
          marital_status?: string | null
          middle_name?: string | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          physical_address?: string | null
          position_id?: string | null
          probation_end_date?: string | null
          termination_date?: string | null
          town?: string | null
          updated_at?: string
          user_id?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "hr_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          paid_at: string | null
          paid_by: string | null
          payment_method: string
          payment_reference: string | null
          petty_cash_fund_id: string | null
          receipt_reference: string | null
          receipt_url: string | null
          rejection_reason: string | null
          supplier_name: string | null
        }
        Insert: {
          amount: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string
          payment_reference?: string | null
          petty_cash_fund_id?: string | null
          receipt_reference?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          supplier_name?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string
          payment_reference?: string | null
          petty_cash_fund_id?: string | null
          receipt_reference?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_petty_cash_fund_id_fkey"
            columns: ["petty_cash_fund_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_fund_balances"
            referencedColumns: ["fund_id"]
          },
          {
            foreignKeyName: "expenses_petty_cash_fund_id_fkey"
            columns: ["petty_cash_fund_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_funds"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_service_request_rate_limits: {
        Row: {
          ip_hash: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          ip_hash: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          ip_hash?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      guest_service_requests: {
        Row: {
          converted_at: string | null
          converted_by: string | null
          created_at: string
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string
          discount_amount: number
          estimated_amount: number
          id: string
          internal_notes: string | null
          lead_id: string | null
          location: string
          preferred_date: string
          preferred_time: string
          request_reference: string
          request_type: string
          service_category: string | null
          service_id: string
          service_name: string
          size_sqm: number | null
          status: string
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone: string
          discount_amount?: number
          estimated_amount?: number
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          location: string
          preferred_date: string
          preferred_time: string
          request_reference?: string
          request_type: string
          service_category?: string | null
          service_id: string
          service_name: string
          size_sqm?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          converted_by?: string | null
          created_at?: string
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string
          discount_amount?: number
          estimated_amount?: number
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          location?: string
          preferred_date?: string
          preferred_time?: string
          request_reference?: string
          request_type?: string
          service_category?: string | null
          service_id?: string
          service_name?: string
          size_sqm?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_service_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_departments: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          manager_employee_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          manager_employee_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_departments_manager_fk"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_positions: {
        Row: {
          code: string | null
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "hr_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      income_records: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          booking_id: string | null
          client_id: string | null
          created_at: string
          created_by: string
          date: string
          description: string | null
          discount_amount: number
          discount_approval_comment: string | null
          discount_reason: string | null
          id: string
          invoice_id: string | null
          mpesa_code: string | null
          payment_method: string
          payment_reference: string | null
          rejection_reason: string | null
          service: string | null
          source: string
          status: string
          subtotal: number | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          id?: string
          invoice_id?: string | null
          mpesa_code?: string | null
          payment_method?: string
          payment_reference?: string | null
          rejection_reason?: string | null
          service?: string | null
          source?: string
          status?: string
          subtotal?: number | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          id?: string
          invoice_id?: string | null
          mpesa_code?: string | null
          payment_method?: string
          payment_reference?: string | null
          rejection_reason?: string | null
          service?: string | null
          source?: string
          status?: string
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "income_records_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          income_record_id: string | null
          invoice_id: string
          payment_date: string
          payment_method: string
          payment_reference: string | null
          recorded_by: string
          rejection_reason: string | null
        }
        Insert: {
          amount: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          income_record_id?: string | null
          invoice_id: string
          payment_date?: string
          payment_method: string
          payment_reference?: string | null
          recorded_by: string
          rejection_reason?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          income_record_id?: string | null
          invoice_id?: string
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
          recorded_by?: string
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_income_record_id_fkey"
            columns: ["income_record_id"]
            isOneToOne: false
            referencedRelation: "income_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          booking_id: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string
          date: string
          discount_amount: number
          discount_approval_comment: string | null
          discount_reason: string | null
          due_date: string | null
          id: string
          invoice_number: string
          line_items: Json | null
          local_id: string | null
          mpesa_code: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          salesperson_id: string | null
          salesperson_name: string | null
          salesperson_role: string | null
          service: string
          subtotal: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by: string
          date?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          line_items?: Json | null
          local_id?: string | null
          mpesa_code?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          salesperson_id?: string | null
          salesperson_name?: string | null
          salesperson_role?: string | null
          service: string
          subtotal?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string
          date?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          line_items?: Json | null
          local_id?: string | null
          mpesa_code?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          salesperson_id?: string | null
          salesperson_name?: string | null
          salesperson_role?: string | null
          service?: string
          subtotal?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: number
          id: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          rejection_reason: string | null
          reversal_of: string | null
          source_id: string | null
          source_type: string | null
          status: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entry_date?: string
          entry_number?: number
          id?: string
          period_id: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entry_date?: string
          entry_number?: number
          id?: string
          period_id?: string
          posted_at?: string | null
          posted_by?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["period_id"]
          },
          {
            foreignKeyName: "journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: true
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          created_at: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          line_number: number
        }
        Insert: {
          account_id: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          line_number: number
        }
        Update: {
          account_id?: string
          created_at?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          booking_id: string | null
          converted_at: string | null
          converted_client_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estimated_value: number
          full_name: string
          id: string
          lead_code: string
          location: string | null
          lost_reason: string | null
          notes: string | null
          phone: string | null
          priority: string
          service_id: string | null
          service_interest: string | null
          source: string
          status: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          assigned_to?: string | null
          booking_id?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number
          full_name: string
          id?: string
          lead_code: string
          location?: string | null
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string
          service_id?: string | null
          service_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          assigned_to?: string | null
          booking_id?: string | null
          converted_at?: string | null
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number
          full_name?: string
          id?: string
          lead_code?: string
          location?: string | null
          lost_reason?: string | null
          notes?: string | null
          phone?: string | null
          priority?: string
          service_id?: string | null
          service_interest?: string | null
          source?: string
          status?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_email_logs: {
        Row: {
          created_at: string
          email_id: string
          error_message: string | null
          id: string
          recipient_email: string
          recipient_id: string
          recipient_role: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email_id: string
          error_message?: string | null
          id?: string
          recipient_email: string
          recipient_id: string
          recipient_role: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email_id?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          recipient_id?: string
          recipient_role?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "mass_email_logs_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "mass_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      mass_emails: {
        Row: {
          audience_type: string
          body: string
          created_at: string
          created_by: string
          id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          audience_type?: string
          body: string
          created_at?: string
          created_by: string
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          audience_type?: string
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_id: string
          sender_role: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          ip_address: string | null
          notice_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          notice_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          ip_address?: string | null
          notice_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_acknowledgements_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          acknowledgement_deadline: string | null
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          is_blocking: boolean
          is_pinned: boolean
          link_label: string | null
          link_url: string | null
          message: string
          open_in_new_tab: boolean
          priority: Database["public"]["Enums"]["notice_priority"]
          requires_acknowledgement: boolean
          target_role: Database["public"]["Enums"]["notice_target_role"]
          title: string
        }
        Insert: {
          acknowledgement_deadline?: string | null
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          is_pinned?: boolean
          link_label?: string | null
          link_url?: string | null
          message: string
          open_in_new_tab?: boolean
          priority?: Database["public"]["Enums"]["notice_priority"]
          requires_acknowledgement?: boolean
          target_role?: Database["public"]["Enums"]["notice_target_role"]
          title: string
        }
        Update: {
          acknowledgement_deadline?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_blocking?: boolean
          is_pinned?: boolean
          link_label?: string | null
          link_url?: string | null
          message?: string
          open_in_new_tab?: boolean
          priority?: Database["public"]["Enums"]["notice_priority"]
          requires_acknowledgement?: boolean
          target_role?: Database["public"]["Enums"]["notice_target_role"]
          title?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          admin_notes: string | null
          agent_id: string
          amount: number
          id: string
          processed_at: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payout_status"]
        }
        Insert: {
          admin_notes?: string | null
          agent_id: string
          amount: number
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string
          amount?: number
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payout_status"]
        }
        Relationships: []
      }
      payroll_items: {
        Row: {
          adjustment_note: string | null
          basic_salary: number
          bonus: number
          created_at: string
          deductions_breakdown: Json
          department_name: string | null
          earnings_breakdown: Json
          employee_code: string | null
          employee_id: string
          employee_name: string | null
          employer_housing_levy: number
          employer_nssf: number
          gross_salary: number
          housing_levy_amount: number
          id: string
          kra_pin: string | null
          net_paye: number
          net_salary: number
          nssf_tier1: number
          nssf_tier2: number
          other_deductions: number
          overtime: number
          paye_before_relief: number
          payment_account: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          payroll_run_id: string
          personal_relief: number
          position_title: string | null
          shif_amount: number
          taxable_pay: number
          total_allowances: number
          total_deductions: number
          updated_at: string
        }
        Insert: {
          adjustment_note?: string | null
          basic_salary?: number
          bonus?: number
          created_at?: string
          deductions_breakdown?: Json
          department_name?: string | null
          earnings_breakdown?: Json
          employee_code?: string | null
          employee_id: string
          employee_name?: string | null
          employer_housing_levy?: number
          employer_nssf?: number
          gross_salary?: number
          housing_levy_amount?: number
          id?: string
          kra_pin?: string | null
          net_paye?: number
          net_salary?: number
          nssf_tier1?: number
          nssf_tier2?: number
          other_deductions?: number
          overtime?: number
          paye_before_relief?: number
          payment_account?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          payroll_run_id: string
          personal_relief?: number
          position_title?: string | null
          shif_amount?: number
          taxable_pay?: number
          total_allowances?: number
          total_deductions?: number
          updated_at?: string
        }
        Update: {
          adjustment_note?: string | null
          basic_salary?: number
          bonus?: number
          created_at?: string
          deductions_breakdown?: Json
          department_name?: string | null
          earnings_breakdown?: Json
          employee_code?: string | null
          employee_id?: string
          employee_name?: string | null
          employer_housing_levy?: number
          employer_nssf?: number
          gross_salary?: number
          housing_levy_amount?: number
          id?: string
          kra_pin?: string | null
          net_paye?: number
          net_salary?: number
          nssf_tier1?: number
          nssf_tier2?: number
          other_deductions?: number
          overtime?: number
          paye_before_relief?: number
          payment_account?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          payroll_run_id?: string
          personal_relief?: number
          position_title?: string | null
          shif_amount?: number
          taxable_pay?: number
          total_allowances?: number
          total_deductions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approval_requested_at: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          employee_count: number
          end_date: string
          id: string
          notes: string | null
          paid_at: string | null
          pay_date: string | null
          payment_reference: string | null
          payroll_code: string
          period_month: number
          period_year: number
          rejection_reason: string | null
          start_date: string
          status: string
          total_deductions: number
          total_employer_cost: number
          total_gross: number
          total_net: number
          updated_at: string
        }
        Insert: {
          approval_requested_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          employee_count?: number
          end_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pay_date?: string | null
          payment_reference?: string | null
          payroll_code: string
          period_month: number
          period_year: number
          rejection_reason?: string | null
          start_date: string
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Update: {
          approval_requested_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          employee_count?: number
          end_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          pay_date?: string | null
          payment_reference?: string | null
          payroll_code?: string
          period_month?: number
          period_year?: number
          rejection_reason?: string | null
          start_date?: string
          status?: string
          total_deductions?: number
          total_employer_cost?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Relationships: []
      }
      pest_areas_treated: {
        Row: {
          area_name: string
          created_at: string
          id: string
          notes: string | null
          pest_job_id: string
        }
        Insert: {
          area_name: string
          created_at?: string
          id?: string
          notes?: string | null
          pest_job_id: string
        }
        Update: {
          area_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          pest_job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pest_areas_treated_pest_job_id_fkey"
            columns: ["pest_job_id"]
            isOneToOne: false
            referencedRelation: "pest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_certificates: {
        Row: {
          amount_paid: number
          certificate_number: string
          chemicals_summary: string | null
          client_id: string | null
          client_location: string | null
          client_name: string
          client_phone: string | null
          client_signature: string | null
          client_signed_at: string | null
          created_at: string
          free_revisit_eligible: boolean
          generated_by: string
          generated_by_name: string | null
          generated_by_role: string | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          mpesa_code: string | null
          payment_date: string | null
          pest_job_id: string
          safety_recommendations: string | null
          staff_signature: string | null
          staff_signed_at: string | null
          staff_signed_name: string | null
          treatment_summary: string | null
          warranty_days: number
          warranty_expiry: string | null
        }
        Insert: {
          amount_paid?: number
          certificate_number: string
          chemicals_summary?: string | null
          client_id?: string | null
          client_location?: string | null
          client_name: string
          client_phone?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          created_at?: string
          free_revisit_eligible?: boolean
          generated_by: string
          generated_by_name?: string | null
          generated_by_role?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          mpesa_code?: string | null
          payment_date?: string | null
          pest_job_id: string
          safety_recommendations?: string | null
          staff_signature?: string | null
          staff_signed_at?: string | null
          staff_signed_name?: string | null
          treatment_summary?: string | null
          warranty_days?: number
          warranty_expiry?: string | null
        }
        Update: {
          amount_paid?: number
          certificate_number?: string
          chemicals_summary?: string | null
          client_id?: string | null
          client_location?: string | null
          client_name?: string
          client_phone?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          created_at?: string
          free_revisit_eligible?: boolean
          generated_by?: string
          generated_by_name?: string | null
          generated_by_role?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          mpesa_code?: string | null
          payment_date?: string | null
          pest_job_id?: string
          safety_recommendations?: string | null
          staff_signature?: string | null
          staff_signed_at?: string | null
          staff_signed_name?: string | null
          treatment_summary?: string | null
          warranty_days?: number
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pest_certificates_pest_job_id_fkey"
            columns: ["pest_job_id"]
            isOneToOne: false
            referencedRelation: "pest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_chemical_usage: {
        Row: {
          chemical_name: string
          created_at: string
          dosage: string | null
          id: string
          local_id: string | null
          pest_job_id: string
          quantity: number
          technician_id: string | null
          technician_name: string | null
          treatment_id: string | null
          unit: string | null
          used_on: string
        }
        Insert: {
          chemical_name: string
          created_at?: string
          dosage?: string | null
          id?: string
          local_id?: string | null
          pest_job_id: string
          quantity?: number
          technician_id?: string | null
          technician_name?: string | null
          treatment_id?: string | null
          unit?: string | null
          used_on?: string
        }
        Update: {
          chemical_name?: string
          created_at?: string
          dosage?: string | null
          id?: string
          local_id?: string | null
          pest_job_id?: string
          quantity?: number
          technician_id?: string | null
          technician_name?: string | null
          treatment_id?: string | null
          unit?: string | null
          used_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "pest_chemical_usage_pest_job_id_fkey"
            columns: ["pest_job_id"]
            isOneToOne: false
            referencedRelation: "pest_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pest_chemical_usage_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "pest_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_followups: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          followup_type: string
          id: string
          local_id: string | null
          notes: string | null
          pest_job_id: string
          scheduled_date: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          followup_type?: string
          id?: string
          local_id?: string | null
          notes?: string | null
          pest_job_id: string
          scheduled_date: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          followup_type?: string
          id?: string
          local_id?: string | null
          notes?: string | null
          pest_job_id?: string
          scheduled_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pest_followups_pest_job_id_fkey"
            columns: ["pest_job_id"]
            isOneToOne: false
            referencedRelation: "pest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_inspections: {
        Row: {
          affected_areas: string | null
          client_observations: string | null
          created_at: string
          id: string
          infestation_level: string | null
          inspected_at: string
          inspected_by: string | null
          local_id: string | null
          pest_job_id: string
          pest_type: string | null
          technician_notes: string | null
          updated_at: string
        }
        Insert: {
          affected_areas?: string | null
          client_observations?: string | null
          created_at?: string
          id?: string
          infestation_level?: string | null
          inspected_at?: string
          inspected_by?: string | null
          local_id?: string | null
          pest_job_id: string
          pest_type?: string | null
          technician_notes?: string | null
          updated_at?: string
        }
        Update: {
          affected_areas?: string | null
          client_observations?: string | null
          created_at?: string
          id?: string
          infestation_level?: string | null
          inspected_at?: string
          inspected_by?: string | null
          local_id?: string | null
          pest_job_id?: string
          pest_type?: string | null
          technician_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pest_inspections_pest_job_id_fkey"
            columns: ["pest_job_id"]
            isOneToOne: false
            referencedRelation: "pest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_jobs: {
        Row: {
          booking_id: string | null
          client_id: string | null
          client_location: string | null
          client_name: string
          client_phone: string | null
          client_signature: string | null
          client_signed_at: string | null
          created_at: string
          created_by: string
          created_by_name: string | null
          created_by_role: string | null
          id: string
          infestation_level: string | null
          invoice_id: string | null
          job_number: string | null
          local_id: string | null
          notes: string | null
          pest_type: string | null
          price: number
          service_date: string
          status: string
          technician_id: string | null
          technician_name: string | null
          updated_at: string
        }
        Insert: {
          booking_id?: string | null
          client_id?: string | null
          client_location?: string | null
          client_name: string
          client_phone?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          created_at?: string
          created_by: string
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          infestation_level?: string | null
          invoice_id?: string | null
          job_number?: string | null
          local_id?: string | null
          notes?: string | null
          pest_type?: string | null
          price?: number
          service_date?: string
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string | null
          client_id?: string | null
          client_location?: string | null
          client_name?: string
          client_phone?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          created_at?: string
          created_by?: string
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          infestation_level?: string | null
          invoice_id?: string | null
          job_number?: string | null
          local_id?: string | null
          notes?: string | null
          pest_type?: string | null
          price?: number
          service_date?: string
          status?: string
          technician_id?: string | null
          technician_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pest_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          kind: string
          local_id: string | null
          pest_job_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          local_id?: string | null
          pest_job_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          kind?: string
          local_id?: string | null
          pest_job_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pest_photos_pest_job_id_fkey"
            columns: ["pest_job_id"]
            isOneToOne: false
            referencedRelation: "pest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pest_treatments: {
        Row: {
          client_acknowledged: boolean
          created_at: string
          equipment_used: string | null
          id: string
          local_id: string | null
          notes: string | null
          performed_at: string
          performed_by: string | null
          performed_by_name: string | null
          pest_job_id: string
          ppe_used: string | null
          safety_instructions: string | null
          treatment_method: string | null
        }
        Insert: {
          client_acknowledged?: boolean
          created_at?: string
          equipment_used?: string | null
          id?: string
          local_id?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          performed_by_name?: string | null
          pest_job_id: string
          ppe_used?: string | null
          safety_instructions?: string | null
          treatment_method?: string | null
        }
        Update: {
          client_acknowledged?: boolean
          created_at?: string
          equipment_used?: string | null
          id?: string
          local_id?: string | null
          notes?: string | null
          performed_at?: string
          performed_by?: string | null
          performed_by_name?: string | null
          pest_job_id?: string
          ppe_used?: string | null
          safety_instructions?: string | null
          treatment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pest_treatments_pest_job_id_fkey"
            columns: ["pest_job_id"]
            isOneToOne: false
            referencedRelation: "pest_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      petty_cash_funds: {
        Row: {
          accounting_account_id: string
          created_at: string
          created_by: string | null
          custodian_id: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          opening_balance_source_account_id: string | null
          updated_at: string
        }
        Insert: {
          accounting_account_id: string
          created_at?: string
          created_by?: string | null
          custodian_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          opening_balance_source_account_id?: string | null
          updated_at?: string
        }
        Update: {
          accounting_account_id?: string
          created_at?: string
          created_by?: string | null
          custodian_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          opening_balance_source_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_funds_accounting_account_id_fkey"
            columns: ["accounting_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_funds_accounting_account_id_fkey"
            columns: ["accounting_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "petty_cash_funds_opening_balance_source_account_id_fkey"
            columns: ["opening_balance_source_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_funds_opening_balance_source_account_id_fkey"
            columns: ["opening_balance_source_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
        ]
      }
      petty_cash_transactions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string
          expense_id: string | null
          fund_id: string
          id: string
          receipt_reference: string | null
          receipt_url: string | null
          reference: string | null
          rejection_reason: string | null
          source_account_id: string | null
          status: string
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          expense_id?: string | null
          fund_id: string
          id?: string
          receipt_reference?: string | null
          receipt_url?: string | null
          reference?: string | null
          rejection_reason?: string | null
          source_account_id?: string | null
          status?: string
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          expense_id?: string | null
          fund_id?: string
          id?: string
          receipt_reference?: string | null
          receipt_url?: string | null
          reference?: string | null
          rejection_reason?: string | null
          source_account_id?: string | null
          status?: string
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "petty_cash_transactions_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_fund_balances"
            referencedColumns: ["fund_id"]
          },
          {
            foreignKeyName: "petty_cash_transactions_fund_id_fkey"
            columns: ["fund_id"]
            isOneToOne: false
            referencedRelation: "petty_cash_funds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "petty_cash_transactions_source_account_id_fkey"
            columns: ["source_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_budget_vs_actual"
            referencedColumns: ["account_id"]
          },
        ]
      }
      profile_edit_requests: {
        Row: {
          created_at: string
          id: string
          proposed_data: Json
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proposed_data: Json
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proposed_data?: Json
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_online: boolean
          last_seen: string | null
          mpesa_number: string
          phone: string
          referral_code: string | null
          status: Database["public"]["Enums"]["agent_status"]
          town_estate: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          is_online?: boolean
          last_seen?: string | null
          mpesa_number: string
          phone: string
          referral_code?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          town_estate: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_online?: boolean
          last_seen?: string | null
          mpesa_number?: string
          phone?: string
          referral_code?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          town_estate?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotations: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string
          created_at: string
          created_by: string
          created_by_name: string
          created_by_role: string
          discount_amount: number
          discount_approval_comment: string | null
          discount_reason: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          line_items: Json | null
          local_id: string | null
          price: number
          quotation_number: string
          salesperson_id: string | null
          salesperson_name: string | null
          salesperson_role: string | null
          service_date: string | null
          service_name: string
          subtotal: number | null
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone: string
          created_at?: string
          created_by: string
          created_by_name: string
          created_by_role?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          line_items?: Json | null
          local_id?: string | null
          price: number
          quotation_number: string
          salesperson_id?: string | null
          salesperson_name?: string | null
          salesperson_role?: string | null
          service_date?: string | null
          service_name: string
          subtotal?: number | null
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          created_by_role?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          line_items?: Json | null
          local_id?: string | null
          price?: number
          quotation_number?: string
          salesperson_id?: string | null
          salesperson_name?: string | null
          salesperson_role?: string | null
          service_date?: string | null
          service_name?: string
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_key: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_key?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_key?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      service_certificates: {
        Row: {
          amount_paid: number
          booking_id: string
          certificate_number: string
          client_id: string | null
          client_location: string | null
          client_name: string
          client_phone: string | null
          client_signature: string | null
          client_signed_at: string | null
          created_at: string
          date_created: string
          discount_amount: number
          discount_approval_comment: string | null
          discount_reason: string | null
          document_reference: string | null
          generated_by: string
          generated_by_name: string | null
          generated_by_role: string | null
          id: string
          invoice_id: string | null
          invoice_number: string | null
          line_items: Json | null
          local_id: string | null
          mpesa_code: string | null
          payment_date: string
          payment_method: string | null
          payment_reference: string | null
          services: string | null
          signature_bypass_admin_signature: string | null
          signature_bypass_reason: string | null
          signature_bypassed: boolean
          signature_bypassed_at: string | null
          signature_bypassed_by: string | null
          signature_bypassed_by_name: string | null
          staff_signature: string
          staff_signed_at: string | null
          staff_signed_name: string | null
          subtotal: number | null
        }
        Insert: {
          amount_paid?: number
          booking_id: string
          certificate_number: string
          client_id?: string | null
          client_location?: string | null
          client_name: string
          client_phone?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          created_at?: string
          date_created?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          document_reference?: string | null
          generated_by: string
          generated_by_name?: string | null
          generated_by_role?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          local_id?: string | null
          mpesa_code?: string | null
          payment_date: string
          payment_method?: string | null
          payment_reference?: string | null
          services?: string | null
          signature_bypass_admin_signature?: string | null
          signature_bypass_reason?: string | null
          signature_bypassed?: boolean
          signature_bypassed_at?: string | null
          signature_bypassed_by?: string | null
          signature_bypassed_by_name?: string | null
          staff_signature: string
          staff_signed_at?: string | null
          staff_signed_name?: string | null
          subtotal?: number | null
        }
        Update: {
          amount_paid?: number
          booking_id?: string
          certificate_number?: string
          client_id?: string | null
          client_location?: string | null
          client_name?: string
          client_phone?: string | null
          client_signature?: string | null
          client_signed_at?: string | null
          created_at?: string
          date_created?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
          document_reference?: string | null
          generated_by?: string
          generated_by_name?: string | null
          generated_by_role?: string | null
          id?: string
          invoice_id?: string | null
          invoice_number?: string | null
          line_items?: Json | null
          local_id?: string | null
          mpesa_code?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
          services?: string | null
          signature_bypass_admin_signature?: string | null
          signature_bypass_reason?: string | null
          signature_bypassed?: boolean
          signature_bypassed_at?: string | null
          signature_bypassed_by?: string | null
          signature_bypassed_by_name?: string | null
          staff_signature?: string
          staff_signed_at?: string | null
          staff_signed_name?: string | null
          subtotal?: number | null
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number
          category: string
          category_id: string | null
          commission_eligible: boolean
          created_at: string
          description: string | null
          dropdown_options: Json | null
          estimated_duration: string | null
          gallery_images: Json
          id: string
          image_url: string | null
          input_type: string
          is_active: boolean
          name: string
          price_per_sqm: number
          pricing_model: string
          pricing_unit: string
          requires_size_input: boolean
          service_code: string | null
          service_features: Json
          short_description: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string
          category_id?: string | null
          commission_eligible?: boolean
          created_at?: string
          description?: string | null
          dropdown_options?: Json | null
          estimated_duration?: string | null
          gallery_images?: Json
          id?: string
          image_url?: string | null
          input_type?: string
          is_active?: boolean
          name: string
          price_per_sqm?: number
          pricing_model?: string
          pricing_unit?: string
          requires_size_input?: boolean
          service_code?: string | null
          service_features?: Json
          short_description?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string
          category_id?: string | null
          commission_eligible?: boolean
          created_at?: string
          description?: string | null
          dropdown_options?: Json | null
          estimated_duration?: string | null
          gallery_images?: Json
          id?: string
          image_url?: string | null
          input_type?: string
          is_active?: boolean
          name?: string
          price_per_sqm?: number
          pricing_model?: string
          pricing_unit?: string
          requires_size_input?: boolean
          service_code?: string | null
          service_features?: Json
          short_description?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_tokens: {
        Row: {
          booking_id: string
          client_id: string | null
          created_at: string
          created_by: string
          expires_at: string
          id: string
          token: string
          used: boolean
        }
        Insert: {
          booking_id: string
          client_id?: string | null
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          token: string
          used?: boolean
        }
        Update: {
          booking_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
        }
        Relationships: []
      }
      smtp_settings: {
        Row: {
          from_email: string
          from_name: string
          id: string
          smtp_host: string
          smtp_pass: string
          smtp_port: number
          smtp_user: string
          updated_at: string
          updated_by: string | null
          use_tls: boolean
        }
        Insert: {
          from_email?: string
          from_name?: string
          id?: string
          smtp_host?: string
          smtp_pass?: string
          smtp_port?: number
          smtp_user?: string
          updated_at?: string
          updated_by?: string | null
          use_tls?: boolean
        }
        Update: {
          from_email?: string
          from_name?: string
          id?: string
          smtp_host?: string
          smtp_pass?: string
          smtp_port?: number
          smtp_user?: string
          updated_at?: string
          updated_by?: string | null
          use_tls?: boolean
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: Database["public"]["Enums"]["ledger_type"]
        }
        Relationships: []
      }
    }
    Views: {
      accounting_budget_vs_actual: {
        Row: {
          account_code: string | null
          account_id: string | null
          account_name: string | null
          account_type: string | null
          actual_amount: number | null
          budget_amount: number | null
          budget_id: string | null
          budget_name: string | null
          financial_year: string | null
          period_id: string | null
          period_name: string | null
        }
        Relationships: []
      }
      petty_cash_fund_balances: {
        Row: {
          created_at: string | null
          current_balance: number | null
          custodian_id: string | null
          fund_id: string | null
          is_active: boolean | null
          name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_booking_engine_quotation: {
        Args: { _request_id: string }
        Returns: Json
      }
      accounting_close_financial_year: {
        Args: { p_year_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          id: string
          name: string
          starts_on: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "accounting_financial_years"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_close_period: {
        Args: { p_period_id: string }
        Returns: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          ends_on: string
          financial_year_id: string | null
          id: string
          name: string
          starts_on: string
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "accounting_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_create_financial_year: {
        Args: { p_year: number }
        Returns: string
      }
      accounting_create_posted_journal: {
        Args: {
          p_approved_by: string
          p_created_by: string
          p_description: string
          p_entry_date: string
          p_lines: Json
          p_reference: string
          p_source_id: string
          p_source_type: string
        }
        Returns: string
      }
      accounting_decide_approval: {
        Args: { p_approval_id: string; p_decision: string; p_note?: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          entity_id: string
          entity_type: string
          id: string
          status: string
          submitted_at: string
          submitted_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "accounting_approvals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_generate_depreciation: {
        Args: { p_asset_id: string; p_period_id: string }
        Returns: string
      }
      accounting_next_entry_number: { Args: never; Returns: number }
      accounting_post_journal: {
        Args: { p_journal_id: string }
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          description: string
          entry_date: string
          entry_number: number
          id: string
          period_id: string
          posted_at: string | null
          posted_by: string | null
          reference: string | null
          rejection_reason: string | null
          reversal_of: string | null
          source_id: string | null
          source_type: string | null
          status: string
          voided_at: string | null
          voided_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "journal_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_record_asset_payment: {
        Args: {
          p_asset_id: string
          p_payment_date?: string
          p_payment_method: string
          p_payment_reference?: string
        }
        Returns: {
          accumulated_depreciation: number
          accumulated_depreciation_account_id: string | null
          approved_at: string | null
          approved_by: string | null
          asset_account_id: string | null
          asset_code: string
          category: string
          created_at: string
          created_by: string | null
          depreciation_expense_account_id: string | null
          depreciation_method: string
          description: string | null
          disposal_date: string | null
          disposal_proceeds: number | null
          id: string
          name: string
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payment_reference: string | null
          purchase_cost: number
          purchase_date: string
          rejection_reason: string | null
          residual_value: number
          source_expense_id: string | null
          status: string
          updated_at: string
          useful_life_months: number | null
        }
        SetofOptions: {
          from: "*"
          to: "accounting_fixed_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_record_expense_payment: {
        Args: {
          p_expense_id: string
          p_payment_date?: string
          p_payment_method: string
          p_payment_reference?: string
        }
        Returns: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          paid_at: string | null
          paid_by: string | null
          payment_method: string
          payment_reference: string | null
          petty_cash_fund_id: string | null
          receipt_reference: string | null
          receipt_url: string | null
          rejection_reason: string | null
          supplier_name: string | null
        }
        SetofOptions: {
          from: "*"
          to: "expenses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      accounting_record_petty_cash_expense: {
        Args: {
          p_amount: number
          p_category: string
          p_date: string
          p_description: string
          p_fund_id: string
          p_receipt_reference?: string
          p_receipt_url?: string
          p_supplier_name?: string
        }
        Returns: string
      }
      accounting_record_petty_cash_movement: {
        Args: {
          p_amount: number
          p_date: string
          p_description: string
          p_fund_id: string
          p_reference?: string
          p_source_account_id?: string
          p_type: string
        }
        Returns: string
      }
      add_booking_engine_request_item: {
        Args: {
          _answers?: Json
          _measurements?: Json
          _quantity?: number
          _request_id: string
          _selected_extras?: Json
          _service_id: string
        }
        Returns: string
      }
      apply_client_signature: {
        Args: { p_client_name: string; p_signature: string; p_token: string }
        Returns: string
      }
      approve_profile_edit: { Args: { request_id: string }; Returns: undefined }
      booking_engine_is_valid_transition: {
        Args: {
          _from_status: Database["public"]["Enums"]["booking_engine_request_status"]
          _to_status: Database["public"]["Enums"]["booking_engine_request_status"]
        }
        Returns: boolean
      }
      build_service_code: { Args: { _name: string }; Returns: string }
      build_service_slug: { Args: { _name: string }; Returns: string }
      calculate_booking_engine_item_price: {
        Args: { p_request_item_id: string }
        Returns: Json
      }
      calculate_booking_engine_request_price: {
        Args: { _request_id: string }
        Returns: Json
      }
      claim_client_record: { Args: never; Returns: string }
      collect_booking_payment: {
        Args: {
          p_booking_id: string
          p_payment_method: string
          p_payment_reference?: string
        }
        Returns: Json
      }
      consume_guest_service_request_rate_limit: {
        Args: {
          p_ip_hash: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: boolean
      }
      convert_booking_engine_request: {
        Args: { _request_id: string }
        Returns: Json
      }
      convert_guest_service_request_to_lead: {
        Args: { p_request_id: string }
        Returns: {
          already_converted: boolean
          lead_code: string
          lead_id: string
          request_id: string
          reused_existing_lead: boolean
        }[]
      }
      create_booking_engine_request: {
        Args: {
          _customer_notes?: string
          _requested_date?: string
          _requested_time?: string
          _service_location?: string
        }
        Returns: string
      }
      delete_booking_engine_request_item: {
        Args: { _item_id: string }
        Returns: string
      }
      get_profile_status: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["agent_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      is_agent: { Args: never; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      mark_booking_engine_ready_for_booking: {
        Args: { _request_id: string }
        Returns: Json
      }
      next_booking_code: { Args: never; Returns: string }
      next_booking_engine_request_number: { Args: never; Returns: string }
      next_certificate_number: { Args: never; Returns: string }
      next_client_code: { Args: never; Returns: string }
      next_employee_code: { Args: never; Returns: string }
      next_expense_voucher_number: { Args: never; Returns: string }
      next_fuel_voucher_number: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: string }
      next_lead_code: { Args: never; Returns: string }
      next_pest_certificate_number: { Args: never; Returns: string }
      next_quotation_number: { Args: never; Returns: string }
      next_receipt_number: { Args: never; Returns: string }
      next_salary_voucher_number: { Args: never; Returns: string }
      next_service_code: {
        Args: { _exclude_id?: string; _name: string }
        Returns: string
      }
      next_service_slug: {
        Args: { _exclude_id?: string; _name: string }
        Returns: string
      }
      notify_customer: {
        Args: {
          _body: string
          _client_id: string
          _link: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      owns_client:
        | { Args: { _client_id: string }; Returns: boolean }
        | { Args: { _client_id: string; _user_id: string }; Returns: boolean }
      prepare_booking_engine_quotation: {
        Args: { _quoted_items?: Json; _request_id: string }
        Returns: Json
      }
      record_invoice_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_payment_date?: string
          p_payment_method: string
          p_payment_reference: string
        }
        Returns: Json
      }
      resolve_booking_client: {
        Args: {
          p_created_by_role?: string
          p_full_name: string
          p_location: string
          p_phone: string
        }
        Returns: {
          client_code: string
          client_id: string
          full_name: string
          location: string
          phone: string
          was_created: boolean
        }[]
      }
      submit_booking_engine_request: {
        Args: { _request_id: string }
        Returns: string
      }
      update_booking_engine_request: {
        Args: {
          _customer_acknowledged_scope?: boolean
          _customer_notes?: string
          _request_id: string
          _requested_date?: string
          _requested_time?: string
          _service_location?: string
        }
        Returns: string
      }
      update_booking_engine_request_item: {
        Args: {
          _answers?: Json
          _item_id: string
          _measurements?: Json
          _quantity?: number
          _selected_extras?: Json
        }
        Returns: string
      }
    }
    Enums: {
      agent_status: "pending" | "approved" | "suspended"
      app_role: "agent" | "admin" | "super_admin"
      booking_engine_request_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "awaiting_customer"
        | "approved"
        | "quote_required"
        | "quote_prepared"
        | "customer_accepted"
        | "ready_for_booking"
        | "converted"
        | "rejected"
        | "cancelled"
      booking_status:
        | "pending"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "fully_confirmed"
        | "draft"
      commission_tier: "bronze" | "silver" | "gold"
      ledger_type: "credit" | "debit"
      notice_priority: "normal" | "important" | "urgent"
      notice_target_role: "agent" | "admin" | "all"
      payout_status: "pending" | "approved" | "rejected"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      agent_status: ["pending", "approved", "suspended"],
      app_role: ["agent", "admin", "super_admin"],
      booking_engine_request_status: [
        "draft",
        "submitted",
        "under_review",
        "awaiting_customer",
        "approved",
        "quote_required",
        "quote_prepared",
        "customer_accepted",
        "ready_for_booking",
        "converted",
        "rejected",
        "cancelled",
      ],
      booking_status: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "fully_confirmed",
        "draft",
      ],
      commission_tier: ["bronze", "silver", "gold"],
      ledger_type: ["credit", "debit"],
      notice_priority: ["normal", "important", "urgent"],
      notice_target_role: ["agent", "admin", "all"],
      payout_status: ["pending", "approved", "rejected"],
    },
  },
} as const
