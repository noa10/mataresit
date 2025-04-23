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
      batch_items: {
        Row: {
          batch_id: string
          created_at: string
          error: string | null
          id: string
          original_filename: string | null
          receipt_id: string | null
          status: string
          storage_path: string
          temp_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          error?: string | null
          id?: string
          original_filename?: string | null
          receipt_id?: string | null
          status?: string
          storage_path: string
          temp_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          original_filename?: string | null
          receipt_id?: string | null
          status?: string
          storage_path?: string
          temp_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipt_confidence_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          created_at: string
          failed: number
          id: string
          status: string | null
          succeeded: number
          total_items: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          failed?: number
          id?: string
          status?: string | null
          succeeded?: number
          total_items?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          failed?: number
          id?: string
          status?: string | null
          succeeded?: number
          total_items?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
            referencedRelation: "receipt_confidence_analysis"
            referencedColumns: ["id"]
          },
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
      // expenses table removed as it doesn't exist in the database
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
            referencedRelation: "receipt_confidence_analysis"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "receipt_confidence_analysis"
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
            referencedRelation: "receipt_confidence_analysis"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "receipt_confidence_analysis"
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      // receipt_confidence_scores table removed as it doesn't exist in the database
      receipt_items: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity: number
          receipt_id: string
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity?: number
          receipt_id: string
          total_price: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          receipt_id?: string
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipt_confidence_analysis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
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
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      monthly_expenses: {
        Row: {
          currency: string | null
          month: string | null
          normalized_merchant: string | null
          total_spent: number | null
          transaction_count: number | null
        }
        Relationships: []
      }
      receipt_confidence_analysis: {
        Row: {
          category_confidence: number | null
          confidence_scored_at: string | null
          date: string | null
          date_confidence: number | null
          id: string | null
          merchant: string | null
          merchant_confidence: number | null
          normalized_merchant: string | null
          overall_confidence: number | null
          payment_method: string | null
          payment_method_confidence: number | null
          predicted_category: string | null
          processing_status: string | null
          total: number | null
          total_confidence: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      column_exists: {
        Args: { p_table: string; p_column: string; p_schema?: string }
        Returns: boolean
      }
      get_user_receipt_usage_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          primary_method: string
          receipt_count: number
        }[]
      }
      increment_batch_counter: {
        Args: { batch_uuid: string; field_name: string }
        Returns: undefined
      }
      update_processing_status_if_failed: {
        Args: { receipt_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
