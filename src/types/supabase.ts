export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      corrections: {
        Row: {
          ai_suggestion: string | null
          corrected_value: string
          created_at: string | null
          field_name: string
          id: number
          original_value: string | null
          receipt_id: string | null
        }
        Insert: {
          ai_suggestion?: string | null
          corrected_value: string
          created_at?: string | null
          field_name: string
          id?: number
          original_value?: string | null
          receipt_id?: string | null
        }
        Update: {
          ai_suggestion?: string | null
          corrected_value?: string
          created_at?: string | null
          field_name?: string
          id?: number
          original_value?: string | null
          receipt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "corrections_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      errors: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
        }
        Relationships: []
      }
      line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          receipt_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          receipt_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          receipt_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_receipt"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_logs: {
        Row: {
          batch_item_id: string | null
          created_at: string
          id: string
          receipt_id: string | null
          status_message: string
          step_name: string | null
        }
        Insert: {
          batch_item_id?: string | null
          created_at?: string
          id?: string
          receipt_id?: string | null
          status_message: string
          step_name?: string | null
        }
        Update: {
          batch_item_id?: string | null
          created_at?: string
          id?: string
          receipt_id?: string | null
          status_message?: string
          step_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_receipt"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_logs_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string
          currency: string
          id: string
          status: string
          stripe_payment_intent_id: string
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          currency?: string
          id?: string
          status: string
          stripe_payment_intent_id: string
          stripe_subscription_id?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_updated_at: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          google_avatar_url: string | null
          id: string
          last_name: string | null
          monthly_reset_date: string | null
          receipts_used_this_month: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_status: Database["public"]["Enums"]["subscription_status"] | null
          subscription_tier: Database["public"]["Enums"]["subscription_tier"] | null
          trial_end_date: string | null
          updated_at: string
        }
        Insert: {
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          google_avatar_url?: string | null
          id: string
          last_name?: string | null
          monthly_reset_date?: string | null
          receipts_used_this_month?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"] | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_end_date?: string | null
          updated_at?: string
        }
        Update: {
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          google_avatar_url?: string | null
          id?: string
          last_name?: string | null
          monthly_reset_date?: string | null
          receipts_used_this_month?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?: Database["public"]["Enums"]["subscription_status"] | null
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"] | null
          trial_end_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_limits: {
        Row: {
          batch_upload_limit: number
          created_at: string
          monthly_receipts: number
          retention_days: number
          storage_limit_mb: number
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          batch_upload_limit: number
          created_at?: string
          monthly_receipts: number
          retention_days: number
          storage_limit_mb: number
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          batch_upload_limit?: number
          created_at?: string
          monthly_receipts?: number
          retention_days?: number
          storage_limit_mb?: number
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      receipt_embeddings: {
        Row: {
          content_type: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          receipt_id: string
        }
        Insert: {
          content_type: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          receipt_id: string
        }
        Update: {
          content_type?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_receipt"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_embeddings_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          ai_suggestions: Json | null
          batch_id: string | null
          confidence_scores: Json | null
          created_at: string
          currency: string | null
          currency_converted: boolean | null
          date: string
          discrepancies: Json | null
          document_structure: Json | null
          field_geometry: Json | null
          fullText: string | null
          has_alternative_data: boolean | null
          id: string
          image_url: string | null
          merchant: string
          model_used: string | null
          normalized_merchant: string | null
          payment_method: string | null
          predicted_category: string | null
          primary_method: string | null
          processing_error: string | null
          processing_status: string | null
          processing_time: number | null
          status: string | null
          tax: number | null
          thumbnail_url: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_suggestions?: Json | null
          batch_id?: string | null
          confidence_scores?: Json | null
          created_at?: string
          currency?: string | null
          currency_converted?: boolean | null
          date: string
          discrepancies?: Json | null
          document_structure?: Json | null
          field_geometry?: Json | null
          fullText?: string | null
          has_alternative_data?: boolean | null
          id?: string
          image_url?: string | null
          merchant: string
          model_used?: string | null
          normalized_merchant?: string | null
          payment_method?: string | null
          predicted_category?: string | null
          primary_method?: string | null
          processing_error?: string | null
          processing_status?: string | null
          processing_time?: number | null
          status?: string | null
          tax?: number | null
          thumbnail_url?: string | null
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_suggestions?: Json | null
          batch_id?: string | null
          confidence_scores?: Json | null
          created_at?: string
          currency?: string | null
          currency_converted?: boolean | null
          date?: string
          discrepancies?: Json | null
          document_structure?: Json | null
          field_geometry?: Json | null
          fullText?: string | null
          has_alternative_data?: boolean | null
          id?: string
          image_url?: string | null
          merchant?: string
          model_used?: string | null
          normalized_merchant?: string | null
          payment_method?: string | null
          predicted_category?: string | null
          primary_method?: string | null
          processing_error?: string | null
          processing_status?: string | null
          processing_time?: number | null
          status?: string | null
          tax?: number | null
          thumbnail_url?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      check_pgvector_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      column_exists: {
        Args: { p_table: string; p_column: string; p_schema?: string }
        Returns: boolean
      }
      create_first_admin: {
        Args: { _email: string }
        Returns: boolean
      }
      get_admin_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          email: string
          first_name: string
          last_name: string
          confirmed_at: string
          last_sign_in_at: string
          created_at: string
          roles: Json
        }[]
      }
      get_user_receipt_usage_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          primary_method: string
          receipt_count: number
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id?: string
        }
        Returns: boolean
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { uri: string }
          | { uri: string; content: string; content_type: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { uri: string } | { uri: string; data: Json }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { uri: string; content: string; content_type: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { uri: string; content: string; content_type: string }
          | { uri: string; data: Json }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { uri: string; content: string; content_type: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      hybrid_search_receipts: {
        Args: {
          search_text: string
          query_embedding: string
          content_type?: string
          similarity_weight?: number
          text_weight?: number
          match_count?: number
        }
        Returns: {
          receipt_id: string
          score: number
        }[]
      }
      increment_batch_counter: {
        Args: { batch_uuid: string; field_name: string }
        Returns: undefined
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: string
      }
      search_receipts: {
        Args: {
          query_embedding: string
          similarity_threshold?: number
          match_count?: number
          content_type?: string
        }
        Returns: {
          id: string
          receipt_id: string
          similarity: number
        }[]
      }
      set_user_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      update_processing_status_if_failed: {
        Args: { receipt_id: string }
        Returns: undefined
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
      subscription_status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | "incomplete_expired" | "unpaid"
      subscription_tier: "free" | "pro" | "max"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
