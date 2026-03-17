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
      bookings: {
        Row: {
          agent_id: string
          agent_margin: number | null
          agent_price: number | null
          client_name: string
          client_phone: string
          commission_created: boolean
          created_at: string
          created_by_name: string | null
          created_by_role: string | null
          id: string
          location: string
          price: number
          quantity: string | null
          service_date: string
          service_id: string
          size_sqm: number | null
          status: Database["public"]["Enums"]["booking_status"]
          system_price: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_margin?: number | null
          agent_price?: number | null
          client_name: string
          client_phone: string
          commission_created?: boolean
          created_at?: string
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          location: string
          price: number
          quantity?: string | null
          service_date: string
          service_id: string
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          system_price?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_margin?: number | null
          agent_price?: number | null
          client_name?: string
          client_phone?: string
          commission_created?: boolean
          created_at?: string
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          location?: string
          price?: number
          quantity?: string | null
          service_date?: string
          service_id?: string
          size_sqm?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          system_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
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
      documents: {
        Row: {
          amount: number
          booking_id: string | null
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
          payment_reason: string | null
          payment_status: string | null
          quantity: string | null
          service_name: string | null
          staff_name: string | null
          unit_price: number | null
        }
        Insert: {
          amount?: number
          booking_id?: string | null
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
          payment_reason?: string | null
          payment_status?: string | null
          quantity?: string | null
          service_name?: string | null
          staff_name?: string | null
          unit_price?: number | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
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
          payment_reason?: string | null
          payment_status?: string | null
          quantity?: string | null
          service_name?: string | null
          staff_name?: string | null
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
            foreignKeyName: "documents_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      income_records: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string
          created_by: string
          date: string
          description: string | null
          id: string
          invoice_id: string | null
          payment_method: string
          service: string | null
          source: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string
          service?: string | null
          source?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string
          service?: string | null
          source?: string
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
      invoices: {
        Row: {
          amount: number
          booking_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          created_by: string
          date: string
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          payment_status: string
          service: string
          updated_at: string
        }
        Insert: {
          amount: number
          booking_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          created_by: string
          date?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          payment_status?: string
          service: string
          updated_at?: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          created_by?: string
          date?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_status?: string
          service?: string
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
          client_name: string
          client_phone: string
          created_at: string
          created_by: string
          created_by_name: string
          created_by_role: string
          id: string
          price: number
          quotation_number: string
          service_date: string | null
          service_name: string
        }
        Insert: {
          client_name: string
          client_phone: string
          created_at?: string
          created_by: string
          created_by_name: string
          created_by_role?: string
          id?: string
          price: number
          quotation_number: string
          service_date?: string | null
          service_name: string
        }
        Update: {
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          created_by_role?: string
          id?: string
          price?: number
          quotation_number?: string
          service_date?: string | null
          service_name?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          base_price: number
          category: string
          commission_eligible: boolean
          created_at: string
          description: string | null
          dropdown_options: Json | null
          id: string
          input_type: string
          is_active: boolean
          name: string
          price_per_sqm: number
          pricing_model: string
          pricing_unit: string
          requires_size_input: boolean
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string
          commission_eligible?: boolean
          created_at?: string
          description?: string | null
          dropdown_options?: Json | null
          id?: string
          input_type?: string
          is_active?: boolean
          name: string
          price_per_sqm?: number
          pricing_model?: string
          pricing_unit?: string
          requires_size_input?: boolean
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string
          commission_eligible?: boolean
          created_at?: string
          description?: string | null
          dropdown_options?: Json | null
          id?: string
          input_type?: string
          is_active?: boolean
          name?: string
          price_per_sqm?: number
          pricing_model?: string
          pricing_unit?: string
          requires_size_input?: boolean
          updated_at?: string
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
      [_ in never]: never
    }
    Functions: {
      approve_profile_edit: { Args: { request_id: string }; Returns: undefined }
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
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean }
      next_expense_voucher_number: { Args: never; Returns: string }
      next_fuel_voucher_number: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: string }
      next_quotation_number: { Args: never; Returns: string }
      next_receipt_number: { Args: never; Returns: string }
      next_salary_voucher_number: { Args: never; Returns: string }
    }
    Enums: {
      agent_status: "pending" | "approved" | "suspended"
      app_role: "agent" | "admin" | "super_admin"
      booking_status: "pending" | "confirmed" | "completed" | "cancelled"
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
      agent_status: ["pending", "approved", "suspended"],
      app_role: ["agent", "admin", "super_admin"],
      booking_status: ["pending", "confirmed", "completed", "cancelled"],
      commission_tier: ["bronze", "silver", "gold"],
      ledger_type: ["credit", "debit"],
      notice_priority: ["normal", "important", "urgent"],
      notice_target_role: ["agent", "admin", "all"],
      payout_status: ["pending", "approved", "rejected"],
    },
  },
} as const
