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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      asset_service_history: {
        Row: {
          asset_id: string
          booking_id: string | null
          cleaned_on: string
          created_at: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          asset_id: string
          booking_id?: string | null
          cleaned_on?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string
          booking_id?: string | null
          cleaned_on?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_service_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_service_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          category: string | null
          created_at: string
          id: string
          last_cleaned_at: string | null
          material: string | null
          name: string
          next_recommended_at: string | null
          notes: string | null
          property_id: string
          room: string | null
          size: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          last_cleaned_at?: string | null
          material?: string | null
          name: string
          next_recommended_at?: string | null
          notes?: string | null
          property_id: string
          room?: string | null
          size?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          last_cleaned_at?: string | null
          material?: string | null
          name?: string
          next_recommended_at?: string | null
          notes?: string | null
          property_id?: string
          room?: string | null
          size?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          category: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_published: boolean
          keywords: string | null
          meta_description: string | null
          meta_title: string | null
          publish_date: string
          share_disabled: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          publish_date?: string
          share_disabled?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_published?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          publish_date?: string
          share_disabled?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      booking_drafts: {
        Row: {
          created_at: string
          id: string
          payload: Json
          step: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json
          step?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          step?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          asset_ids: string[] | null
          assigned_staff_id: string | null
          booking_number: string
          client_id: string | null
          created_at: string
          date: string
          discount: number | null
          estimated_duration_minutes: number | null
          id: string
          location: string | null
          notes: string | null
          payment_method: string | null
          property_id: string | null
          service: string
          services: Json | null
          status: string
          subtotal: number | null
          time: string | null
          total: number | null
          tracker_events: Json | null
          tracker_stage: string | null
          transport: number | null
        }
        Insert: {
          asset_ids?: string[] | null
          assigned_staff_id?: string | null
          booking_number: string
          client_id?: string | null
          created_at?: string
          date: string
          discount?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          payment_method?: string | null
          property_id?: string | null
          service: string
          services?: Json | null
          status?: string
          subtotal?: number | null
          time?: string | null
          total?: number | null
          tracker_events?: Json | null
          tracker_stage?: string | null
          transport?: number | null
        }
        Update: {
          asset_ids?: string[] | null
          assigned_staff_id?: string | null
          booking_number?: string
          client_id?: string | null
          created_at?: string
          date?: string
          discount?: number | null
          estimated_duration_minutes?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          payment_method?: string | null
          property_id?: string | null
          service?: string
          services?: Json | null
          status?: string
          subtotal?: number | null
          time?: string | null
          total?: number | null
          tracker_events?: Json | null
          tracker_stage?: string | null
          transport?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          location: string | null
          name: string
          phone: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name: string
          phone: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          areas: string[]
          fee: number
          id: string
          zone_name: string
        }
        Insert: {
          areas?: string[]
          fee?: number
          id?: string
          zone_name: string
        }
        Update: {
          areas?: string[]
          fee?: number
          id?: string
          zone_name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          category: string
          created_at: string
          date: string
          description: string
          id: string
          lpo_id: string | null
          notes: string | null
          receipt_url: string | null
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          lpo_id?: string | null
          notes?: string | null
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          lpo_id?: string | null
          notes?: string | null
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_lpo_id_fkey"
            columns: ["lpo_id"]
            isOneToOne: false
            referencedRelation: "lpos"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          booking_id: string | null
          client_id: string | null
          created_at: string
          id: string
          invoice_number: string
          service: string
          status: string
        }
        Insert: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          invoice_number: string
          service: string
          status?: string
        }
        Update: {
          amount?: number
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          invoice_number?: string
          service?: string
          status?: string
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
      job_assignments: {
        Row: {
          booking_id: string | null
          created_at: string
          id: string
          notes: string | null
          staff_id: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          staff_id?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      lpos: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          items: Json
          lpo_number: string
          notes: string | null
          status: string
          supplier_id: string | null
          total_amount: number
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          lpo_number: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          items?: Json
          lpo_number?: string
          notes?: string | null
          status?: string
          supplier_id?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "lpos_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_location: string
          customer_name: string
          customer_phone: string
          delivery_fee: number
          delivery_zone: string | null
          grand_total: number
          id: string
          items: Json
          order_number: string
          product_total: number
          status: string
        }
        Insert: {
          created_at?: string
          customer_location: string
          customer_name: string
          customer_phone: string
          delivery_fee?: number
          delivery_zone?: string | null
          grand_total?: number
          id?: string
          items?: Json
          order_number: string
          product_total?: number
          status?: string
        }
        Update: {
          created_at?: string
          customer_location?: string
          customer_name?: string
          customer_phone?: string
          delivery_fee?: number
          delivery_zone?: string | null
          grand_total?: number
          id?: string
          items?: Json
          order_number?: string
          product_total?: number
          status?: string
        }
        Relationships: []
      }
      portfolio_posts: {
        Row: {
          after_image_url: string | null
          before_image_url: string | null
          booking_id: string | null
          category: string
          client_id: string | null
          created_at: string
          description: string | null
          featured: boolean
          id: string
          location: string | null
          title: string
        }
        Insert: {
          after_image_url?: string | null
          before_image_url?: string | null
          booking_id?: string | null
          category: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          location?: string | null
          title: string
        }
        Update: {
          after_image_url?: string | null
          before_image_url?: string | null
          booking_id?: string | null
          category?: string
          client_id?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean
          id?: string
          location?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_posts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          additional_images: string[] | null
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          additional_images?: string[] | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          additional_images?: string[] | null
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          county: string | null
          created_at: string
          email: string | null
          favourite_service: string | null
          full_name: string | null
          id: string
          last_booking_at: string | null
          lifetime_spend: number
          loyalty_points: number
          membership_tier: string
          notes: string | null
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          status: string
          total_bookings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          favourite_service?: string | null
          full_name?: string | null
          id?: string
          last_booking_at?: string | null
          lifetime_spend?: number
          loyalty_points?: number
          membership_tier?: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          status?: string
          total_bookings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          favourite_service?: string | null
          full_name?: string | null
          id?: string
          last_booking_at?: string | null
          lifetime_spend?: number
          loyalty_points?: number
          membership_tier?: string
          notes?: string | null
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          status?: string
          total_bookings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string | null
          bedrooms: number | null
          county: string | null
          created_at: string
          estate: string | null
          floors: number | null
          gate_notes: string | null
          id: string
          maps_url: string | null
          name: string
          notes: string | null
          parking_notes: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          bedrooms?: number | null
          county?: string | null
          created_at?: string
          estate?: string | null
          floors?: number | null
          gate_notes?: string | null
          id?: string
          maps_url?: string | null
          name: string
          notes?: string | null
          parking_notes?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          bedrooms?: number | null
          county?: string | null
          created_at?: string
          estate?: string | null
          floors?: number | null
          gate_notes?: string | null
          id?: string
          maps_url?: string | null
          name?: string
          notes?: string | null
          parking_notes?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quotations: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          created_at: string
          id: string
          items: Json
          notes: string | null
          quotation_number: string
          status: string
          total_amount: number
          valid_until: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          quotation_number: string
          status?: string
          total_amount?: number
          valid_until?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          notes?: string | null
          quotation_number?: string
          status?: string
          total_amount?: number
          valid_until?: string | null
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
      rewards: {
        Row: {
          amount: number
          booking_id: string | null
          client_id: string | null
          created_at: string
          id: string
          items: Json
          status: string
          tier: string
        }
        Insert: {
          amount?: number
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          status?: string
          tier: string
        }
        Update: {
          amount?: number
          booking_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          items?: Json
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          keywords: string | null
          meta_description: string | null
          meta_title: string | null
          name: string
          price_max: number | null
          price_type: string
          price_value: number
          slug: string
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name: string
          price_max?: number | null
          price_type?: string
          price_value?: number
          slug: string
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          keywords?: string | null
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          price_max?: number | null
          price_type?: string
          price_value?: number
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          date_joined: string | null
          id: string
          id_number: string | null
          name: string
          notes: string | null
          phone: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          date_joined?: string | null
          id?: string
          id_number?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          date_joined?: string | null
          id?: string
          id_number?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string
          status?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
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
      app_role: ["admin", "customer"],
    },
  },
} as const
