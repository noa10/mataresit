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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agent_performance_history: {
        Row: {
          agent_id: string
          agent_type: string
          benchmark_scores: Json | null
          created_at: string | null
          id: string
          optimization_recommendations: Json | null
          performance_snapshot: Json
          user_id: string
        }
        Insert: {
          agent_id: string
          agent_type: string
          benchmark_scores?: Json | null
          created_at?: string | null
          id?: string
          optimization_recommendations?: Json | null
          performance_snapshot: Json
          user_id: string
        }
        Update: {
          agent_id?: string
          agent_type?: string
          benchmark_scores?: Json | null
          created_at?: string | null
          id?: string
          optimization_recommendations?: Json | null
          performance_snapshot?: Json
          user_id?: string
        }
        Relationships: []
      }
      api_access_logs: {
        Row: {
          api_key_id: string | null
          endpoint: string
          error_message: string | null
          id: string
          ip_address: unknown
          method: string
          request_size_bytes: number | null
          response_size_bytes: number | null
          response_time_ms: number | null
          status_code: number
          team_id: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          api_key_id?: string | null
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          method: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          response_time_ms?: number | null
          status_code: number
          team_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          api_key_id?: string | null
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          method?: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          response_time_ms?: number | null
          status_code?: number
          team_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_access_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          scopes: Database["public"]["Enums"]["api_scope"][]
          team_id: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          scopes?: Database["public"]["Enums"]["api_scope"][]
          team_id?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          scopes?: Database["public"]["Enums"]["api_scope"][]
          team_id?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "api_keys_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      api_quota_tracking: {
        Row: {
          api_provider: string
          created_at: string | null
          id: string
          is_rate_limited: boolean | null
          quota_limit: number
          quota_remaining: number | null
          quota_type: string
          quota_used: number | null
          rate_limit_reset_at: string | null
          time_window: string
          updated_at: string | null
        }
        Insert: {
          api_provider: string
          created_at?: string | null
          id?: string
          is_rate_limited?: boolean | null
          quota_limit: number
          quota_remaining?: number | null
          quota_type: string
          quota_used?: number | null
          rate_limit_reset_at?: string | null
          time_window: string
          updated_at?: string | null
        }
        Update: {
          api_provider?: string
          created_at?: string | null
          id?: string
          is_rate_limited?: boolean | null
          quota_limit?: number
          quota_remaining?: number | null
          quota_type?: string
          quota_used?: number | null
          rate_limit_reset_at?: string | null
          time_window?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          api_key_id: string | null
          created_at: string | null
          id: string
          request_count: number
          updated_at: string | null
          user_id: string
          window_end: string
          window_start: string
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          request_count?: number
          updated_at?: string | null
          user_id: string
          window_end: string
          window_start: string
        }
        Update: {
          api_key_id?: string | null
          created_at?: string | null
          id?: string
          request_count?: number
          updated_at?: string | null
          user_id?: string
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_rate_limits_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_upload_files: {
        Row: {
          api_calls_made: number | null
          batch_session_id: string | null
          created_at: string | null
          error_message: string | null
          error_type: string | null
          file_size_bytes: number | null
          file_type: string | null
          id: string
          original_filename: string
          processing_completed_at: string | null
          processing_duration_ms: number | null
          processing_started_at: string | null
          rate_limited: boolean | null
          receipt_id: string | null
          retry_count: number | null
          status: string
          tokens_used: number | null
          updated_at: string | null
          upload_order: number | null
        }
        Insert: {
          api_calls_made?: number | null
          batch_session_id?: string | null
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          original_filename: string
          processing_completed_at?: string | null
          processing_duration_ms?: number | null
          processing_started_at?: string | null
          rate_limited?: boolean | null
          receipt_id?: string | null
          retry_count?: number | null
          status?: string
          tokens_used?: number | null
          updated_at?: string | null
          upload_order?: number | null
        }
        Update: {
          api_calls_made?: number | null
          batch_session_id?: string | null
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          id?: string
          original_filename?: string
          processing_completed_at?: string | null
          processing_duration_ms?: number | null
          processing_started_at?: string | null
          rate_limited?: boolean | null
          receipt_id?: string | null
          retry_count?: number | null
          status?: string
          tokens_used?: number | null
          updated_at?: string | null
          upload_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_upload_files_batch_session_id_fkey"
            columns: ["batch_session_id"]
            isOneToOne: false
            referencedRelation: "batch_upload_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_upload_files_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_upload_sessions: {
        Row: {
          avg_file_processing_time_ms: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          estimated_completion_at: string | null
          files_completed: number | null
          files_failed: number | null
          files_pending: number | null
          id: string
          last_error_at: string | null
          max_concurrent: number | null
          processing_strategy: string | null
          rate_limit_config: Json | null
          rate_limit_hits: number | null
          session_name: string | null
          started_at: string | null
          status: string
          team_id: string | null
          total_api_calls: number | null
          total_files: number
          total_processing_time_ms: number | null
          total_tokens_used: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_file_processing_time_ms?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_completion_at?: string | null
          files_completed?: number | null
          files_failed?: number | null
          files_pending?: number | null
          id?: string
          last_error_at?: string | null
          max_concurrent?: number | null
          processing_strategy?: string | null
          rate_limit_config?: Json | null
          rate_limit_hits?: number | null
          session_name?: string | null
          started_at?: string | null
          status?: string
          team_id?: string | null
          total_api_calls?: number | null
          total_files: number
          total_processing_time_ms?: number | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_file_processing_time_ms?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_completion_at?: string | null
          files_completed?: number | null
          files_failed?: number | null
          files_pending?: number | null
          id?: string
          last_error_at?: string | null
          max_concurrent?: number | null
          processing_strategy?: string | null
          rate_limit_config?: Json | null
          rate_limit_hits?: number | null
          session_name?: string | null
          started_at?: string | null
          status?: string
          team_id?: string | null
          total_api_calls?: number | null
          total_files?: number
          total_processing_time_ms?: number | null
          total_tokens_used?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_upload_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "batch_upload_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_audit_trail: {
        Row: {
          created_at: string | null
          event_description: string | null
          event_type: string
          id: string
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          stripe_event_id: string | null
          stripe_payment_intent_id: string | null
          stripe_subscription_id: string | null
          triggered_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          triggered_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          stripe_event_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_subscription_id?: string | null
          triggered_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_email_schedule: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          delivery_attempts: number | null
          error_message: string | null
          id: string
          language: string | null
          last_retry_at: string | null
          max_delivery_attempts: number | null
          next_retry_at: string | null
          priority: string | null
          reminder_type: string
          retry_count: number | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
          subscription_id: string | null
          template_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_attempts?: number | null
          error_message?: string | null
          id?: string
          language?: string | null
          last_retry_at?: string | null
          max_delivery_attempts?: number | null
          next_retry_at?: string | null
          priority?: string | null
          reminder_type: string
          retry_count?: number | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          subscription_id?: string | null
          template_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_attempts?: number | null
          error_message?: string | null
          id?: string
          language?: string | null
          last_retry_at?: string | null
          max_delivery_attempts?: number | null
          next_retry_at?: string | null
          priority?: string | null
          reminder_type?: string
          retry_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          subscription_id?: string | null
          template_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      billing_health_monitoring: {
        Row: {
          check_type: string
          checked_at: string | null
          details: Json | null
          id: string
          resolved_at: string | null
          severity: string | null
          status: string
        }
        Insert: {
          check_type: string
          checked_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          severity?: string | null
          status: string
        }
        Update: {
          check_type?: string
          checked_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          severity?: string | null
          status?: string
        }
        Relationships: []
      }
      billing_preferences: {
        Row: {
          auto_renewal_enabled: boolean | null
          auto_renewal_frequency: string | null
          billing_email_enabled: boolean | null
          created_at: string | null
          email_notifications_enabled: boolean | null
          grace_period_days: number | null
          grace_period_notifications: boolean | null
          id: string
          max_payment_retry_attempts: number | null
          payment_failure_notifications: boolean | null
          preferred_language: string | null
          push_notifications_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminder_days_before_renewal: number[] | null
          retry_interval_hours: number | null
          sms_notifications_enabled: boolean | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renewal_enabled?: boolean | null
          auto_renewal_frequency?: string | null
          billing_email_enabled?: boolean | null
          created_at?: string | null
          email_notifications_enabled?: boolean | null
          grace_period_days?: number | null
          grace_period_notifications?: boolean | null
          id?: string
          max_payment_retry_attempts?: number | null
          payment_failure_notifications?: boolean | null
          preferred_language?: string | null
          push_notifications_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminder_days_before_renewal?: number[] | null
          retry_interval_hours?: number | null
          sms_notifications_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renewal_enabled?: boolean | null
          auto_renewal_frequency?: string | null
          billing_email_enabled?: boolean | null
          created_at?: string | null
          email_notifications_enabled?: boolean | null
          grace_period_days?: number | null
          grace_period_notifications?: boolean | null
          id?: string
          max_payment_retry_attempts?: number | null
          payment_failure_notifications?: boolean | null
          preferred_language?: string | null
          push_notifications_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reminder_days_before_renewal?: number[] | null
          retry_interval_hours?: number | null
          sms_notifications_enabled?: boolean | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_contexts: {
        Row: {
          context_data: Json
          conversation_id: string
          conversation_length: number | null
          created_at: string | null
          id: string
          last_keywords: Json | null
          last_results: Json | null
          search_history: Json | null
          session_start_time: string | null
          updated_at: string | null
          user_id: string
          user_preferences: Json | null
        }
        Insert: {
          context_data?: Json
          conversation_id: string
          conversation_length?: number | null
          created_at?: string | null
          id?: string
          last_keywords?: Json | null
          last_results?: Json | null
          search_history?: Json | null
          session_start_time?: string | null
          updated_at?: string | null
          user_id: string
          user_preferences?: Json | null
        }
        Update: {
          context_data?: Json
          conversation_id?: string
          conversation_length?: number | null
          created_at?: string | null
          id?: string
          last_keywords?: Json | null
          last_results?: Json | null
          search_history?: Json | null
          session_start_time?: string | null
          updated_at?: string | null
          user_id?: string
          user_preferences?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_contexts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          enhancement_data: Json | null
          id: string
          intent_data: Json | null
          is_deleted: boolean | null
          keywords_data: Json | null
          message_type: string | null
          metadata: Json | null
          role: string
          search_results: Json | null
          updated_at: string | null
          user_id: string
          validation_data: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          enhancement_data?: Json | null
          id?: string
          intent_data?: Json | null
          is_deleted?: boolean | null
          keywords_data?: Json | null
          message_type?: string | null
          metadata?: Json | null
          role: string
          search_results?: Json | null
          updated_at?: string | null
          user_id: string
          validation_data?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          enhancement_data?: Json | null
          id?: string
          intent_data?: Json | null
          is_deleted?: boolean | null
          keywords_data?: Json | null
          message_type?: string | null
          metadata?: Json | null
          role?: string
          search_results?: Json | null
          updated_at?: string | null
          user_id?: string
          validation_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_audit_trail: {
        Row: {
          action: string
          claim_id: string
          comment: string | null
          created_at: string
          id: string
          metadata: Json
          new_status: Database["public"]["Enums"]["claim_status"] | null
          old_status: Database["public"]["Enums"]["claim_status"] | null
          user_id: string
        }
        Insert: {
          action: string
          claim_id: string
          comment?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["claim_status"] | null
          old_status?: Database["public"]["Enums"]["claim_status"] | null
          user_id: string
        }
        Update: {
          action?: string
          claim_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          new_status?: Database["public"]["Enums"]["claim_status"] | null
          old_status?: Database["public"]["Enums"]["claim_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_audit_trail_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          attachments: Json
          category: string | null
          claimant_id: string
          created_at: string
          currency: string
          description: string | null
          description_ms: string | null
          id: string
          metadata: Json
          priority: Database["public"]["Enums"]["claim_priority"]
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
          team_id: string
          title: string
          title_ms: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          category?: string | null
          claimant_id: string
          created_at?: string
          currency?: string
          description?: string | null
          description_ms?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["claim_priority"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          team_id: string
          title: string
          title_ms?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          attachments?: Json
          category?: string | null
          claimant_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          description_ms?: string | null
          id?: string
          metadata?: Json
          priority?: Database["public"]["Enums"]["claim_priority"]
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          team_id?: string
          title?: string
          title_ms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "claims_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_analytics: {
        Row: {
          conversation_id: string
          created_at: string | null
          enhancement_stats: Json | null
          id: string
          message_count: number | null
          performance_metrics: Json | null
          search_count: number | null
          session_duration_seconds: number | null
          top_search_terms: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          enhancement_stats?: Json | null
          id?: string
          message_count?: number | null
          performance_metrics?: Json | null
          search_count?: number | null
          session_duration_seconds?: number | null
          top_search_terms?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          enhancement_stats?: Json | null
          id?: string
          message_count?: number | null
          performance_metrics?: Json | null
          search_count?: number | null
          session_duration_seconds?: number | null
          top_search_terms?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_analytics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_context: {
        Row: {
          context_data: Json
          context_tokens: number | null
          context_type: string
          conversation_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          last_updated: string | null
          relevance_score: number | null
          user_id: string
        }
        Insert: {
          context_data?: Json
          context_tokens?: number | null
          context_type: string
          conversation_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_updated?: string | null
          relevance_score?: number | null
          user_id: string
        }
        Update: {
          context_data?: Json
          context_tokens?: number | null
          context_type?: string
          conversation_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_updated?: string | null
          relevance_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      conversation_contexts: {
        Row: {
          context_data: Json
          context_type: string
          conversation_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          relevance_score: number | null
          user_id: string | null
        }
        Insert: {
          context_data: Json
          context_type: string
          conversation_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          relevance_score?: number | null
          user_id?: string | null
        }
        Update: {
          context_data?: Json
          context_type?: string
          conversation_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          relevance_score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_memory: {
        Row: {
          access_count: number | null
          confidence_score: number | null
          created_at: string | null
          id: string
          last_accessed: string | null
          memory_data: Json
          memory_key: string
          memory_type: string
          source_conversations: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_count?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_accessed?: string | null
          memory_data: Json
          memory_key: string
          memory_type: string
          source_conversations?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_count?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_accessed?: string | null
          memory_data?: Json
          memory_key?: string
          memory_type?: string
          source_conversations?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          message_id: string
          message_type: string
          metadata: Json | null
          parent_message_id: string | null
          user_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          message_id: string
          message_type: string
          metadata?: Json | null
          parent_message_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          message_id?: string
          message_type?: string
          metadata?: Json | null
          parent_message_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          last_activity_at: string | null
          metadata: Json | null
          session_type: string | null
          status: string | null
          team_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          session_type?: string | null
          status?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string | null
          metadata?: Json | null
          session_type?: string | null
          status?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "conversation_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          is_archived: boolean | null
          is_favorite: boolean | null
          last_message_at: string | null
          message_count: number | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          last_message_at?: string | null
          message_count?: number | null
          title?: string
          updated_at?: string | null
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
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_exchange_rates: {
        Row: {
          base_currency: string
          created_at: string | null
          exchange_rate: number
          id: string
          is_active: boolean | null
          rate_date: string
          source: string | null
          target_currency: string
          updated_at: string | null
        }
        Insert: {
          base_currency: string
          created_at?: string | null
          exchange_rate: number
          id?: string
          is_active?: boolean | null
          rate_date: string
          source?: string | null
          target_currency: string
          updated_at?: string | null
        }
        Update: {
          base_currency?: string
          created_at?: string | null
          exchange_rate?: number
          id?: string
          is_active?: boolean | null
          rate_date?: string
          source?: string | null
          target_currency?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_categories: {
        Row: {
          archived: boolean
          color: string
          created_at: string
          icon: string | null
          id: string
          name: string
          name_ms: string | null
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          name_ms?: string | null
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          color?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          name_ms?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "custom_categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          max_retries: number
          metadata: Json
          next_retry_at: string | null
          provider_message_id: string | null
          recipient_email: string
          related_entity_id: string | null
          related_entity_type: string | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["email_delivery_status"]
          subject: string
          team_id: string | null
          template_name: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          next_retry_at?: string | null
          provider_message_id?: string | null
          recipient_email: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject: string
          team_id?: string | null
          template_name?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          max_retries?: number
          metadata?: Json
          next_retry_at?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_delivery_status"]
          subject?: string
          team_id?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "email_deliveries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_tracking: {
        Row: {
          bounced_at: string | null
          clicked_at: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          provider: string | null
          provider_message_id: string | null
          recipient_email: string
          related_entity_id: string | null
          related_entity_type: string | null
          sent_at: string | null
          status: string | null
          subject: string
          team_id: string | null
          template_name: string | null
          updated_at: string | null
        }
        Insert: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_email: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          team_id?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Update: {
          bounced_at?: string | null
          clicked_at?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient_email?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          team_id?: string | null
          template_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      embedding_daily_stats: {
        Row: {
          avg_content_types_per_receipt: number | null
          avg_duration_ms: number | null
          created_at: string | null
          date_bucket: string
          estimated_cost_usd: number | null
          failed_attempts: number | null
          id: string
          p95_duration_ms: number | null
          p99_duration_ms: number | null
          success_rate: number | null
          successful_attempts: number | null
          synthetic_content_percentage: number | null
          team_id: string | null
          total_api_calls: number | null
          total_attempts: number | null
          total_tokens_used: number | null
        }
        Insert: {
          avg_content_types_per_receipt?: number | null
          avg_duration_ms?: number | null
          created_at?: string | null
          date_bucket: string
          estimated_cost_usd?: number | null
          failed_attempts?: number | null
          id?: string
          p95_duration_ms?: number | null
          p99_duration_ms?: number | null
          success_rate?: number | null
          successful_attempts?: number | null
          synthetic_content_percentage?: number | null
          team_id?: string | null
          total_api_calls?: number | null
          total_attempts?: number | null
          total_tokens_used?: number | null
        }
        Update: {
          avg_content_types_per_receipt?: number | null
          avg_duration_ms?: number | null
          created_at?: string | null
          date_bucket?: string
          estimated_cost_usd?: number | null
          failed_attempts?: number | null
          id?: string
          p95_duration_ms?: number | null
          p99_duration_ms?: number | null
          success_rate?: number | null
          successful_attempts?: number | null
          synthetic_content_percentage?: number | null
          team_id?: string | null
          total_api_calls?: number | null
          total_attempts?: number | null
          total_tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_daily_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "embedding_daily_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_hourly_stats: {
        Row: {
          api_limit_errors: number | null
          avg_duration_ms: number | null
          batch_upload_attempts: number | null
          batch_upload_success: number | null
          created_at: string | null
          failed_attempts: number | null
          hour_bucket: string
          id: string
          network_errors: number | null
          p95_duration_ms: number | null
          rate_limited_count: number | null
          single_upload_attempts: number | null
          single_upload_success: number | null
          successful_attempts: number | null
          team_id: string | null
          timeout_attempts: number | null
          timeout_errors: number | null
          total_api_calls: number | null
          total_attempts: number | null
          total_tokens_used: number | null
          unknown_errors: number | null
          validation_errors: number | null
        }
        Insert: {
          api_limit_errors?: number | null
          avg_duration_ms?: number | null
          batch_upload_attempts?: number | null
          batch_upload_success?: number | null
          created_at?: string | null
          failed_attempts?: number | null
          hour_bucket: string
          id?: string
          network_errors?: number | null
          p95_duration_ms?: number | null
          rate_limited_count?: number | null
          single_upload_attempts?: number | null
          single_upload_success?: number | null
          successful_attempts?: number | null
          team_id?: string | null
          timeout_attempts?: number | null
          timeout_errors?: number | null
          total_api_calls?: number | null
          total_attempts?: number | null
          total_tokens_used?: number | null
          unknown_errors?: number | null
          validation_errors?: number | null
        }
        Update: {
          api_limit_errors?: number | null
          avg_duration_ms?: number | null
          batch_upload_attempts?: number | null
          batch_upload_success?: number | null
          created_at?: string | null
          failed_attempts?: number | null
          hour_bucket?: string
          id?: string
          network_errors?: number | null
          p95_duration_ms?: number | null
          rate_limited_count?: number | null
          single_upload_attempts?: number | null
          single_upload_success?: number | null
          successful_attempts?: number | null
          team_id?: string | null
          timeout_attempts?: number | null
          timeout_errors?: number | null
          total_api_calls?: number | null
          total_attempts?: number | null
          total_tokens_used?: number | null
          unknown_errors?: number | null
          validation_errors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_hourly_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "embedding_hourly_stats_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_performance_metrics: {
        Row: {
          api_calls_made: number | null
          api_rate_limited: boolean | null
          api_tokens_used: number | null
          content_length: number | null
          content_types_processed: string[] | null
          created_at: string | null
          embedding_dimensions: number | null
          embedding_end_time: string | null
          embedding_start_time: string
          error_message: string | null
          error_type: string | null
          failed_content_types: number | null
          id: string
          model_used: string
          receipt_id: string | null
          retry_count: number | null
          status: string
          successful_content_types: number | null
          synthetic_content_used: boolean | null
          team_id: string | null
          total_content_types: number | null
          total_duration_ms: number | null
          updated_at: string | null
          upload_context: string
          user_id: string | null
        }
        Insert: {
          api_calls_made?: number | null
          api_rate_limited?: boolean | null
          api_tokens_used?: number | null
          content_length?: number | null
          content_types_processed?: string[] | null
          created_at?: string | null
          embedding_dimensions?: number | null
          embedding_end_time?: string | null
          embedding_start_time: string
          error_message?: string | null
          error_type?: string | null
          failed_content_types?: number | null
          id?: string
          model_used: string
          receipt_id?: string | null
          retry_count?: number | null
          status: string
          successful_content_types?: number | null
          synthetic_content_used?: boolean | null
          team_id?: string | null
          total_content_types?: number | null
          total_duration_ms?: number | null
          updated_at?: string | null
          upload_context: string
          user_id?: string | null
        }
        Update: {
          api_calls_made?: number | null
          api_rate_limited?: boolean | null
          api_tokens_used?: number | null
          content_length?: number | null
          content_types_processed?: string[] | null
          created_at?: string | null
          embedding_dimensions?: number | null
          embedding_end_time?: string | null
          embedding_start_time?: string
          error_message?: string | null
          error_type?: string | null
          failed_content_types?: number | null
          id?: string
          model_used?: string
          receipt_id?: string | null
          retry_count?: number | null
          status?: string
          successful_content_types?: number | null
          synthetic_content_used?: boolean | null
          team_id?: string | null
          total_content_types?: number | null
          total_duration_ms?: number | null
          updated_at?: string | null
          upload_context?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_performance_metrics_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embedding_performance_metrics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "embedding_performance_metrics_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_quality_metrics: {
        Row: {
          content_quality_scores: Json | null
          created_at: string | null
          failed_embeddings: number
          id: string
          overall_quality_score: number
          processing_method: string
          receipt_id: string
          successful_embeddings: number
          synthetic_content_used: boolean
          total_content_types: number
          updated_at: string | null
        }
        Insert: {
          content_quality_scores?: Json | null
          created_at?: string | null
          failed_embeddings?: number
          id?: string
          overall_quality_score?: number
          processing_method: string
          receipt_id: string
          successful_embeddings?: number
          synthetic_content_used?: boolean
          total_content_types?: number
          updated_at?: string | null
        }
        Update: {
          content_quality_scores?: Json | null
          created_at?: string | null
          failed_embeddings?: number
          id?: string
          overall_quality_score?: number
          processing_method?: string
          receipt_id?: string
          successful_embeddings?: number
          synthetic_content_used?: boolean
          total_content_types?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embedding_quality_metrics_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      embedding_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          metadata: Json | null
          operation: string
          priority: string
          processed_at: string | null
          retry_count: number | null
          source_id: string
          source_type: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          operation: string
          priority?: string
          processed_at?: string | null
          retry_count?: number | null
          source_id: string
          source_type: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          operation?: string
          priority?: string
          processed_at?: string | null
          retry_count?: number | null
          source_id?: string
          source_type?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
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
      eta_calculations: {
        Row: {
          accuracy_score: number | null
          actual_completion: string | null
          calculation_factors: Json | null
          confidence_score: number | null
          created_at: string | null
          estimated_completion: string | null
          id: string
          metadata: Json | null
          method_used: string | null
          user_id: string
          workflow_id: string
        }
        Insert: {
          accuracy_score?: number | null
          actual_completion?: string | null
          calculation_factors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          estimated_completion?: string | null
          id?: string
          metadata?: Json | null
          method_used?: string | null
          user_id: string
          workflow_id: string
        }
        Update: {
          accuracy_score?: number | null
          actual_completion?: string | null
          calculation_factors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          estimated_completion?: string | null
          id?: string
          metadata?: Json | null
          method_used?: string | null
          user_id?: string
          workflow_id?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          content: Json
          created_at: string
          email_sent: boolean
          file_url: string | null
          generated_at: string
          id: string
          recipients: string[]
          report_type: string
          sent_at: string | null
          summary: Json
          team_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          email_sent?: boolean
          file_url?: string | null
          generated_at?: string
          id?: string
          recipients?: string[]
          report_type: string
          sent_at?: string | null
          summary?: Json
          team_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          email_sent?: boolean
          file_url?: string | null
          generated_at?: string
          id?: string
          recipients?: string[]
          report_type?: string
          sent_at?: string | null
          summary?: Json
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "generated_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_states: {
        Row: {
          authenticated_at: string | null
          authentication_method: string | null
          browser_fingerprint: string | null
          created_at: string | null
          expires_at: string
          id: string
          invitation_id: string
          invitation_token: string
          ip_address: unknown
          redirect_after_auth: string | null
          session_data: Json | null
          state: string | null
          target_email: string
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
          user_type: string
        }
        Insert: {
          authenticated_at?: string | null
          authentication_method?: string | null
          browser_fingerprint?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          invitation_id: string
          invitation_token: string
          ip_address?: unknown
          redirect_after_auth?: string | null
          session_data?: Json | null
          state?: string | null
          target_email: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_type: string
        }
        Update: {
          authenticated_at?: string | null
          authentication_method?: string | null
          browser_fingerprint?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          invitation_id?: string
          invitation_token?: string
          ip_address?: unknown
          redirect_after_auth?: string | null
          session_data?: Json | null
          state?: string | null
          target_email?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_type?: string
        }
        Relationships: []
      }
      line_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          embedding: string | null
          id: string
          receipt_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          embedding?: string | null
          id?: string
          receipt_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          embedding?: string | null
          id?: string
          receipt_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      load_balancing_insights: {
        Row: {
          affected_agents: string[] | null
          created_at: string | null
          id: string
          insight_type: string
          message: string
          metadata: Json | null
          priority: string
          resolved: boolean | null
          resolved_at: string | null
          user_id: string
        }
        Insert: {
          affected_agents?: string[] | null
          created_at?: string | null
          id?: string
          insight_type: string
          message: string
          metadata?: Json | null
          priority: string
          resolved?: boolean | null
          resolved_at?: string | null
          user_id: string
        }
        Update: {
          affected_agents?: string[] | null
          created_at?: string | null
          id?: string
          insight_type?: string
          message?: string
          metadata?: Json | null
          priority?: string
          resolved?: boolean | null
          resolved_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      malaysian_address_formats: {
        Row: {
          common_cities: string[] | null
          created_at: string | null
          id: string
          postcode_pattern: string
          state_code: string
          state_name: string
          timezone: string | null
        }
        Insert: {
          common_cities?: string[] | null
          created_at?: string | null
          id?: string
          postcode_pattern: string
          state_code: string
          state_name: string
          timezone?: string | null
        }
        Update: {
          common_cities?: string[] | null
          created_at?: string | null
          id?: string
          postcode_pattern?: string
          state_code?: string
          state_name?: string
          timezone?: string | null
        }
        Relationships: []
      }
      malaysian_business_categories: {
        Row: {
          business_keywords: string[] | null
          business_type: string
          confidence_weight: number | null
          created_at: string | null
          id: string
          tax_category_id: string | null
          updated_at: string | null
        }
        Insert: {
          business_keywords?: string[] | null
          business_type: string
          confidence_weight?: number | null
          created_at?: string | null
          id?: string
          tax_category_id?: string | null
          updated_at?: string | null
        }
        Update: {
          business_keywords?: string[] | null
          business_type?: string
          confidence_weight?: number | null
          created_at?: string | null
          id?: string
          tax_category_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "malaysian_business_categories_tax_category_id_fkey"
            columns: ["tax_category_id"]
            isOneToOne: false
            referencedRelation: "malaysian_tax_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      malaysian_business_directory: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_name: string
          business_name_malay: string | null
          business_type: string
          city: string | null
          confidence_score: number | null
          created_at: string | null
          id: string
          industry_category: string | null
          is_active: boolean | null
          is_chain: boolean | null
          keywords: string[] | null
          parent_company: string | null
          phone: string | null
          postcode: string | null
          registration_number: string | null
          registration_type: string | null
          state: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_name: string
          business_name_malay?: string | null
          business_type: string
          city?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          industry_category?: string | null
          is_active?: boolean | null
          is_chain?: boolean | null
          keywords?: string[] | null
          parent_company?: string | null
          phone?: string | null
          postcode?: string | null
          registration_number?: string | null
          registration_type?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_name?: string
          business_name_malay?: string | null
          business_type?: string
          city?: string | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          industry_category?: string | null
          is_active?: boolean | null
          is_chain?: boolean | null
          keywords?: string[] | null
          parent_company?: string | null
          phone?: string | null
          postcode?: string | null
          registration_number?: string | null
          registration_type?: string | null
          state?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      malaysian_business_hours: {
        Row: {
          business_type: string
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          notes: string | null
          open_time: string | null
        }
        Insert: {
          business_type: string
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          notes?: string | null
          open_time?: string | null
        }
        Update: {
          business_type?: string
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          notes?: string | null
          open_time?: string | null
        }
        Relationships: []
      }
      malaysian_cultural_preferences: {
        Row: {
          created_at: string | null
          default_value: string
          description: string | null
          id: string
          is_active: boolean | null
          possible_values: string[] | null
          preference_category: string
          preference_name: string
        }
        Insert: {
          created_at?: string | null
          default_value: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          possible_values?: string[] | null
          preference_category: string
          preference_name: string
        }
        Update: {
          created_at?: string | null
          default_value?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          possible_values?: string[] | null
          preference_category?: string
          preference_name?: string
        }
        Relationships: []
      }
      malaysian_currency_rates: {
        Row: {
          created_at: string | null
          exchange_rate: number
          from_currency: string
          id: string
          is_active: boolean | null
          rate_date: string
          source: string | null
          to_currency: string
        }
        Insert: {
          created_at?: string | null
          exchange_rate: number
          from_currency: string
          id?: string
          is_active?: boolean | null
          rate_date?: string
          source?: string | null
          to_currency: string
        }
        Update: {
          created_at?: string | null
          exchange_rate?: number
          from_currency?: string
          id?: string
          is_active?: boolean | null
          rate_date?: string
          source?: string | null
          to_currency?: string
        }
        Relationships: []
      }
      malaysian_payment_methods: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          max_amount: number | null
          method_name: string
          method_type: string
          min_amount: number | null
          processing_fee_percentage: number | null
          provider: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          max_amount?: number | null
          method_name: string
          method_type: string
          min_amount?: number | null
          processing_fee_percentage?: number | null
          provider?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          max_amount?: number | null
          method_name?: string
          method_type?: string
          min_amount?: number | null
          processing_fee_percentage?: number | null
          provider?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      malaysian_public_holidays: {
        Row: {
          applicable_states: string[] | null
          created_at: string | null
          description: string | null
          holiday_date: string
          holiday_name: string
          holiday_name_malay: string | null
          holiday_type: string
          id: string
          is_active: boolean | null
          is_recurring: boolean | null
          recurring_pattern: string | null
          updated_at: string | null
        }
        Insert: {
          applicable_states?: string[] | null
          created_at?: string | null
          description?: string | null
          holiday_date: string
          holiday_name: string
          holiday_name_malay?: string | null
          holiday_type: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          recurring_pattern?: string | null
          updated_at?: string | null
        }
        Update: {
          applicable_states?: string[] | null
          created_at?: string | null
          description?: string | null
          holiday_date?: string
          holiday_name?: string
          holiday_name_malay?: string | null
          holiday_type?: string
          id?: string
          is_active?: boolean | null
          is_recurring?: boolean | null
          recurring_pattern?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      malaysian_receipt_formats: {
        Row: {
          amount_patterns: string[] | null
          business_type: string
          confidence_weight: number | null
          created_at: string | null
          currency_patterns: string[] | null
          date_patterns: string[] | null
          format_name: string
          id: string
          is_active: boolean | null
          payment_patterns: string[] | null
          tax_patterns: string[] | null
        }
        Insert: {
          amount_patterns?: string[] | null
          business_type: string
          confidence_weight?: number | null
          created_at?: string | null
          currency_patterns?: string[] | null
          date_patterns?: string[] | null
          format_name: string
          id?: string
          is_active?: boolean | null
          payment_patterns?: string[] | null
          tax_patterns?: string[] | null
        }
        Update: {
          amount_patterns?: string[] | null
          business_type?: string
          confidence_weight?: number | null
          created_at?: string | null
          currency_patterns?: string[] | null
          date_patterns?: string[] | null
          format_name?: string
          id?: string
          is_active?: boolean | null
          payment_patterns?: string[] | null
          tax_patterns?: string[] | null
        }
        Relationships: []
      }
      malaysian_tax_categories: {
        Row: {
          category_code: string | null
          category_name: string
          created_at: string | null
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          tax_rate: number
          tax_type: string
          updated_at: string | null
        }
        Insert: {
          category_code?: string | null
          category_name: string
          created_at?: string | null
          description?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          tax_rate: number
          tax_type: string
          updated_at?: string | null
        }
        Update: {
          category_code?: string | null
          category_name?: string
          created_at?: string | null
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          tax_rate?: number
          tax_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          feedback_comment: string | null
          feedback_type: string
          id: string
          message_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          feedback_comment?: string | null
          feedback_type: string
          id?: string
          message_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          feedback_comment?: string | null
          feedback_type?: string
          id?: string
          message_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_audit_log: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          notification_type:
            | Database["public"]["Enums"]["notification_type"]
            | null
          team_id: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          notification_type?:
            | Database["public"]["Enums"]["notification_type"]
            | null
          team_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          notification_type?:
            | Database["public"]["Enums"]["notification_type"]
            | null
          team_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "notification_audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          browser_permission_granted: boolean | null
          browser_permission_requested_at: string | null
          created_at: string | null
          daily_digest_enabled: boolean | null
          digest_time: string | null
          email_billing_updates: boolean | null
          email_enabled: boolean | null
          email_receipt_batch_completed: boolean | null
          email_receipt_processing_completed: boolean | null
          email_receipt_processing_failed: boolean | null
          email_receipt_ready_for_review: boolean | null
          email_security_alerts: boolean | null
          email_team_activity: boolean | null
          email_team_invitations: boolean | null
          email_team_member_removed: boolean | null
          email_weekly_reports: boolean | null
          id: string
          push_enabled: boolean | null
          push_receipt_batch_completed: boolean | null
          push_receipt_comments: boolean | null
          push_receipt_processing_completed: boolean | null
          push_receipt_processing_failed: boolean | null
          push_receipt_ready_for_review: boolean | null
          push_receipt_shared: boolean | null
          push_team_activity: boolean | null
          push_team_invitations: boolean | null
          push_team_member_removed: boolean | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          weekly_digest_enabled: boolean | null
        }
        Insert: {
          browser_permission_granted?: boolean | null
          browser_permission_requested_at?: string | null
          created_at?: string | null
          daily_digest_enabled?: boolean | null
          digest_time?: string | null
          email_billing_updates?: boolean | null
          email_enabled?: boolean | null
          email_receipt_batch_completed?: boolean | null
          email_receipt_processing_completed?: boolean | null
          email_receipt_processing_failed?: boolean | null
          email_receipt_ready_for_review?: boolean | null
          email_security_alerts?: boolean | null
          email_team_activity?: boolean | null
          email_team_invitations?: boolean | null
          email_team_member_removed?: boolean | null
          email_weekly_reports?: boolean | null
          id?: string
          push_enabled?: boolean | null
          push_receipt_batch_completed?: boolean | null
          push_receipt_comments?: boolean | null
          push_receipt_processing_completed?: boolean | null
          push_receipt_processing_failed?: boolean | null
          push_receipt_ready_for_review?: boolean | null
          push_receipt_shared?: boolean | null
          push_team_activity?: boolean | null
          push_team_invitations?: boolean | null
          push_team_member_removed?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          weekly_digest_enabled?: boolean | null
        }
        Update: {
          browser_permission_granted?: boolean | null
          browser_permission_requested_at?: string | null
          created_at?: string | null
          daily_digest_enabled?: boolean | null
          digest_time?: string | null
          email_billing_updates?: boolean | null
          email_enabled?: boolean | null
          email_receipt_batch_completed?: boolean | null
          email_receipt_processing_completed?: boolean | null
          email_receipt_processing_failed?: boolean | null
          email_receipt_ready_for_review?: boolean | null
          email_security_alerts?: boolean | null
          email_team_activity?: boolean | null
          email_team_invitations?: boolean | null
          email_team_member_removed?: boolean | null
          email_weekly_reports?: boolean | null
          id?: string
          push_enabled?: boolean | null
          push_receipt_batch_completed?: boolean | null
          push_receipt_comments?: boolean | null
          push_receipt_processing_completed?: boolean | null
          push_receipt_processing_failed?: boolean | null
          push_receipt_ready_for_review?: boolean | null
          push_receipt_shared?: boolean | null
          push_team_activity?: boolean | null
          push_team_invitations?: boolean | null
          push_team_member_removed?: boolean | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          weekly_digest_enabled?: boolean | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          archived_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          message: string
          message_ms: string | null
          metadata: Json
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          recipient_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          team_id: string | null
          title: string
          title_ms: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message: string
          message_ms?: string | null
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          team_id?: string | null
          title: string
          title_ms?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          action_url?: string | null
          archived_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string
          message_ms?: string | null
          metadata?: Json
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          recipient_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          team_id?: string | null
          title?: string
          title_ms?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_by: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          name: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          name: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          name?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_by_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "paid_by_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount: number
          billing_period_end: string | null
          billing_period_start: string | null
          created_at: string | null
          currency: string
          id: string
          status: string
          stripe_payment_intent_id: string
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          status: string
          stripe_payment_intent_id: string
          stripe_subscription_id?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          billing_period_end?: string | null
          billing_period_start?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_retry_tracking: {
        Row: {
          attempt_number: number | null
          created_at: string | null
          id: string
          last_error_message: string | null
          max_attempts: number | null
          next_retry_at: string | null
          status: string | null
          stripe_invoice_id: string | null
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attempt_number?: number | null
          created_at?: string | null
          id?: string
          last_error_message?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attempt_number?: number | null
          created_at?: string | null
          id?: string
          last_error_message?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          status?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      performance_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          affected_resources: Json | null
          alert_type: string
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          source_component: string | null
          title: string
          user_id: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          affected_resources?: Json | null
          alert_type: string
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity: string
          source_component?: string | null
          title: string
          user_id: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          affected_resources?: Json | null
          alert_type?: string
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          source_component?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_cache: {
        Row: {
          cache_key: string
          cache_value: Json
          created_at: string | null
          expires_at: string
          id: string
          updated_at: string | null
        }
        Insert: {
          cache_key: string
          cache_value: Json
          created_at?: string | null
          expires_at: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          cache_key?: string
          cache_value?: Json
          created_at?: string | null
          expires_at?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          metric_name: string
          metric_type: string
          metric_unit: string
          metric_value: number
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          metric_name: string
          metric_type: string
          metric_unit: string
          metric_value: number
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          metric_name?: string
          metric_type?: string
          metric_unit?: string
          metric_value?: number
          user_id?: string | null
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          avatar_updated_at: string | null
          avatar_url: string | null
          created_at: string
          cultural_context: string | null
          date_format_preference: string | null
          email: string | null
          first_name: string | null
          google_avatar_url: string | null
          id: string
          last_name: string | null
          monthly_reset_date: string | null
          number_format_preference: string | null
          preferred_currency: string | null
          preferred_language: string | null
          receipts_used_this_month: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          subscription_status:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          time_format_preference: string | null
          timezone_preference: string | null
          trial_end_date: string | null
          updated_at: string
        }
        Insert: {
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          cultural_context?: string | null
          date_format_preference?: string | null
          email?: string | null
          first_name?: string | null
          google_avatar_url?: string | null
          id: string
          last_name?: string | null
          monthly_reset_date?: string | null
          number_format_preference?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          receipts_used_this_month?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          time_format_preference?: string | null
          timezone_preference?: string | null
          trial_end_date?: string | null
          updated_at?: string
        }
        Update: {
          avatar_updated_at?: string | null
          avatar_url?: string | null
          created_at?: string
          cultural_context?: string | null
          date_format_preference?: string | null
          email?: string | null
          first_name?: string | null
          google_avatar_url?: string | null
          id?: string
          last_name?: string | null
          monthly_reset_date?: string | null
          number_format_preference?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          receipts_used_this_month?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          subscription_status?:
            | Database["public"]["Enums"]["subscription_status"]
            | null
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          time_format_preference?: string | null
          timezone_preference?: string | null
          trial_end_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          p256dh_key: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      receipt_comments: {
        Row: {
          comment_text: string
          created_at: string | null
          id: string
          is_internal: boolean | null
          metadata: Json | null
          parent_comment_id: string | null
          receipt_id: string
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment_text: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          metadata?: Json | null
          parent_comment_id?: string | null
          receipt_id: string
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment_text?: string
          created_at?: string | null
          id?: string
          is_internal?: boolean | null
          metadata?: Json | null
          parent_comment_id?: string | null
          receipt_id?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "receipt_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_comments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_comments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "receipt_comments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      receipt_flags: {
        Row: {
          created_at: string | null
          flag_type: string
          flagged_by_user_id: string
          id: string
          reason: string
          receipt_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          status: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flag_type: string
          flagged_by_user_id: string
          id?: string
          reason: string
          receipt_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flag_type?: string
          flagged_by_user_id?: string
          id?: string
          reason?: string
          receipt_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_flags_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_flags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "receipt_flags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_shares: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          message: string | null
          permissions: Json | null
          receipt_id: string
          share_type: string
          shared_by_user_id: string
          shared_with_team_id: string | null
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          permissions?: Json | null
          receipt_id: string
          share_type: string
          shared_by_user_id: string
          shared_with_team_id?: string | null
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          message?: string | null
          permissions?: Json | null
          receipt_id?: string
          share_type?: string
          shared_by_user_id?: string
          shared_with_team_id?: string | null
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipt_shares_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_shares_shared_with_team_id_fkey"
            columns: ["shared_with_team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "receipt_shares_shared_with_team_id_fkey"
            columns: ["shared_with_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          address_confidence: number | null
          ai_suggestions: Json | null
          anomaly_flags: Json | null
          batch_id: string | null
          business_type: string | null
          cashier_name: string | null
          confidence_scores: Json | null
          created_at: string
          currency: string | null
          currency_confidence: number | null
          currency_converted: boolean | null
          custom_category_id: string | null
          date: string
          detected_state: string | null
          detected_tax_rate: number | null
          detected_tax_type: string | null
          discount_amount: number | null
          discrepancies: Json | null
          document_structure: Json | null
          embedding_status: string | null
          exchange_rate: number | null
          expense_type: string | null
          extraction_metadata: Json | null
          field_geometry: Json | null
          fullText: string | null
          has_alternative_data: boolean | null
          has_embeddings: boolean | null
          id: string
          image_url: string | null
          invoice_number: string | null
          is_business_expense: boolean | null
          is_tax_inclusive: boolean | null
          item_count: number | null
          line_items_analysis: Json | null
          location_city: string | null
          location_country: string | null
          location_state: string | null
          loyalty_points: number | null
          loyalty_program: string | null
          malaysian_business_category: string | null
          malaysian_business_type: string | null
          malaysian_payment_provider: string | null
          malaysian_registration_number: string | null
          merchant: string
          merchant_category: string | null
          merchant_normalized: string | null
          model_used: string | null
          normalized_merchant: string | null
          original_currency: string | null
          paid_by_id: string | null
          payment_approval_code: string | null
          payment_card_last4: string | null
          payment_method: string | null
          payment_method_confidence: number | null
          predicted_category: string | null
          primary_method: string | null
          processing_error: string | null
          processing_status: string | null
          processing_time: number | null
          purchase_order_number: string | null
          receipt_number: string | null
          receipt_type: string | null
          service_charge: number | null
          spending_patterns: Json | null
          status: string | null
          subtotal: number | null
          tax: number | null
          tax_breakdown: Json | null
          team_id: string | null
          thumbnail_url: string | null
          tip_amount: number | null
          total: number
          total_before_tax: number | null
          transaction_id: string | null
          transaction_time: string | null
          updated_at: string
          user_id: string
          vendor_registration_number: string | null
        }
        Insert: {
          address_confidence?: number | null
          ai_suggestions?: Json | null
          anomaly_flags?: Json | null
          batch_id?: string | null
          business_type?: string | null
          cashier_name?: string | null
          confidence_scores?: Json | null
          created_at?: string
          currency?: string | null
          currency_confidence?: number | null
          currency_converted?: boolean | null
          custom_category_id?: string | null
          date: string
          detected_state?: string | null
          detected_tax_rate?: number | null
          detected_tax_type?: string | null
          discount_amount?: number | null
          discrepancies?: Json | null
          document_structure?: Json | null
          embedding_status?: string | null
          exchange_rate?: number | null
          expense_type?: string | null
          extraction_metadata?: Json | null
          field_geometry?: Json | null
          fullText?: string | null
          has_alternative_data?: boolean | null
          has_embeddings?: boolean | null
          id?: string
          image_url?: string | null
          invoice_number?: string | null
          is_business_expense?: boolean | null
          is_tax_inclusive?: boolean | null
          item_count?: number | null
          line_items_analysis?: Json | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          loyalty_points?: number | null
          loyalty_program?: string | null
          malaysian_business_category?: string | null
          malaysian_business_type?: string | null
          malaysian_payment_provider?: string | null
          malaysian_registration_number?: string | null
          merchant: string
          merchant_category?: string | null
          merchant_normalized?: string | null
          model_used?: string | null
          normalized_merchant?: string | null
          original_currency?: string | null
          paid_by_id?: string | null
          payment_approval_code?: string | null
          payment_card_last4?: string | null
          payment_method?: string | null
          payment_method_confidence?: number | null
          predicted_category?: string | null
          primary_method?: string | null
          processing_error?: string | null
          processing_status?: string | null
          processing_time?: number | null
          purchase_order_number?: string | null
          receipt_number?: string | null
          receipt_type?: string | null
          service_charge?: number | null
          spending_patterns?: Json | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_breakdown?: Json | null
          team_id?: string | null
          thumbnail_url?: string | null
          tip_amount?: number | null
          total: number
          total_before_tax?: number | null
          transaction_id?: string | null
          transaction_time?: string | null
          updated_at?: string
          user_id: string
          vendor_registration_number?: string | null
        }
        Update: {
          address_confidence?: number | null
          ai_suggestions?: Json | null
          anomaly_flags?: Json | null
          batch_id?: string | null
          business_type?: string | null
          cashier_name?: string | null
          confidence_scores?: Json | null
          created_at?: string
          currency?: string | null
          currency_confidence?: number | null
          currency_converted?: boolean | null
          custom_category_id?: string | null
          date?: string
          detected_state?: string | null
          detected_tax_rate?: number | null
          detected_tax_type?: string | null
          discount_amount?: number | null
          discrepancies?: Json | null
          document_structure?: Json | null
          embedding_status?: string | null
          exchange_rate?: number | null
          expense_type?: string | null
          extraction_metadata?: Json | null
          field_geometry?: Json | null
          fullText?: string | null
          has_alternative_data?: boolean | null
          has_embeddings?: boolean | null
          id?: string
          image_url?: string | null
          invoice_number?: string | null
          is_business_expense?: boolean | null
          is_tax_inclusive?: boolean | null
          item_count?: number | null
          line_items_analysis?: Json | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          loyalty_points?: number | null
          loyalty_program?: string | null
          malaysian_business_category?: string | null
          malaysian_business_type?: string | null
          malaysian_payment_provider?: string | null
          malaysian_registration_number?: string | null
          merchant?: string
          merchant_category?: string | null
          merchant_normalized?: string | null
          model_used?: string | null
          normalized_merchant?: string | null
          original_currency?: string | null
          paid_by_id?: string | null
          payment_approval_code?: string | null
          payment_card_last4?: string | null
          payment_method?: string | null
          payment_method_confidence?: number | null
          predicted_category?: string | null
          primary_method?: string | null
          processing_error?: string | null
          processing_status?: string | null
          processing_time?: number | null
          purchase_order_number?: string | null
          receipt_number?: string | null
          receipt_type?: string | null
          service_charge?: number | null
          spending_patterns?: Json | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          tax_breakdown?: Json | null
          team_id?: string | null
          thumbnail_url?: string | null
          tip_amount?: number | null
          total?: number
          total_before_tax?: number | null
          transaction_id?: string | null
          transaction_time?: string | null
          updated_at?: string
          user_id?: string
          vendor_registration_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_custom_category_id_fkey"
            columns: ["custom_category_id"]
            isOneToOne: false
            referencedRelation: "custom_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_paid_by_id_fkey"
            columns: ["paid_by_id"]
            isOneToOne: false
            referencedRelation: "paid_by"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "receipts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          format: string
          id: string
          last_run: string | null
          next_run: string
          recipients: string[]
          report_type: string
          team_id: string
          template_config: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          format?: string
          id?: string
          last_run?: string | null
          next_run: string
          recipients?: string[]
          report_type: string
          team_id: string
          template_config?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          format?: string
          id?: string
          last_run?: string | null
          next_run?: string
          recipients?: string[]
          report_type?: string
          team_id?: string
          template_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "report_schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          format_options: Json
          id: string
          is_default: boolean
          name: string
          sections: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          format_options?: Json
          id?: string
          is_default?: boolean
          name: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          format_options?: Json
          id?: string
          is_default?: boolean
          name?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: []
      }
      subscription_limits: {
        Row: {
          api_access_enabled: boolean | null
          batch_upload_limit: number
          created_at: string | null
          custom_branding_enabled: boolean | null
          integrations_level: string | null
          max_users: number | null
          monthly_receipts: number
          retention_days: number
          storage_limit_mb: number
          stripe_annual_price_id: string | null
          stripe_monthly_price_id: string | null
          support_level: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string | null
          version_control_enabled: boolean | null
        }
        Insert: {
          api_access_enabled?: boolean | null
          batch_upload_limit: number
          created_at?: string | null
          custom_branding_enabled?: boolean | null
          integrations_level?: string | null
          max_users?: number | null
          monthly_receipts: number
          retention_days: number
          storage_limit_mb: number
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          support_level?: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          version_control_enabled?: boolean | null
        }
        Update: {
          api_access_enabled?: boolean | null
          batch_upload_limit?: number
          created_at?: string | null
          custom_branding_enabled?: boolean | null
          integrations_level?: string | null
          max_users?: number | null
          monthly_receipts?: number
          retention_days?: number
          storage_limit_mb?: number
          stripe_annual_price_id?: string | null
          stripe_monthly_price_id?: string | null
          support_level?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string | null
          version_control_enabled?: boolean | null
        }
        Relationships: []
      }
      subscription_renewal_tracking: {
        Row: {
          auto_renewal_enabled: boolean | null
          created_at: string | null
          currency: string | null
          current_period_end: string
          current_period_start: string
          current_price_id: string | null
          current_tier: string
          id: string
          last_reminder_sent_at: string | null
          next_renewal_date: string
          renewal_amount: number | null
          renewal_processed_at: string | null
          status: string | null
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renewal_enabled?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_period_end: string
          current_period_start: string
          current_price_id?: string | null
          current_tier: string
          id?: string
          last_reminder_sent_at?: string | null
          next_renewal_date: string
          renewal_amount?: number | null
          renewal_processed_at?: string | null
          status?: string | null
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renewal_enabled?: boolean | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string
          current_period_start?: string
          current_price_id?: string | null
          current_tier?: string
          id?: string
          last_reminder_sent_at?: string | null
          next_renewal_date?: string
          renewal_amount?: number | null
          renewal_processed_at?: string | null
          status?: string | null
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supported_currencies: {
        Row: {
          code: string
          created_at: string | null
          decimal_places: number | null
          display_order: number | null
          flag_emoji: string | null
          is_active: boolean | null
          is_popular: boolean | null
          locale_code: string | null
          name: string
          symbol: string
          symbol_position: string | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          decimal_places?: number | null
          display_order?: number | null
          flag_emoji?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          locale_code?: string | null
          name: string
          symbol: string
          symbol_position?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          decimal_places?: number | null
          display_order?: number | null
          flag_emoji?: string | null
          is_active?: boolean | null
          is_popular?: boolean | null
          locale_code?: string | null
          name?: string
          symbol?: string
          symbol_position?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          custom_message: string | null
          email: string
          expires_at: string
          id: string
          invitation_attempts: number | null
          invited_by: string
          last_sent_at: string | null
          metadata: Json | null
          permissions: Json | null
          role: Database["public"]["Enums"]["team_member_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          team_id: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          custom_message?: string | null
          email: string
          expires_at: string
          id?: string
          invitation_attempts?: number | null
          invited_by: string
          last_sent_at?: string | null
          metadata?: Json | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          custom_message?: string | null
          email?: string
          expires_at?: string
          id?: string
          invitation_attempts?: number | null
          invited_by?: string
          last_sent_at?: string | null
          metadata?: Json | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          team_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          permissions: Json
          role: Database["public"]["Enums"]["team_member_role"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["team_member_role"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          permissions?: Json
          role?: Database["public"]["Enums"]["team_member_role"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["team_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["team_status"]
          updated_at?: string
        }
        Relationships: []
      }
      theme_preferences: {
        Row: {
          created_at: string | null
          enable_transitions: boolean | null
          id: string
          last_mode_switch: string | null
          persist_across_devices: boolean | null
          preferred_mode: string | null
          switch_frequency: number | null
          sync_with_system: boolean | null
          theme_mode: string | null
          theme_variant: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enable_transitions?: boolean | null
          id?: string
          last_mode_switch?: string | null
          persist_across_devices?: boolean | null
          preferred_mode?: string | null
          switch_frequency?: number | null
          sync_with_system?: boolean | null
          theme_mode?: string | null
          theme_variant?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enable_transitions?: boolean | null
          id?: string
          last_mode_switch?: string | null
          persist_across_devices?: boolean | null
          preferred_mode?: string | null
          switch_frequency?: number | null
          sync_with_system?: boolean | null
          theme_mode?: string | null
          theme_variant?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string | null
          id: string
          key: string
          language: string
          namespace: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          language: string
          namespace: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          language?: string
          namespace?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      unified_embeddings: {
        Row: {
          content_text: string
          content_type: string
          created_at: string | null
          embedding: string | null
          id: string
          language: string | null
          metadata: Json | null
          source_id: string
          source_type: string
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content_text: string
          content_type: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          language?: string | null
          metadata?: Json | null
          source_id: string
          source_type: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content_text?: string
          content_type?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          language?: string | null
          metadata?: Json | null
          source_id?: string
          source_type?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_behavioral_patterns: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          last_computed: string | null
          pattern_data: Json
          pattern_type: string
          sample_size: number | null
          user_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_computed?: string | null
          pattern_data: Json
          pattern_type: string
          sample_size?: number | null
          user_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_computed?: string | null
          pattern_data?: Json
          pattern_type?: string
          sample_size?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_chat_preferences: {
        Row: {
          common_search_terms: Json | null
          created_at: string | null
          frequent_merchants: Json | null
          id: string
          notification_preferences: Json | null
          preferred_response_style: string | null
          search_filters: Json | null
          ui_preferences: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          common_search_terms?: Json | null
          created_at?: string | null
          frequent_merchants?: Json | null
          id?: string
          notification_preferences?: Json | null
          preferred_response_style?: string | null
          search_filters?: Json | null
          ui_preferences?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          common_search_terms?: Json | null
          created_at?: string | null
          frequent_merchants?: Json | null
          id?: string
          notification_preferences?: Json | null
          preferred_response_style?: string | null
          search_filters?: Json | null
          ui_preferences?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_interactions: {
        Row: {
          created_at: string | null
          id: string
          interaction_context: Json
          interaction_metadata: Json | null
          interaction_type: string
          session_id: string
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_context?: Json
          interaction_metadata?: Json | null
          interaction_type: string
          session_id: string
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_context?: Json
          interaction_metadata?: Json | null
          interaction_type?: string
          session_id?: string
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_personalization_profiles: {
        Row: {
          behavioral_patterns: Json | null
          created_at: string | null
          id: string
          last_updated: string | null
          preferences: Json | null
          profile_completeness: string | null
          user_id: string | null
        }
        Insert: {
          behavioral_patterns?: Json | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          preferences?: Json | null
          profile_completeness?: string | null
          user_id?: string | null
        }
        Update: {
          behavioral_patterns?: Json | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          preferences?: Json | null
          profile_completeness?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          last_updated: string | null
          learning_source: string | null
          preference_category: string
          preference_key: string
          preference_value: Json
          user_id: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          learning_source?: string | null
          preference_category: string
          preference_key: string
          preference_value: Json
          user_id?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_updated?: string | null
          learning_source?: string | null
          preference_category?: string
          preference_key?: string
          preference_value?: Json
          user_id?: string | null
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
      workflow_progress: {
        Row: {
          agent_assignments: Json | null
          created_at: string | null
          current_step: string | null
          eta_seconds: number | null
          id: string
          metadata: Json | null
          performance_data: Json | null
          progress_percentage: number | null
          updated_at: string | null
          user_id: string
          workflow_id: string
        }
        Insert: {
          agent_assignments?: Json | null
          created_at?: string | null
          current_step?: string | null
          eta_seconds?: number | null
          id?: string
          metadata?: Json | null
          performance_data?: Json | null
          progress_percentage?: number | null
          updated_at?: string | null
          user_id: string
          workflow_id: string
        }
        Update: {
          agent_assignments?: Json | null
          created_at?: string | null
          current_step?: string | null
          eta_seconds?: number | null
          id?: string
          metadata?: Json | null
          performance_data?: Json | null
          progress_percentage?: number | null
          updated_at?: string | null
          user_id?: string
          workflow_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      embedding_content_health: {
        Row: {
          content_health_percentage: number | null
          content_type: string | null
          empty_content: number | null
          has_content: number | null
          source_type: string | null
          total_embeddings: number | null
        }
        Relationships: []
      }
      mv_advanced_analytics_summary: {
        Row: {
          active_conversations_30_days: number | null
          active_days_last_30_days: number | null
          activity_trend: string | null
          avg_completion_time: string | null
          collaboration_score: number | null
          conversations_created: number | null
          engagement_score: number | null
          files_shared: number | null
          joined_at: string | null
          last_updated: string | null
          last_updated_epoch: number | null
          messages_sent_30_days: number | null
          messages_sent_7_days: number | null
          performance_category: string | null
          project_success_rate: number | null
          projects_completed: number | null
          projects_involved: number | null
          receipts_ai_processed: number | null
          receipts_created: number | null
          receipts_last_1_day: number | null
          receipts_last_30_days: number | null
          receipts_last_7_days: number | null
          role: Database["public"]["Enums"]["team_member_role"] | null
          tasks_completed: number | null
          team_id: string | null
          total_receipt_amount: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "mv_team_advanced_analytics"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_malaysian_reference_data: {
        Row: {
          category: string | null
          confidence_score: number | null
          data_type: string | null
          keywords: string[] | null
          name: string | null
          rate: number | null
          states: string[] | null
        }
        Relationships: []
      }
      mv_team_advanced_analytics: {
        Row: {
          admins_count: number | null
          at_risk_members: number | null
          avg_collaboration_score: number | null
          avg_engagement_score: number | null
          developing_members: number | null
          high_performers: number | null
          last_updated: string | null
          members_count: number | null
          needs_attention: number | null
          owners_count: number | null
          solid_contributors: number | null
          team_health_status: string | null
          team_id: string | null
          team_name: string | null
          team_receipts_30_days: number | null
          team_receipts_7_days: number | null
          total_members: number | null
        }
        Relationships: []
      }
      performance_dashboard: {
        Row: {
          avg_value: number | null
          last_measurement: string | null
          max_value: number | null
          metric_name: string | null
          metric_type: string | null
          metric_unit: string | null
          min_value: number | null
          std_deviation: number | null
          total_measurements: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_team_invitation: { Args: { _token: string }; Returns: boolean }
      add_chat_message:
        | {
            Args: {
              p_content: string
              p_conversation_id: string
              p_enhancement_data?: Json
              p_intent_data?: Json
              p_keywords_data?: Json
              p_message_type?: string
              p_metadata?: Json
              p_role: string
              p_search_results?: Json
              p_validation_data?: Json
            }
            Returns: string
          }
        | {
            Args: {
              p_content: string
              p_conversation_id: string
              p_enhancement_data?: Json
              p_intent_data?: Json
              p_keywords_data?: Json
              p_message_type?: string
              p_metadata?: Json
              p_role: string
              p_search_results?: Json
              p_validation_data?: Json
            }
            Returns: string
          }
      add_unified_embedding: {
        Args: {
          p_content_text: string
          p_content_type: string
          p_embedding: string
          p_language?: string
          p_metadata?: Json
          p_source_id: string
          p_source_type: string
          p_team_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      aggregate_embedding_daily_stats: { Args: never; Returns: undefined }
      aggregate_embedding_hourly_stats: { Args: never; Returns: undefined }
      approve_claim: {
        Args: { _claim_id: string; _comment?: string }
        Returns: boolean
      }
      archive_notification: {
        Args: { _notification_id: string }
        Returns: boolean
      }
      archive_payer: { Args: { p_payer_id: string }; Returns: boolean }
      assign_admin_role_by_email: {
        Args: { user_email: string }
        Returns: boolean
      }
      basic_search_receipts: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_max_amount?: number
          p_merchants?: string[]
          p_min_amount?: number
          p_offset?: number
          p_query: string
          p_start_date?: string
        }
        Returns: Json
      }
      bulk_archive_notifications: {
        Args: { _notification_ids: string[] }
        Returns: number
      }
      bulk_assign_category: {
        Args: { p_category_id?: string; p_receipt_ids: string[] }
        Returns: number
      }
      bulk_delete_notifications: {
        Args: { _notification_ids: string[] }
        Returns: number
      }
      calculate_malaysian_tax: {
        Args: { is_inclusive?: boolean; tax_rate: number; total_amount: number }
        Returns: Json
      }
      can_approve_claims: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      can_perform_action: {
        Args: { _action?: string; _payload?: Json; _user_id?: string }
        Returns: Json
      }
      can_perform_unified_search: {
        Args: {
          p_result_limit?: number
          p_sources: string[]
          p_user_id: string
        }
        Returns: Json
      }
      can_review_claims: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      can_submit_claims: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      cancel_team_invitation: {
        Args: { _invitation_id: string; _reason?: string }
        Returns: Json
      }
      check_email_activity: {
        Args: never
        Returns: {
          activity_timestamp: string
          activity_type: string
          details: Json
        }[]
      }
      check_embedding_aggregation_health: { Args: never; Returns: Json }
      check_embedding_health: {
        Args: never
        Returns: {
          health_percentage: number
          invalid_embeddings: number
          null_embeddings: number
          table_name: string
          total_embeddings: number
          valid_embeddings: number
        }[]
      }
      check_pgvector_status: { Args: never; Returns: Json }
      check_subscription_limit: {
        Args: { _limit_type?: string; _user_id?: string }
        Returns: boolean
      }
      check_subscription_limit_enhanced: {
        Args: { _action?: string; _payload?: Json; _user_id?: string }
        Returns: boolean
      }
      cleanup_expired_cache: { Args: never; Returns: undefined }
      cleanup_expired_conversations: { Args: never; Returns: number }
      cleanup_expired_invitation_sessions: { Args: never; Returns: Json }
      cleanup_notification_audit_logs: { Args: never; Returns: undefined }
      cleanup_old_email_schedules: {
        Args: { p_days_old?: number }
        Returns: number
      }
      cleanup_old_embedding_metrics: { Args: never; Returns: undefined }
      column_exists: {
        Args: { p_column: string; p_schema?: string; p_table: string }
        Returns: boolean
      }
      convert_malaysian_currency: {
        Args: {
          amount: number
          conversion_date?: string
          from_currency: string
          to_currency: string
        }
        Returns: Json
      }
      create_claim: {
        Args: {
          _amount: number
          _attachments: Json
          _category: string
          _currency: string
          _description: string
          _priority: Database["public"]["Enums"]["claim_priority"]
          _team_id: string
          _title: string
        }
        Returns: string
      }
      create_claim_with_user_id: {
        Args: {
          _amount: number
          _attachments: Json
          _category: string
          _currency: string
          _description: string
          _priority: Database["public"]["Enums"]["claim_priority"]
          _team_id: string
          _title: string
          _user_id: string
        }
        Returns: string
      }
      create_conversation_session:
        | {
            Args: {
              p_metadata?: Json
              p_session_type?: string
              p_team_id?: string
              p_title?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_metadata?: Json
              p_session_type?: string
              p_team_id?: string
              p_title?: string
            }
            Returns: string
          }
      create_custom_category: {
        Args: {
          p_color?: string
          p_icon?: string
          p_name: string
          p_team_id?: string
        }
        Returns: string
      }
      create_default_categories_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_default_notification_preferences: {
        Args: { _user_id: string }
        Returns: string
      }
      create_default_team_categories: {
        Args: { p_team_id: string; p_user_id?: string }
        Returns: undefined
      }
      create_email_delivery:
        | {
            Args: {
              _metadata?: Json
              _recipient_email: string
              _related_entity_id?: string
              _related_entity_type?: string
              _subject: string
              _team_id?: string
              _template_name?: string
            }
            Returns: string
          }
        | {
            Args: {
              _metadata: Json
              _recipient_email: string
              _related_entity_id: string
              _related_entity_type: string
              _subject: string
              _team_id: string
              _template_name: string
            }
            Returns: string
          }
      create_first_admin: { Args: { _email: string }; Returns: boolean }
      create_invitation_session: {
        Args: {
          p_browser_fingerprint?: string
          p_invitation_token: string
          p_ip_address?: unknown
          p_redirect_after_auth?: string
          p_target_email: string
          p_user_agent?: string
          p_user_type: string
        }
        Returns: Json
      }
      create_payer: {
        Args: { p_name: string; p_team_id?: string }
        Returns: string
      }
      create_team: {
        Args: { _description?: string; _name: string; _slug?: string }
        Returns: string
      }
      delete_conversation: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      delete_custom_category: {
        Args: { p_category_id: string; p_reassign_to_category_id?: string }
        Returns: boolean
      }
      detect_content_language: { Args: { content_text: string }; Returns: Json }
      detect_malaysian_payment_method: {
        Args: { receipt_text: string }
        Returns: {
          confidence_score: number
          method_name: string
          method_type: string
          provider: string
        }[]
      }
      detect_malaysian_tax_category: {
        Args: { merchant_name: string; receipt_date?: string }
        Returns: {
          category_name: string
          confidence_score: number
          tax_rate: number
          tax_type: string
        }[]
      }
      detect_user_invitation_state: {
        Args: {
          p_browser_fingerprint?: string
          p_invitation_token: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: Json
      }
      enhanced_hybrid_search: {
        Args: {
          amount_currency?: string
          amount_max?: number
          amount_min?: number
          content_types?: string[]
          keyword_weight?: number
          language_filter?: string
          match_count?: number
          query_embedding: string
          query_text: string
          receipt_ids_filter?: string[]
          semantic_weight?: number
          similarity_threshold?: number
          source_types?: string[]
          team_filter?: string
          trigram_threshold?: number
          trigram_weight?: number
          user_filter?: string
        }
        Returns: {
          combined_score: number
          content_text: string
          content_type: string
          id: string
          keyword_score: number
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
          trigram_similarity: number
        }[]
      }
      extract_business_directory_content: {
        Args: { p_business_id: string }
        Returns: {
          content_text: string
          content_type: string
          metadata: Json
        }[]
      }
      extract_claim_content: {
        Args: { p_claim_id: string }
        Returns: {
          content_text: string
          content_type: string
          metadata: Json
        }[]
      }
      extract_custom_category_content: {
        Args: { p_category_id: string }
        Returns: {
          content_text: string
          content_type: string
          metadata: Json
        }[]
      }
      extract_receipt_content: {
        Args: { p_receipt_id: string }
        Returns: {
          content_text: string
          content_type: string
          metadata: Json
        }[]
      }
      extract_team_member_content: {
        Args: { p_team_member_id: string }
        Returns: {
          content_text: string
          content_type: string
          metadata: Json
        }[]
      }
      find_line_items_missing_embeddings: {
        Args: { limit_count?: number }
        Returns: {
          amount: number
          description: string
          line_item_id: string
          merchant: string
          receipt_date: string
          receipt_id: string
          user_id: string
        }[]
      }
      find_low_quality_embeddings: {
        Args: {
          p_limit?: number
          p_min_quality_score?: number
          p_user_id?: string
        }
        Returns: {
          created_at: string
          current_quality_score: number
          date: string
          merchant: string
          processing_method: string
          receipt_id: string
          synthetic_content_used: boolean
          total: number
        }[]
      }
      find_missing_embeddings: {
        Args: { limit_count?: number; source_table: string }
        Returns: {
          id: string
          missing_content_types: string[]
        }[]
      }
      find_receipts_missing_embeddings: {
        Args: { limit_count?: number }
        Returns: {
          date: string
          merchant: string
          missing_content_types: string[]
          receipt_id: string
        }[]
      }
      fix_line_item_embeddings: {
        Args: never
        Returns: {
          embedding_id: string
          error_message: string
          line_item_id: string
          new_content: string
          old_content: string
          status: string
        }[]
      }
      fix_receipt_embedding_content: {
        Args: never
        Returns: {
          content_type: string
          embedding_id: string
          error_message: string
          fixed_content: string
          original_content: string
          receipt_id: string
          success: boolean
        }[]
      }
      format_malaysian_currency: {
        Args: {
          amount: number
          currency_code?: string
          include_symbol?: boolean
        }
        Returns: string
      }
      format_malaysian_date: {
        Args: {
          format_preference?: string
          input_date: string
          separator_preference?: string
        }
        Returns: string
      }
      format_malaysian_number: {
        Args: {
          decimal_sep?: string
          format_style?: string
          input_number: number
          thousands_sep?: string
        }
        Returns: string
      }
      format_malaysian_time: {
        Args: {
          format_preference?: string
          input_time: string
          separator_preference?: string
        }
        Returns: string
      }
      generate_line_item_embeddings: {
        Args: { p_embedding: string; p_line_item_id: string }
        Returns: boolean
      }
      generate_receipt_embeddings: {
        Args: { p_process_all_fields?: boolean; p_receipt_id: string }
        Returns: Json
      }
      get_admin_system_stats: { Args: never; Returns: Json }
      get_admin_users: {
        Args: never
        Returns: {
          confirmed_at: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          last_sign_in_at: string
          roles: Json
        }[]
      }
      get_api_usage_stats: {
        Args: { _days?: number; _user_id?: string }
        Returns: Json
      }
      get_billing_preferences: {
        Args: { p_user_id: string }
        Returns: {
          auto_renewal_enabled: boolean | null
          auto_renewal_frequency: string | null
          billing_email_enabled: boolean | null
          created_at: string | null
          email_notifications_enabled: boolean | null
          grace_period_days: number | null
          grace_period_notifications: boolean | null
          id: string
          max_payment_retry_attempts: number | null
          payment_failure_notifications: boolean | null
          preferred_language: string | null
          push_notifications_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reminder_days_before_renewal: number[] | null
          retry_interval_hours: number | null
          sms_notifications_enabled: boolean | null
          timezone: string | null
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "billing_preferences"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_chat_statistics: {
        Args: { p_days?: number; p_user_id?: string }
        Returns: {
          active_conversations: number
          avg_session_duration: number
          conversation_types: Json
          top_search_terms: Json
          total_conversations: number
          total_messages: number
          total_searches: number
        }[]
      }
      get_conversation_context: {
        Args: {
          p_context_type?: string
          p_conversation_id: string
          p_min_relevance?: number
        }
        Returns: {
          context_data: Json
          context_type: string
          created_at: string
          relevance_score: number
        }[]
      }
      get_conversation_context_window: {
        Args: {
          p_conversation_id: string
          p_include_memory?: boolean
          p_max_tokens?: number
        }
        Returns: Json
      }
      get_conversation_memory: {
        Args: {
          p_limit?: number
          p_memory_key?: string
          p_memory_type?: string
          p_min_confidence?: number
        }
        Returns: {
          access_count: number
          confidence_score: number
          created_at: string
          id: string
          last_accessed: string
          memory_data: Json
          memory_key: string
          memory_type: string
          source_conversations: string[]
          updated_at: string
        }[]
      }
      get_conversation_messages: {
        Args: {
          p_conversation_id: string
          p_include_metadata?: boolean
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          content: string
          created_at: string
          message_id: string
          message_type: string
          metadata: Json
          parent_message_id: string
        }[]
      }
      get_conversation_with_messages: {
        Args: { p_conversation_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          analytics_data: Json
          context_data: Json
          conversation_data: Json
          messages_data: Json
        }[]
      }
      get_due_report_schedules: {
        Args: never
        Returns: {
          format: string
          id: string
          recipients: string[]
          report_type: string
          team_id: string
          template_config: Json
        }[]
      }
      get_email_delivery_health_metrics: {
        Args: { p_time_filter?: string }
        Returns: {
          bounce_rate: number
          delivered_emails: number
          delivery_rate: number
          failed_emails: number
          pending_emails: number
          total_emails: number
        }[]
      }
      get_email_delivery_stats: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          delivery_rate: number
          failed_emails: number
          pending_emails: number
          sent_emails: number
          total_emails: number
        }[]
      }
      get_embedding_migration_stats: {
        Args: never
        Returns: {
          migration_needed: boolean
          receipts_missing_embeddings: number
          receipts_with_old_embeddings: number
          receipts_with_unified_embeddings: number
          total_receipts: number
        }[]
      }
      get_embedding_quality_summary: {
        Args: { p_days_back?: number; p_user_id?: string }
        Returns: {
          avg_quality_score: number
          enhanced_processing_rate: number
          recent_quality_trend: number
          synthetic_content_rate: number
          total_receipts: number
        }[]
      }
      get_exchange_rate: {
        Args: { from_currency: string; rate_date?: string; to_currency: string }
        Returns: number
      }
      get_feedback_analytics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          feedback_by_day: Json
          negative_feedback: number
          positive_feedback: number
          positive_percentage: number
          total_feedback: number
        }[]
      }
      get_invitation_activity_timeline: {
        Args: { _limit?: number; _offset?: number; _team_id: string }
        Returns: Json
      }
      get_invitation_analytics: {
        Args: { _date_range_days?: number; _team_id: string }
        Returns: Json
      }
      get_invitation_by_token: {
        Args: { _pending_only?: boolean; _token: string }
        Returns: Json
      }
      get_invitation_session: {
        Args: { p_browser_fingerprint?: string; p_invitation_token: string }
        Returns: Json
      }
      get_invitation_stats: { Args: { _team_id: string }; Returns: Json }
      get_latest_malaysian_exchange_rate: {
        Args: { from_currency: string; to_currency: string }
        Returns: number
      }
      get_line_item_embedding_stats: {
        Args: never
        Returns: {
          coverage_percentage: number
          line_items_missing_embeddings: number
          line_items_with_embeddings: number
          total_line_items: number
          wrong_content_count: number
        }[]
      }
      get_line_items_without_embeddings_for_receipt: {
        Args: { p_receipt_id: string }
        Returns: {
          amount: number
          description: string
          id: string
        }[]
      }
      get_malaysian_business_days: {
        Args: { end_date: string; start_date: string; state_code?: string }
        Returns: number
      }
      get_malaysian_business_hours: {
        Args: { business_type_param: string; day_of_week_param?: number }
        Returns: {
          close_time: string
          day_of_week: number
          is_closed: boolean
          notes: string
          open_time: string
        }[]
      }
      get_malaysian_tax_info: {
        Args: { merchant_name: string; receipt_date?: string }
        Returns: Json
      }
      get_merchant_analysis: {
        Args: {
          currency_filter?: string
          end_date?: string
          limit_results?: number
          start_date?: string
          user_filter: string
        }
        Returns: {
          average_amount: number
          business_expense_ratio: number
          business_type: string
          first_visit: string
          frequency_score: number
          last_visit: string
          location_city: string
          location_state: string
          loyalty_programs: string[]
          merchant: string
          merchant_category: string
          payment_methods: string[]
          total_amount: number
          transaction_count: number
        }[]
      }
      get_message_feedback: {
        Args: { p_message_id: string }
        Returns: {
          created_at: string
          feedback_comment: string
          feedback_type: string
          id: string
          updated_at: string
        }[]
      }
      get_monthly_spending_trends: {
        Args: {
          currency_filter?: string
          months_back?: number
          user_filter: string
        }
        Returns: {
          average_amount: number
          business_expense_amount: number
          month: number
          month_name: string
          personal_expense_amount: number
          top_category: string
          top_merchant: string
          total_amount: number
          transaction_count: number
          year: number
        }[]
      }
      get_my_usage_stats_optimized: { Args: never; Returns: Json }
      get_notification_statistics: {
        Args: { _time_period?: unknown }
        Returns: {
          active_push_subscriptions: number
          email_deliveries: number
          email_success_rate: number
          notifications_by_type: Json
          push_subscriptions: number
          total_notifications: number
          unread_notifications: number
        }[]
      }
      get_optimal_ai_model: {
        Args: { content_text: string; processing_type?: string }
        Returns: Json
      }
      get_payment_health_metrics: {
        Args: { p_time_filter?: string }
        Returns: {
          avg_processing_time: number
          currency: string
          failed_payments: number
          success_rate: number
          successful_payments: number
          total_amount: number
          total_payments: number
        }[]
      }
      get_pending_email_reminders: {
        Args: { p_limit?: number }
        Returns: {
          delivery_attempts: number
          language: string
          priority: string
          reminder_type: string
          schedule_id: string
          scheduled_for: string
          subscription_id: string
          template_data: Json
          user_id: string
        }[]
      }
      get_performance_alerts: {
        Args: {
          p_cache_hit_rate_threshold?: number
          p_query_time_threshold?: number
          p_time_window_minutes?: number
        }
        Returns: {
          alert_message: string
          alert_type: string
          created_at: string
          current_value: number
          metric_name: string
          severity: string
          threshold_value: number
        }[]
      }
      get_performance_summary: {
        Args: { p_end_date?: string; p_start_date?: string; p_user_id?: string }
        Returns: {
          avg_value: number
          max_value: number
          metric_name: string
          metric_type: string
          min_value: number
          percentile_50: number
          percentile_95: number
          percentile_99: number
          total_count: number
        }[]
      }
      get_performance_trends: {
        Args: {
          p_end_date?: string
          p_metric_name: string
          p_start_date?: string
          p_user_id?: string
        }
        Returns: {
          avg_value: number
          count_values: number
          max_value: number
          min_value: number
          time_bucket: string
        }[]
      }
      get_receipt_count_by_criteria: {
        Args: {
          category_filter?: string
          date_from?: string
          date_to?: string
          merchant_filter?: string
          price_max?: number
          price_min?: number
          search_text?: string
          user_filter?: string
        }
        Returns: {
          search_criteria: Json
          total_receipts_in_db: number
          unique_receipt_count: number
        }[]
      }
      get_receipt_ids_in_date_range: {
        Args: {
          amount_max?: number
          amount_min?: number
          date_range_end: string
          date_range_start: string
          temporal_context?: string
          user_filter: string
        }
        Returns: string[]
      }
      get_receipts_over_amount: {
        Args: { amount_threshold: number; user_filter?: string }
        Returns: {
          avg_amount: number
          receipt_count: number
          total_amount: number
        }[]
      }
      get_receipts_with_missing_line_item_embeddings: {
        Args: { p_limit?: number }
        Returns: {
          id: string
        }[]
      }
      get_search_tier_limits: { Args: { p_user_id: string }; Returns: Json }
      get_spending_anomalies: {
        Args: {
          currency_filter?: string
          end_date?: string
          start_date?: string
          user_filter: string
        }
        Returns: {
          amount: number
          anomaly_score: number
          anomaly_type: string
          category: string
          comparison_baseline: number
          date: string
          description: string
          merchant: string
          receipt_id: string
        }[]
      }
      get_spending_by_category: {
        Args: {
          currency_filter?: string
          end_date?: string
          start_date?: string
          user_filter: string
        }
        Returns: {
          average_amount: number
          category: string
          first_transaction: string
          last_transaction: string
          percentage_of_total: number
          total_amount: number
          transaction_count: number
        }[]
      }
      get_stripe_price_id: {
        Args: {
          _billing_interval?: string
          _tier: Database["public"]["Enums"]["subscription_tier"]
        }
        Returns: string
      }
      get_subscription_health_metrics: {
        Args: { p_time_filter?: string }
        Returns: {
          active_subscriptions: number
          cancelled_subscriptions: number
          churn_rate: number
          mrr: number
          new_subscriptions: number
          renewal_success_rate: number
        }[]
      }
      get_team_claims: {
        Args: {
          _limit: number
          _offset: number
          _status: Database["public"]["Enums"]["claim_status"]
          _team_id: string
        }
        Returns: {
          amount: number
          approved_at: string
          approved_by: string
          category: string
          claimant_email: string
          claimant_id: string
          claimant_name: string
          created_at: string
          currency: string
          description: string
          id: string
          priority: Database["public"]["Enums"]["claim_priority"]
          rejection_reason: string
          reviewed_at: string
          reviewed_by: string
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string
          title: string
          updated_at: string
        }[]
      }
      get_team_members: {
        Args: { _team_id: string }
        Returns: {
          email: string
          first_name: string
          id: string
          joined_at: string
          last_name: string
          role: Database["public"]["Enums"]["team_member_role"]
          user_id: string
        }[]
      }
      get_team_report_history: {
        Args: { _limit?: number; _team_id: string }
        Returns: {
          email_sent: boolean
          generated_at: string
          id: string
          recipients_count: number
          report_type: string
          summary: Json
        }[]
      }
      get_temporal_metadata_health: {
        Args: never
        Returns: {
          auto_enriched: number
          avg_days_old: number
          needs_refresh: number
          source_type: string
          total_embeddings: number
          with_temporal_context: number
        }[]
      }
      get_temporal_search_stats: {
        Args: { user_filter: string }
        Returns: {
          avg_amount: number
          date_range_end: string
          date_range_start: string
          temporal_context: string
          total_embeddings: number
          unique_receipts: number
          weekday_count: number
          weekend_count: number
        }[]
      }
      get_temporal_statistics: {
        Args: { p_user_id: string }
        Returns: {
          avg_total: number
          count: number
          earliest_date: string
          latest_date: string
          source_type: string
          temporal_context: string
        }[]
      }
      get_tier_from_price_id: {
        Args: { _price_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      get_time_based_patterns: {
        Args: {
          currency_filter?: string
          end_date?: string
          start_date?: string
          user_filter: string
        }
        Returns: {
          average_amount: number
          business_expense_ratio: number
          period_value: string
          time_period: string
          top_category: string
          top_merchant: string
          total_amount: number
          transaction_count: number
        }[]
      }
      get_unified_embedding_stats: {
        Args: never
        Returns: {
          avg_similarity: number
          content_type: string
          count: number
          languages: string[]
          source_type: string
        }[]
      }
      get_unified_search_stats: {
        Args: { user_filter?: string }
        Returns: {
          avg_content_length: number
          content_type: string
          has_content: number
          source_type: string
          total_embeddings: number
        }[]
      }
      get_unique_receipt_count_for_search: {
        Args: {
          query_embedding: string
          similarity_threshold?: number
          user_filter?: string
        }
        Returns: {
          total_embeddings_found: number
          unique_receipt_count: number
        }[]
      }
      get_unread_notification_count: {
        Args: { _team_id: string }
        Returns: number
      }
      get_upcoming_renewals: {
        Args: { p_days_ahead?: number }
        Returns: {
          currency: string
          current_period_end: string
          current_period_start: string
          current_price_id: string
          current_tier: string
          next_renewal_date: string
          renewal_amount: number
          stripe_subscription_id: string
          user_id: string
        }[]
      }
      get_user_categories_with_counts: {
        Args: { p_team_id?: string; p_user_id?: string }
        Returns: {
          color: string
          created_at: string
          icon: string
          id: string
          is_team_category: boolean
          name: string
          receipt_count: number
          team_id: string
          updated_at: string
        }[]
      }
      get_user_chat_preferences: {
        Args: never
        Returns: {
          common_search_terms: string[]
          created_at: string
          frequent_merchants: string[]
          notification_preferences: Json
          preferred_response_style: string
          search_filters: Json
          ui_preferences: Json
          updated_at: string
        }[]
      }
      get_user_conversations:
        | {
            Args: {
              p_include_archived?: boolean
              p_limit?: number
              p_offset?: number
            }
            Returns: {
              created_at: string
              id: string
              is_archived: boolean
              is_favorite: boolean
              last_message_at: string
              message_count: number
              title: string
            }[]
          }
        | {
            Args: { p_limit?: number; p_offset?: number; p_status?: string }
            Returns: {
              conversation_id: string
              created_at: string
              last_activity_at: string
              last_message_content: string
              last_message_role: string
              message_count: number
              session_type: string
              status: string
              title: string
            }[]
          }
      get_user_cultural_preferences: {
        Args: { user_id: string }
        Returns: Json
      }
      get_user_notification_preferences: {
        Args: { _user_id: string }
        Returns: {
          browser_permission_granted: boolean
          browser_permission_requested_at: string
          created_at: string
          daily_digest_enabled: boolean
          digest_time: string
          email_billing_updates: boolean
          email_enabled: boolean
          email_receipt_batch_completed: boolean
          email_receipt_processing_completed: boolean
          email_receipt_processing_failed: boolean
          email_receipt_ready_for_review: boolean
          email_security_alerts: boolean
          email_team_activity: boolean
          email_team_invitations: boolean
          email_team_member_removed: boolean
          email_weekly_reports: boolean
          id: string
          push_enabled: boolean
          push_receipt_batch_completed: boolean
          push_receipt_comments: boolean
          push_receipt_processing_completed: boolean
          push_receipt_processing_failed: boolean
          push_receipt_ready_for_review: boolean
          push_receipt_shared: boolean
          push_team_activity: boolean
          push_team_invitations: boolean
          push_team_member_removed: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          updated_at: string
          user_id: string
          weekly_digest_enabled: boolean
        }[]
      }
      get_user_notifications: {
        Args: { _limit: number; _offset: number; _unread_only: boolean }
        Returns: {
          action_url: string
          created_at: string
          expires_at: string
          id: string
          message: string
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string
          related_entity_id: string
          related_entity_type: string
          team_id: string
          team_name: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }[]
      }
      get_user_payers_with_counts: {
        Args: { p_team_id?: string; p_user_id?: string }
        Returns: {
          created_at: string
          id: string
          is_team_payer: boolean
          name: string
          receipt_count: number
          team_id: string
          updated_at: string
        }[]
      }
      get_user_personalization_profile: { Args: never; Returns: Json }
      get_user_preferences: {
        Args: { p_category?: string; p_min_confidence?: number }
        Returns: {
          confidence_score: number
          last_updated: string
          learning_source: string
          preference_category: string
          preference_key: string
          preference_value: Json
        }[]
      }
      get_user_preferred_currency: {
        Args: { user_id: string }
        Returns: string
      }
      get_user_receipt_usage_stats: {
        Args: never
        Returns: {
          primary_method: string
          receipt_count: number
        }[]
      }
      get_user_teams: {
        Args: { _user_id?: string }
        Returns: {
          created_at: string
          description: string
          id: string
          member_count: number
          name: string
          owner_id: string
          slug: string
          status: Database["public"]["Enums"]["team_status"]
          user_role: Database["public"]["Enums"]["team_member_role"]
        }[]
      }
      get_user_theme_config: {
        Args: { p_user_id?: string }
        Returns: {
          enable_transitions: boolean
          persist_across_devices: boolean
          sync_with_system: boolean
          theme_mode: string
          theme_variant: string
        }[]
      }
      get_user_usage_stats_optimized: {
        Args: { _user_id?: string }
        Returns: Json
      }
      get_users_by_ids: {
        Args: { user_ids: string[] }
        Returns: {
          email: string
          first_name: string
          id: string
          last_name: string
        }[]
      }
      get_webhook_health_metrics: {
        Args: { p_time_filter?: string }
        Returns: {
          avg_processing_time: number
          failed_webhooks: number
          success_rate: number
          successful_webhooks: number
          total_webhooks: number
        }[]
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id?: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role?: Database["public"]["Enums"]["app_role"]
              _user_id?: string
            }
            Returns: boolean
          }
      hybrid_search_line_items:
        | {
            Args: {
              end_date?: string
              match_count?: number
              max_amount?: number
              min_amount?: number
              query_embedding: string
              query_text: string
              similarity_threshold?: number
              similarity_weight?: number
              start_date?: string
              text_weight?: number
            }
            Returns: {
              line_item_description: string
              line_item_id: string
              line_item_price: number
              line_item_quantity: number
              parent_receipt_date: string
              parent_receipt_merchant: string
              receipt_id: string
              score: number
              similarity: number
              text_score: number
            }[]
          }
        | {
            Args: {
              end_date?: string
              match_count?: number
              max_amount?: number
              min_amount?: number
              query_embedding: string
              query_text: string
              similarity_threshold?: number
              similarity_weight?: number
              start_date?: string
              text_weight?: number
            }
            Returns: {
              line_item_amount: number
              line_item_description: string
              line_item_id: string
              parent_receipt_date: string
              parent_receipt_merchant: string
              receipt_id: string
              score: number
              similarity: number
              text_score: number
            }[]
          }
      hybrid_search_receipts: {
        Args: {
          content_type?: string
          match_count?: number
          query_embedding: string
          search_text: string
          similarity_weight?: number
          text_weight?: number
        }
        Returns: {
          receipt_id: string
          score: number
        }[]
      }
      hybrid_temporal_semantic_search: {
        Args: {
          content_types?: string[]
          keyword_weight?: number
          match_count?: number
          query_embedding: string
          query_text: string
          receipt_ids: string[]
          semantic_weight?: number
          similarity_threshold?: number
          trigram_weight?: number
          user_filter: string
        }
        Returns: {
          combined_score: number
          content_text: string
          content_type: string
          id: string
          keyword_score: number
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
          trigram_similarity: number
        }[]
      }
      increment_batch_counter: {
        Args: { batch_uuid: string; field_name: string }
        Returns: undefined
      }
      invite_team_member: {
        Args: {
          _email: string
          _role?: Database["public"]["Enums"]["team_member_role"]
          _team_id: string
        }
        Returns: string
      }
      invite_team_member_enhanced: {
        Args: {
          _custom_message?: string
          _email: string
          _expires_in_days?: number
          _permissions?: Json
          _role?: Database["public"]["Enums"]["team_member_role"]
          _send_email?: boolean
          _team_id: string
        }
        Returns: Json
      }
      is_malaysian_public_holiday: {
        Args: { check_date: string; state_code?: string }
        Returns: Json
      }
      is_team_member: {
        Args: {
          _min_role?: Database["public"]["Enums"]["team_member_role"]
          _team_id: string
          _user_id?: string
        }
        Returns: boolean
      }
      is_team_owner: {
        Args: { _team_id: string; _user_id?: string }
        Returns: boolean
      }
      log_billing_event: {
        Args: {
          p_event_description?: string
          p_event_type: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
          p_stripe_event_id?: string
          p_stripe_payment_intent_id?: string
          p_stripe_subscription_id?: string
          p_triggered_by?: string
          p_user_id?: string
        }
        Returns: string
      }
      log_performance_metric: {
        Args: {
          p_context?: Json
          p_metric_name: string
          p_metric_type: string
          p_metric_unit: string
          p_metric_value: number
          p_user_id?: string
        }
        Returns: undefined
      }
      mark_all_notifications_read: {
        Args: { _team_id: string }
        Returns: number
      }
      mark_billing_reminder_sent: {
        Args: {
          p_error_message?: string
          p_schedule_id: string
          p_success: boolean
        }
        Returns: boolean
      }
      mark_notification_read: {
        Args: { _notification_id: string }
        Returns: boolean
      }
      migrate_receipt_embeddings_to_unified: {
        Args: never
        Returns: {
          error_count: number
          migrated_count: number
          skipped_count: number
          total_processed: number
        }[]
      }
      normalize_currency_code: {
        Args: { input_currency: string }
        Returns: string
      }
      parse_malaysian_address: { Args: { address_text: string }; Returns: Json }
      process_post_auth_invitation: {
        Args: {
          p_authentication_method: string
          p_browser_fingerprint?: string
          p_invitation_token: string
          p_user_id: string
        }
        Returns: Json
      }
      record_billing_health_check: {
        Args: {
          p_check_type: string
          p_details?: Json
          p_severity?: string
          p_status: string
        }
        Returns: string
      }
      record_embedding_metrics: {
        Args: {
          p_api_calls?: number
          p_api_tokens?: number
          p_content_length?: number
          p_content_types?: string[]
          p_end_time?: string
          p_error_message?: string
          p_error_type?: string
          p_model_used: string
          p_rate_limited?: boolean
          p_receipt_id: string
          p_start_time: string
          p_status?: string
          p_synthetic_content?: boolean
          p_team_id: string
          p_upload_context: string
          p_user_id: string
        }
        Returns: string
      }
      refresh_all_temporal_metadata: {
        Args: never
        Returns: {
          processing_time_ms: number
          updated_count: number
        }[]
      }
      refresh_malaysian_materialized_views: { Args: never; Returns: undefined }
      refresh_usage_stats_indexes: { Args: never; Returns: string }
      refresh_user_temporal_metadata: {
        Args: { p_user_id: string }
        Returns: {
          processing_time_ms: number
          updated_count: number
        }[]
      }
      reject_claim: {
        Args: { _claim_id: string; _rejection_reason: string }
        Returns: boolean
      }
      remove_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      remove_unified_embedding: {
        Args: {
          p_content_type?: string
          p_source_id: string
          p_source_type: string
        }
        Returns: number
      }
      rename_conversation: {
        Args: { p_conversation_id: string; p_new_title: string }
        Returns: boolean
      }
      reschedule_failed_email_reminder: {
        Args: {
          p_error_message?: string
          p_next_retry_at: string
          p_schedule_id: string
        }
        Returns: boolean
      }
      resend_team_invitation: {
        Args: {
          _custom_message?: string
          _extend_expiration?: boolean
          _invitation_id: string
          _new_expiration_days?: number
        }
        Returns: Json
      }
      reset_monthly_usage: { Args: never; Returns: undefined }
      save_conversation: {
        Args: {
          p_conversation_id: string
          p_is_archived?: boolean
          p_is_favorite?: boolean
          p_message_count?: number
          p_title: string
        }
        Returns: string
      }
      save_conversation_context: {
        Args: {
          p_context_data: Json
          p_context_type: string
          p_conversation_id: string
          p_expires_at?: string
          p_relevance_score?: number
        }
        Returns: string
      }
      save_conversation_memory: {
        Args: {
          p_confidence_score?: number
          p_memory_data: Json
          p_memory_key: string
          p_memory_type: string
          p_source_conversation_id?: string
        }
        Returns: string
      }
      save_conversation_message: {
        Args: {
          p_content: string
          p_conversation_id: string
          p_message_id: string
          p_message_type: string
          p_metadata?: Json
          p_parent_message_id?: string
        }
        Returns: string
      }
      schedule_billing_reminder: {
        Args: {
          p_language?: string
          p_reminder_type: string
          p_scheduled_for: string
          p_subscription_id: string
          p_template_data?: Json
          p_user_id: string
        }
        Returns: string
      }
      search_by_temporal_context: {
        Args: {
          p_is_weekend?: boolean
          p_limit?: number
          p_season?: string
          p_source_types?: string[]
          p_temporal_context?: string
          p_user_id: string
        }
        Returns: {
          content_text: string
          content_type: string
          days_ago: number
          id: string
          metadata: Json
          receipt_date: string
          source_id: string
          source_type: string
          temporal_context: string
        }[]
      }
      search_conversation_memory: {
        Args: { p_limit?: number; p_min_confidence?: number; p_query: string }
        Returns: {
          access_count: number
          confidence_score: number
          created_at: string
          id: string
          last_accessed: string
          memory_data: Json
          memory_key: string
          memory_type: string
          relevance_score: number
          source_conversations: string[]
          updated_at: string
        }[]
      }
      search_line_items: {
        Args: {
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          line_item_amount: number
          line_item_description: string
          line_item_id: string
          parent_receipt_date: string
          parent_receipt_merchant: string
          receipt_id: string
          similarity: number
        }[]
      }
      search_malaysian_business: {
        Args: { limit_results?: number; search_term: string }
        Returns: {
          business_name: string
          business_type: string
          confidence_score: number
          industry_category: string
          is_chain: boolean
          registration_number: string
        }[]
      }
      search_malaysian_business_optimized: {
        Args: {
          limit_results?: number
          search_term: string
          use_cache?: boolean
        }
        Returns: {
          business_name: string
          business_type: string
          confidence_score: number
          industry_category: string
          is_chain: boolean
          keywords: string[]
        }[]
      }
      search_receipts: {
        Args: {
          content_type?: string
          match_count?: number
          query_embedding: string
          similarity_threshold?: number
        }
        Returns: {
          id: string
          receipt_id: string
          similarity: number
        }[]
      }
      set_user_preference: {
        Args: {
          p_category: string
          p_confidence?: number
          p_key: string
          p_source?: string
          p_value: Json
        }
        Returns: string
      }
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_user_theme_config: {
        Args: {
          p_enable_transitions?: boolean
          p_persist_across_devices?: boolean
          p_sync_with_system?: boolean
          p_theme_mode?: string
          p_theme_variant?: string
        }
        Returns: string
      }
      setup_billing_cron_jobs: { Args: never; Returns: string }
      setup_embedding_metrics_cron_jobs: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      simple_hybrid_search: {
        Args: {
          match_count?: number
          query_text: string
          source_types?: string[]
          user_filter?: string
        }
        Returns: {
          content_text: string
          content_type: string
          id: string
          metadata: Json
          source_id: string
          source_type: string
          trigram_similarity: number
        }[]
      }
      submit_claim: { Args: { _claim_id: string }; Returns: boolean }
      submit_message_feedback: {
        Args: {
          p_conversation_id: string
          p_feedback_comment?: string
          p_feedback_type: string
          p_message_id: string
        }
        Returns: string
      }
      temporal_search_receipts: {
        Args: {
          amount_max?: number
          amount_min?: number
          date_range_end?: string
          date_range_start?: string
          days_ago_max?: number
          days_ago_min?: number
          is_weekend_filter?: boolean
          match_count?: number
          season_filter?: string
          temporal_context?: string
          user_filter: string
        }
        Returns: {
          content_text: string
          content_type: string
          days_ago_value: number
          id: string
          metadata: Json
          receipt_date: string
          similarity: number
          source_id: string
          source_type: string
          temporal_context_value: string
        }[]
      }
      toggle_conversation_archive: {
        Args: { p_conversation_id: string; p_is_archived: boolean }
        Returns: boolean
      }
      toggle_conversation_favorite: {
        Args: { p_conversation_id: string; p_is_favorite: boolean }
        Returns: boolean
      }
      track_invitation_delivery: {
        Args: {
          _delivery_status: string
          _error_message?: string
          _invitation_id: string
          _provider_message_id?: string
        }
        Returns: Json
      }
      track_invitation_engagement: {
        Args: {
          _engagement_type: string
          _invitation_token: string
          _metadata?: Json
        }
        Returns: Json
      }
      track_quality_improvements: {
        Args: { p_days_back?: number; p_user_id?: string }
        Returns: {
          avg_quality_score: number
          date_bucket: string
          enhanced_processing_rate: number
          synthetic_content_rate: number
          total_receipts: number
        }[]
      }
      track_theme_usage: {
        Args: {
          p_action?: string
          p_theme_mode: string
          p_theme_variant: string
        }
        Returns: undefined
      }
      track_user_interaction: {
        Args: {
          p_interaction_context: Json
          p_interaction_metadata?: Json
          p_interaction_type: string
          p_session_id?: string
        }
        Returns: string
      }
      trigger_all_embedding_aggregations: {
        Args: never
        Returns: {
          execution_time_ms: number
          message: string
          operation: string
          success: boolean
        }[]
      }
      unified_search: {
        Args: {
          content_types?: string[]
          end_date?: string
          language_filter?: string
          match_count?: number
          max_amount?: number
          min_amount?: number
          query_embedding: string
          similarity_threshold?: number
          source_types?: string[]
          start_date?: string
          team_filter?: string
          user_filter?: string
        }
        Returns: {
          content_text: string
          content_type: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
      update_billing_preferences: {
        Args: {
          p_auto_renewal_enabled?: boolean
          p_email_notifications_enabled?: boolean
          p_preferred_language?: string
          p_push_notifications_enabled?: boolean
          p_quiet_hours_end?: string
          p_quiet_hours_start?: string
          p_reminder_days_before_renewal?: number[]
          p_sms_notifications_enabled?: boolean
          p_timezone?: string
          p_user_id: string
        }
        Returns: string
      }
      update_chat_context:
        | {
            Args: {
              p_context_data?: Json
              p_conversation_id: string
              p_last_keywords?: Json
              p_last_results?: Json
              p_search_history?: Json
              p_user_preferences?: Json
            }
            Returns: boolean
          }
        | {
            Args: {
              p_context_data?: Json
              p_conversation_id: string
              p_last_keywords?: Json
              p_last_results?: Json
              p_search_history?: string[]
              p_user_preferences?: Json
            }
            Returns: boolean
          }
      update_custom_category: {
        Args: {
          p_category_id: string
          p_color?: string
          p_icon?: string
          p_name?: string
        }
        Returns: boolean
      }
      update_email_delivery_status:
        | {
            Args: {
              _delivery_id: string
              _error_message: string
              _provider_message_id: string
              _status: Database["public"]["Enums"]["email_delivery_status"]
            }
            Returns: boolean
          }
        | {
            Args: {
              p_delivery_id: string
              p_error_message?: string
              p_provider_message_id?: string
              p_status: string
            }
            Returns: boolean
          }
      update_embedding_metrics: {
        Args: {
          p_api_calls?: number
          p_api_tokens?: number
          p_end_time: string
          p_error_message?: string
          p_error_type?: string
          p_metric_id: string
          p_rate_limited?: boolean
          p_status: string
        }
        Returns: undefined
      }
      update_embedding_temporal_context: {
        Args: { p_embedding_id: string }
        Returns: boolean
      }
      update_line_item_embedding: {
        Args: { p_embedding: string; p_line_item_id: string }
        Returns: string
      }
      update_payer: {
        Args: { p_name: string; p_payer_id: string }
        Returns: boolean
      }
      update_processing_status_if_failed: {
        Args: { receipt_id: string }
        Returns: undefined
      }
      update_subscription_from_stripe: {
        Args: {
          _current_period_end: string
          _current_period_start: string
          _status: Database["public"]["Enums"]["subscription_status"]
          _stripe_customer_id: string
          _stripe_subscription_id: string
          _tier: Database["public"]["Enums"]["subscription_tier"]
          _trial_end?: string
        }
        Returns: undefined
      }
      update_subscription_renewal_tracking: {
        Args: {
          p_currency?: string
          p_current_period_end: string
          p_current_period_start: string
          p_current_price_id?: string
          p_current_tier: string
          p_renewal_amount?: number
          p_stripe_subscription_id: string
          p_user_id: string
        }
        Returns: string
      }
      update_team_member_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["team_member_role"]
          _team_id: string
          _user_id: string
        }
        Returns: boolean
      }
      update_user_behavioral_patterns: {
        Args: { p_user_id?: string }
        Returns: number
      }
      update_user_chat_preferences: {
        Args: {
          p_common_search_terms?: string[]
          p_frequent_merchants?: string[]
          p_notification_preferences?: Json
          p_preferred_response_style?: string
          p_search_filters?: Json
          p_ui_preferences?: Json
        }
        Returns: boolean
      }
      upsert_exchange_rate: {
        Args: {
          base_curr: string
          rate: number
          rate_dt?: string
          rate_source?: string
          target_curr: string
        }
        Returns: string
      }
      upsert_notification_preferences:
        | { Args: { _preferences: Json; _user_id: string }; Returns: string }
        | {
            Args: {
              p_browser_permission_granted?: boolean
              p_browser_permission_requested_at?: string
              p_daily_digest_enabled?: boolean
              p_digest_time?: string
              p_email_claim_approved?: boolean
              p_email_claim_rejected?: boolean
              p_email_claim_review_requested?: boolean
              p_email_claim_submitted?: boolean
              p_email_enabled?: boolean
              p_email_receipt_approved_by_team?: boolean
              p_email_receipt_batch_completed?: boolean
              p_email_receipt_batch_failed?: boolean
              p_email_receipt_comment_added?: boolean
              p_email_receipt_edited_by_team_member?: boolean
              p_email_receipt_flagged_for_review?: boolean
              p_email_receipt_processing_completed?: boolean
              p_email_receipt_processing_failed?: boolean
              p_email_receipt_processing_started?: boolean
              p_email_receipt_ready_for_review?: boolean
              p_email_receipt_shared?: boolean
              p_email_team_invitation_accepted?: boolean
              p_email_team_invitation_sent?: boolean
              p_email_team_member_joined?: boolean
              p_email_team_member_left?: boolean
              p_email_team_member_removed?: boolean
              p_email_team_member_role_changed?: boolean
              p_email_team_settings_updated?: boolean
              p_push_claim_approved?: boolean
              p_push_claim_rejected?: boolean
              p_push_claim_review_requested?: boolean
              p_push_claim_submitted?: boolean
              p_push_enabled?: boolean
              p_push_receipt_approved_by_team?: boolean
              p_push_receipt_batch_completed?: boolean
              p_push_receipt_batch_failed?: boolean
              p_push_receipt_comment_added?: boolean
              p_push_receipt_edited_by_team_member?: boolean
              p_push_receipt_flagged_for_review?: boolean
              p_push_receipt_processing_completed?: boolean
              p_push_receipt_processing_failed?: boolean
              p_push_receipt_processing_started?: boolean
              p_push_receipt_ready_for_review?: boolean
              p_push_receipt_shared?: boolean
              p_push_team_invitation_accepted?: boolean
              p_push_team_invitation_sent?: boolean
              p_push_team_member_joined?: boolean
              p_push_team_member_left?: boolean
              p_push_team_member_removed?: boolean
              p_push_team_member_role_changed?: boolean
              p_push_team_settings_updated?: boolean
              p_quiet_hours_enabled?: boolean
              p_quiet_hours_end?: string
              p_quiet_hours_start?: string
              p_timezone?: string
              p_user_id: string
              p_weekly_digest_enabled?: boolean
            }
            Returns: {
              browser_permission_granted: boolean | null
              browser_permission_requested_at: string | null
              created_at: string | null
              daily_digest_enabled: boolean | null
              digest_time: string | null
              email_billing_updates: boolean | null
              email_enabled: boolean | null
              email_receipt_batch_completed: boolean | null
              email_receipt_processing_completed: boolean | null
              email_receipt_processing_failed: boolean | null
              email_receipt_ready_for_review: boolean | null
              email_security_alerts: boolean | null
              email_team_activity: boolean | null
              email_team_invitations: boolean | null
              email_team_member_removed: boolean | null
              email_weekly_reports: boolean | null
              id: string
              push_enabled: boolean | null
              push_receipt_batch_completed: boolean | null
              push_receipt_comments: boolean | null
              push_receipt_processing_completed: boolean | null
              push_receipt_processing_failed: boolean | null
              push_receipt_ready_for_review: boolean | null
              push_receipt_shared: boolean | null
              push_team_activity: boolean | null
              push_team_invitations: boolean | null
              push_team_member_removed: boolean | null
              quiet_hours_enabled: boolean | null
              quiet_hours_end: string | null
              quiet_hours_start: string | null
              timezone: string | null
              updated_at: string | null
              user_id: string
              weekly_digest_enabled: boolean | null
            }
            SetofOptions: {
              from: "*"
              to: "notification_preferences"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      upsert_push_subscription: {
        Args: {
          _auth_key: string
          _endpoint: string
          _p256dh_key: string
          _user_agent?: string
          _user_id: string
        }
        Returns: string
      }
      validate_direct_invitation_acceptance: {
        Args: { p_invitation_token: string; p_user_id: string }
        Returns: Json
      }
      validate_malaysian_registration_number: {
        Args: { registration_number: string; registration_type?: string }
        Returns: Json
      }
      validate_notification_system_health: {
        Args: never
        Returns: {
          component: string
          details: string
          health_status: string
          recommendation: string
        }[]
      }
      validate_unified_search_setup: { Args: never; Returns: Json }
      webhook_trigger_embedding_aggregation: {
        Args: { aggregation_type?: string }
        Returns: Json
      }
    }
    Enums: {
      api_scope:
        | "receipts:read"
        | "receipts:write"
        | "receipts:delete"
        | "claims:read"
        | "claims:write"
        | "claims:delete"
        | "search:read"
        | "analytics:read"
        | "teams:read"
        | "admin:all"
      app_role: "admin" | "user"
      claim_priority: "low" | "medium" | "high" | "urgent"
      claim_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
        | "cancelled"
      email_delivery_status:
        | "pending"
        | "sent"
        | "delivered"
        | "failed"
        | "bounced"
        | "complained"
      invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "expired"
        | "cancelled"
      notification_priority: "low" | "medium" | "high"
      notification_type:
        | "team_invitation_sent"
        | "team_invitation_accepted"
        | "team_member_joined"
        | "team_member_left"
        | "team_member_role_changed"
        | "claim_submitted"
        | "claim_approved"
        | "claim_rejected"
        | "claim_review_requested"
        | "team_settings_updated"
        | "receipt_processing_started"
        | "receipt_processing_completed"
        | "receipt_processing_failed"
        | "receipt_ready_for_review"
        | "receipt_batch_completed"
        | "receipt_batch_failed"
        | "receipt_shared"
        | "receipt_comment_added"
        | "receipt_edited_by_team_member"
        | "receipt_approved_by_team"
        | "receipt_flagged_for_review"
        | "team_member_removed"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid"
      subscription_tier: "free" | "pro" | "max"
      team_member_role: "owner" | "admin" | "member" | "viewer"
      team_status: "active" | "suspended" | "archived"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
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
      api_scope: [
        "receipts:read",
        "receipts:write",
        "receipts:delete",
        "claims:read",
        "claims:write",
        "claims:delete",
        "search:read",
        "analytics:read",
        "teams:read",
        "admin:all",
      ],
      app_role: ["admin", "user"],
      claim_priority: ["low", "medium", "high", "urgent"],
      claim_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
        "cancelled",
      ],
      email_delivery_status: [
        "pending",
        "sent",
        "delivered",
        "failed",
        "bounced",
        "complained",
      ],
      invitation_status: [
        "pending",
        "accepted",
        "declined",
        "expired",
        "cancelled",
      ],
      notification_priority: ["low", "medium", "high"],
      notification_type: [
        "team_invitation_sent",
        "team_invitation_accepted",
        "team_member_joined",
        "team_member_left",
        "team_member_role_changed",
        "claim_submitted",
        "claim_approved",
        "claim_rejected",
        "claim_review_requested",
        "team_settings_updated",
        "receipt_processing_started",
        "receipt_processing_completed",
        "receipt_processing_failed",
        "receipt_ready_for_review",
        "receipt_batch_completed",
        "receipt_batch_failed",
        "receipt_shared",
        "receipt_comment_added",
        "receipt_edited_by_team_member",
        "receipt_approved_by_team",
        "receipt_flagged_for_review",
        "team_member_removed",
      ],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
      ],
      subscription_tier: ["free", "pro", "max"],
      team_member_role: ["owner", "admin", "member", "viewer"],
      team_status: ["active", "suspended", "archived"],
    },
  },
} as const
