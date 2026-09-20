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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
          id: string
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
          id?: string
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
          id?: string
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
      invoices: {
        Row: {
          amount: number
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
          payment_status: string
          salesperson_id: string | null
          salesperson_name: string | null
          salesperson_role: string | null
          service: string
          subtotal: number | null
          updated_at: string
        }
        Insert: {
          amount: number
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
          payment_status?: string
          salesperson_id?: string | null
          salesperson_name?: string | null
          salesperson_role?: string | null
          service: string
          subtotal?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
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
          payment_status?: string
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
          discount_amount: number
          discount_approval_comment: string | null
          discount_reason: string | null
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
          client_name: string
          client_phone: string
          created_at?: string
          created_by: string
          created_by_name: string
          created_by_role?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
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
          client_name?: string
          client_phone?: string
          created_at?: string
          created_by?: string
          created_by_name?: string
          created_by_role?: string
          discount_amount?: number
          discount_approval_comment?: string | null
          discount_reason?: string | null
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
        Relationships: []
      }
      service_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
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
          mpesa_code: string
          payment_date: string
          services: string | null
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
          mpesa_code: string
          payment_date: string
          services?: string | null
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
          mpesa_code?: string
          payment_date?: string
          services?: string | null
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
        Relationships: []
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
      [_ in never]: never
    }
    Functions: {
      accept_booking_engine_quotation: {
        Args: { _request_id: string }
        Returns: Json
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
      convert_booking_engine_request: {
        Args: { _request_id: string }
        Returns: Json
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
      next_expense_voucher_number: { Args: never; Returns: string }
      next_fuel_voucher_number: { Args: never; Returns: string }
      next_invoice_number: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
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
