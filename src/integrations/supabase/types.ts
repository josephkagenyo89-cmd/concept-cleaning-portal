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
          client_name: string
          client_phone: string
          commission_created: boolean
          created_at: string
          id: string
          location: string
          price: number
          service_date: string
          service_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          client_name: string
          client_phone: string
          commission_created?: boolean
          created_at?: string
          id?: string
          location: string
          price: number
          service_date: string
          service_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          client_name?: string
          client_phone?: string
          commission_created?: boolean
          created_at?: string
          id?: string
          location?: string
          price?: number
          service_date?: string
          service_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
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
      services: {
        Row: {
          base_price: number
          category: string
          commission_eligible: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          pricing_model: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string
          commission_eligible?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          pricing_model?: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string
          commission_eligible?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          pricing_model?: string
          updated_at?: string
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
