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
      admin_commentator_prefs: {
        Row: {
          admin_user_id: string
          created_at: string
          hidden: boolean
          id: string
          name_key: string
          sort_index: number | null
          updated_at: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          hidden?: boolean
          id?: string
          name_key: string
          sort_index?: number | null
          updated_at?: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          hidden?: boolean
          id?: string
          name_key?: string
          sort_index?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string | null
          fn_name: string
          hit_count: number
          model: string | null
          payload: Json
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string | null
          fn_name: string
          hit_count?: number
          model?: string | null
          payload: Json
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string | null
          fn_name?: string
          hit_count?: number
          model?: string | null
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ai_chat_usage: {
        Row: {
          created_at: string
          environment: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_daily_searches: {
        Row: {
          count: number
          day: string
        }
        Insert: {
          count?: number
          day: string
        }
        Update: {
          count?: number
          day?: string
        }
        Relationships: []
      }
      analytics_section_opens: {
        Row: {
          count: number
          last_seen: string
          section_key: string
          section_type: string
        }
        Insert: {
          count?: number
          last_seen?: string
          section_key: string
          section_type: string
        }
        Update: {
          count?: number
          last_seen?: string
          section_key?: string
          section_type?: string
        }
        Relationships: []
      }
      analytics_theme_searches: {
        Row: {
          count: number
          first_seen: string
          last_seen: string
          theme_key: string
        }
        Insert: {
          count?: number
          first_seen?: string
          last_seen?: string
          theme_key: string
        }
        Update: {
          count?: number
          first_seen?: string
          last_seen?: string
          theme_key?: string
        }
        Relationships: []
      }
      analytics_verse_searches: {
        Row: {
          count: number
          first_seen: string
          last_seen: string
          reference_key: string
        }
        Insert: {
          count?: number
          first_seen?: string
          last_seen?: string
          reference_key: string
        }
        Update: {
          count?: number
          first_seen?: string
          last_seen?: string
          reference_key?: string
        }
        Relationships: []
      }
      auth_event_log: {
        Row: {
          created_at: string
          email: string | null
          event_type: string
          id: string
          ip: string | null
          method: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          event_type: string
          id?: string
          ip?: string | null
          method: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          event_type?: string
          id?: string
          ip?: string | null
          method?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bible_verses: {
        Row: {
          book: string
          chapter: number
          created_at: string
          id: string
          text: string
          translation_code: string
          verse: number
        }
        Insert: {
          book: string
          chapter: number
          created_at?: string
          id?: string
          text: string
          translation_code: string
          verse: number
        }
        Update: {
          book?: string
          chapter?: number
          created_at?: string
          id?: string
          text?: string
          translation_code?: string
          verse?: number
        }
        Relationships: []
      }
      blog_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_translations: {
        Row: {
          content: string
          created_at: string
          description: string
          id: string
          language_code: string
          post_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          description?: string
          id?: string
          language_code: string
          post_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string
          id?: string
          language_code?: string
          post_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          content: string
          created_at: string
          description: string
          id: string
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          description?: string
          id?: string
          published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string
          id?: string
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bonus_lookups: {
        Row: {
          id: string
          reference: string
          used_at: string
          user_id: string
        }
        Insert: {
          id?: string
          reference: string
          used_at?: string
          user_id: string
        }
        Update: {
          id?: string
          reference?: string
          used_at?: string
          user_id?: string
        }
        Relationships: []
      }
      commentator_audit_log: {
        Row: {
          duplicates_found: number
          duplicates_merged: number
          id: string
          manual_issues: Json
          missing_portraits: number
          notes: string | null
          orphaned_removed: number
          ran_at: string
          source: string
        }
        Insert: {
          duplicates_found?: number
          duplicates_merged?: number
          id?: string
          manual_issues?: Json
          missing_portraits?: number
          notes?: string | null
          orphaned_removed?: number
          ran_at?: string
          source?: string
        }
        Update: {
          duplicates_found?: number
          duplicates_merged?: number
          id?: string
          manual_issues?: Json
          missing_portraits?: number
          notes?: string | null
          orphaned_removed?: number
          ran_at?: string
          source?: string
        }
        Relationships: []
      }
      commentator_blocks: {
        Row: {
          blocked_at: string
          blocked_by: string | null
          display_name: string
          id: string
          name_key: string
        }
        Insert: {
          blocked_at?: string
          blocked_by?: string | null
          display_name: string
          id?: string
          name_key: string
        }
        Update: {
          blocked_at?: string
          blocked_by?: string | null
          display_name?: string
          id?: string
          name_key?: string
        }
        Relationships: []
      }
      commentator_categories: {
        Row: {
          category_type: string
          created_at: string
          id: string
          label: string | null
          value: string
        }
        Insert: {
          category_type: string
          created_at?: string
          id?: string
          label?: string | null
          value: string
        }
        Update: {
          category_type?: string
          created_at?: string
          id?: string
          label?: string | null
          value?: string
        }
        Relationships: []
      }
      commentator_lookup_history: {
        Row: {
          ever_used: string[]
          last_authors: string[]
          scope_key: string
          updated_at: string
        }
        Insert: {
          ever_used?: string[]
          last_authors?: string[]
          scope_key: string
          updated_at?: string
        }
        Update: {
          ever_used?: string[]
          last_authors?: string[]
          scope_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      commentator_overrides: {
        Row: {
          birth_year: number | null
          country: string | null
          created_at: string
          death_year: number | null
          denomination: string | null
          display_name: string
          gender: string | null
          id: string
          is_hidden: boolean
          is_manual: boolean
          is_primary: boolean
          last_used_at: string | null
          name_key: string
          portrait_url: string | null
          publication_era: string | null
          region: string | null
          tradition: string | null
          updated_at: string
          usage_count: number
          worldview: string | null
        }
        Insert: {
          birth_year?: number | null
          country?: string | null
          created_at?: string
          death_year?: number | null
          denomination?: string | null
          display_name: string
          gender?: string | null
          id?: string
          is_hidden?: boolean
          is_manual?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          name_key: string
          portrait_url?: string | null
          publication_era?: string | null
          region?: string | null
          tradition?: string | null
          updated_at?: string
          usage_count?: number
          worldview?: string | null
        }
        Update: {
          birth_year?: number | null
          country?: string | null
          created_at?: string
          death_year?: number | null
          denomination?: string | null
          display_name?: string
          gender?: string | null
          id?: string
          is_hidden?: boolean
          is_manual?: boolean
          is_primary?: boolean
          last_used_at?: string | null
          name_key?: string
          portrait_url?: string | null
          publication_era?: string | null
          region?: string | null
          tradition?: string | null
          updated_at?: string
          usage_count?: number
          worldview?: string | null
        }
        Relationships: []
      }
      country_client_first_seen: {
        Row: {
          client_id: string
          country: string
          first_seen: string
        }
        Insert: {
          client_id: string
          country: string
          first_seen?: string
        }
        Update: {
          client_id?: string
          country?: string
          first_seen?: string
        }
        Relationships: []
      }
      country_visits_daily: {
        Row: {
          count: number
          country: string
          day: string
        }
        Insert: {
          count?: number
          country: string
          day: string
        }
        Update: {
          count?: number
          country?: string
          day?: string
        }
        Relationships: []
      }
      country_visits_log: {
        Row: {
          client_id: string
          country: string
          created_at: string
          day: string
        }
        Insert: {
          client_id: string
          country: string
          created_at?: string
          day: string
        }
        Update: {
          client_id?: string
          country?: string
          created_at?: string
          day?: string
        }
        Relationships: []
      }
      country_visits_total: {
        Row: {
          country: string
          first_seen: string
          last_seen: string
          total: number
        }
        Insert: {
          country: string
          first_seen?: string
          last_seen?: string
          total?: number
        }
        Update: {
          country?: string
          first_seen?: string
          last_seen?: string
          total?: number
        }
        Relationships: []
      }
      daily_usage: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          reference_key: string
          usage_date: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          reference_key: string
          usage_date?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          reference_key?: string
          usage_date?: string
          user_id?: string | null
        }
        Relationships: []
      }
      deleted_commentators: {
        Row: {
          deleted_at: string
          display_name: string
          name_key: string
        }
        Insert: {
          deleted_at?: string
          display_name: string
          name_key: string
        }
        Update: {
          deleted_at?: string
          display_name?: string
          name_key?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          email: string | null
          id: string
          message: string
          name: string | null
          user_agent: string | null
        }
        Insert: {
          category: string
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name?: string | null
          user_agent?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          used_at?: string | null
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          id: string
          reference: string
          translation: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reference: string
          translation: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reference?: string
          translation?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      testers: {
        Row: {
          added_by: string | null
          created_at: string
          expires_at: string
          id: string
          is_tester: boolean
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          expires_at: string
          id?: string
          is_tester?: boolean
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_tester?: boolean
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verse_cache: {
        Row: {
          created_at: string
          id: string
          payload: Json
          reference: string
          slug: string
          translation: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
          reference: string
          slug: string
          translation: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          reference?: string
          slug?: string
          translation?: string
          updated_at?: string
        }
        Relationships: []
      }
      votd_overrides: {
        Row: {
          day_of_year: number
          excerpt: string
          fear_power_summary: string | null
          guilt_innocence_summary: string | null
          reference: string
          shame_honour_summary: string | null
          updated_at: string
        }
        Insert: {
          day_of_year: number
          excerpt: string
          fear_power_summary?: string | null
          guilt_innocence_summary?: string | null
          reference: string
          shame_honour_summary?: string | null
          updated_at?: string
        }
        Update: {
          day_of_year?: number
          excerpt?: string
          fear_power_summary?: string | null
          guilt_innocence_summary?: string | null
          reference?: string
          shame_honour_summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      votd_settings: {
        Row: {
          enabled: boolean
          id: number
          override_date: string | null
          override_excerpt: string | null
          override_fear_power: string | null
          override_guilt_innocence: string | null
          override_reference: string | null
          override_shame_honour: string | null
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          id?: number
          override_date?: string | null
          override_excerpt?: string | null
          override_fear_power?: string | null
          override_guilt_innocence?: string | null
          override_reference?: string | null
          override_shame_honour?: string | null
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          id?: number
          override_date?: string | null
          override_excerpt?: string | null
          override_fear_power?: string | null
          override_guilt_innocence?: string | null
          override_reference?: string | null
          override_shame_honour?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_commentator_audit: { Args: { p_source?: string }; Returns: string }
      admin_country_daily: {
        Args: { p_days?: number }
        Returns: {
          count: number
          country: string
          day: string
        }[]
      }
      admin_country_totals: {
        Args: never
        Returns: {
          country: string
          last_seen: string
          total: number
        }[]
      }
      admin_feature_usage: {
        Args: never
        Returns: {
          count: number
          feature: string
        }[]
      }
      admin_funnel: {
        Args: never
        Returns: {
          count: number
          stage: string
        }[]
      }
      admin_retention_curve: {
        Args: never
        Returns: {
          cohort_size: number
          day_offset: number
          retained: number
        }[]
      }
      admin_search_heatmap: {
        Args: never
        Returns: {
          count: number
          dow: number
          hour: number
        }[]
      }
      admin_searches_by_tier: {
        Args: never
        Returns: {
          count: number
          tier: string
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      increment_commentator_usage: {
        Args: { p_names: string[] }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_commentator_name: { Args: { p: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_country_visit: {
        Args: { p_client_id: string; p_country: string }
        Returns: undefined
      }
      track_section_open: {
        Args: { p_key: string; p_type: string }
        Returns: undefined
      }
      track_theme_search: { Args: { p_query: string }; Returns: undefined }
      track_verse_search: { Args: { p_reference: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
