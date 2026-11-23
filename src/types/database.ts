export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json }
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
      account_deletion_requests: {
        Row: {
          requested_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          requested_at?: string
          user_id: string
        }
        Update: {
          requested_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          owner_id: string
          summary: string
        }
        ComputedFields: never
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: never
          owner_id?: string
          summary: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: never
          owner_id?: string
          summary?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          bill_no: number
          created_at: string
          generated_at: string
          id: string
          image_path: string
          image_purged_at: string | null
          items_hash: string
          order_id: string
          owner_id: string
          revision: number
          total_at_generation: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          bill_no: number
          created_at?: string
          generated_at?: string
          id?: string
          image_path: string
          image_purged_at?: string | null
          items_hash: string
          order_id: string
          owner_id?: string
          revision?: number
          total_at_generation: number
          updated_at?: string
        }
        Update: {
          bill_no?: number
          created_at?: string
          generated_at?: string
          id?: string
          image_path?: string
          image_purged_at?: string | null
          items_hash?: string
          order_id?: string
          owner_id?: string
          revision?: number
          total_at_generation?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bills_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          area: string | null
          city: string
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          line1: string
          line2: string | null
          name: string
          phone: string
          pincode: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          area?: string | null
          city: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1: string
          line2?: string | null
          name: string
          phone: string
          pincode: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          area?: string | null
          city?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          line1?: string
          line2?: string | null
          name?: string
          phone?: string
          pincode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          created_at: string
          name: string
          phone: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          name: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          counts: NonNullable<Json>
          created_at: string
          created_category_ids: string[]
          created_product_ids: string[]
          created_variant_ids: string[]
          file_name: string
          id: string
          mode: string
          owner_id: string
          previous_variants: NonNullable<Json>
          undone_at: string | null
        }
        ComputedFields: never
        Insert: {
          counts?: NonNullable<Json>
          created_at?: string
          created_category_ids?: string[]
          created_product_ids?: string[]
          created_variant_ids?: string[]
          file_name?: string
          id?: string
          mode: string
          owner_id?: string
          previous_variants?: NonNullable<Json>
          undone_at?: string | null
        }
        Update: {
          counts?: NonNullable<Json>
          created_at?: string
          created_category_ids?: string[]
          created_product_ids?: string[]
          created_variant_ids?: string[]
          file_name?: string
          id?: string
          mode?: string
          owner_id?: string
          previous_variants?: NonNullable<Json>
          undone_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          cost_price: number | null
          created_at: string
          id: string
          line_total: number | null
          list_price: number | null
          offer_label: string | null
          order_id: string
          owner_id: string
          position: number
          product_name: string
          quantity: number
          size_amount: number | null
          size_unit: Database['public']['Enums']['size_unit'] | null
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_name: string
          item_size: Record<string, unknown> | null
        }
        ComputedFields: 'item_size'
        Insert: {
          cost_price?: number | null
          created_at?: string
          id?: string
          line_total?: never
          list_price?: number | null
          offer_label?: string | null
          order_id: string
          owner_id?: string
          position?: number
          product_name: string
          quantity: number
          size_amount?: number | null
          size_unit?: Database['public']['Enums']['size_unit'] | null
          unit_price: number
          updated_at?: string
          variant_id?: string | null
          variant_name: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          id?: string
          line_total?: never
          list_price?: number | null
          offer_label?: string | null
          order_id?: string
          owner_id?: string
          position?: number
          product_name?: string
          quantity?: number
          size_amount?: number | null
          size_unit?: Database['public']['Enums']['size_unit'] | null
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_variant_id_fkey'
            columns: ['variant_id']
            isOneToOne: false
            referencedRelation: 'variants'
            referencedColumns: ['id']
          },
        ]
      }
      order_versions: {
        Row: {
          created_at: string
          id: string
          order_id: string
          owner_id: string
          reason: string
          snapshot: NonNullable<Json>
          summary: string | null
          version_no: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          owner_id?: string
          reason: string
          snapshot: NonNullable<Json>
          summary?: string | null
          version_no: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          owner_id?: string
          reason?: string
          snapshot?: NonNullable<Json>
          summary?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: 'order_versions_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        ComputedFields: never
        Insert: {
          bill_no?: number | null
          bill_prefix?: string | null
          cancelled_at?: string | null
          cancelled_from?: Database['public']['Enums']['order_status'] | null
          claim_count?: number
          client_key?: string | null
          confirmation_status?: string
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          customer_user_id?: string | null
          decline_reason?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          delivery_fee?: number
          discount?: number
          due_date?: string | null
          fulfilment?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_date?: string
          order_no?: number
          owner_id?: string
          paid_at?: string | null
          payment_claim_status?: string
          payment_claimed_at?: string | null
          payment_method?: string | null
          payment_mode?: Database['public']['Enums']['payment_mode'] | null
          payment_reference?: string | null
          payment_reject_reason?: string | null
          payment_status?: Database['public']['Enums']['payment_status']
          payment_verified_at?: string | null
          ready_at?: string | null
          source?: string
          status?: Database['public']['Enums']['order_status']
          total?: number
          updated_at?: string
          version_no?: number
        }
        Update: {
          bill_no?: number | null
          bill_prefix?: string | null
          cancelled_at?: string | null
          cancelled_from?: Database['public']['Enums']['order_status'] | null
          claim_count?: number
          client_key?: string | null
          confirmation_status?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          customer_user_id?: string | null
          decline_reason?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivery_address?: Json | null
          delivery_fee?: number
          discount?: number
          due_date?: string | null
          fulfilment?: string | null
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          order_date?: string
          order_no?: number
          owner_id?: string
          paid_at?: string | null
          payment_claim_status?: string
          payment_claimed_at?: string | null
          payment_method?: string | null
          payment_mode?: Database['public']['Enums']['payment_mode'] | null
          payment_reference?: string | null
          payment_reject_reason?: string | null
          payment_status?: Database['public']['Enums']['payment_status']
          payment_verified_at?: string | null
          ready_at?: string | null
          source?: string
          status?: Database['public']['Enums']['order_status']
          total?: number
          updated_at?: string
          version_no?: number
        }
        Relationships: []
      }
      plan_limits: {
        Row: {
          bill_keep_days: number | null
          orders_limit: number | null
          orders_scope: string
          period_days: number
          price_paise: number
          pro_features: boolean
          products_limit: number | null
          storage_bytes: number | null
          tier: string
        }
        ComputedFields: never
        Insert: {
          bill_keep_days?: number | null
          orders_limit?: number | null
          orders_scope: string
          period_days: number
          price_paise: number
          pro_features: boolean
          products_limit?: number | null
          storage_bytes?: number | null
          tier: string
        }
        Update: {
          bill_keep_days?: number | null
          orders_limit?: number | null
          orders_scope?: string
          period_days?: number
          price_paise?: number
          pro_features?: boolean
          products_limit?: number | null
          storage_bytes?: number | null
          tier?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        ComputedFields: never
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          allergens: string[]
          category_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          image_paths: string[]
          ingredients: string | null
          is_active: boolean
          is_available: boolean
          name: string
          nutrition: Json | null
          owner_id: string
          shelf_life: string | null
          sort_order: number
          updated_at: string
          veg_type: string | null
        }
        ComputedFields: never
        Insert: {
          allergens?: string[]
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_paths?: string[]
          ingredients?: string | null
          is_active?: boolean
          is_available?: boolean
          name: string
          nutrition?: Json | null
          owner_id?: string
          shelf_life?: string | null
          sort_order?: number
          updated_at?: string
          veg_type?: string | null
        }
        Update: {
          allergens?: string[]
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_paths?: string[]
          ingredients?: string | null
          is_active?: boolean
          is_available?: boolean
          name?: string
          nutrition?: Json | null
          owner_id?: string
          shelf_life?: string | null
          sort_order?: number
          updated_at?: string
          veg_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      settings: {
        Row: {
          bill_footer: string | null
          bill_prefix: string
          created_at: string
          default_country_code: string
          id: string
          last_backup_at: string | null
          logo_path: string | null
          next_bill_no: number
          owner_id: string
          payee_name: string | null
          qr_path: string | null
          shop_address: string
          shop_name: string
          shop_phone: string
          timezone: string
          updated_at: string
          upi_id: string | null
          use_dynamic_qr: boolean
        }
        ComputedFields: never
        Insert: {
          bill_footer?: string | null
          bill_prefix?: string
          created_at?: string
          default_country_code?: string
          id?: string
          last_backup_at?: string | null
          logo_path?: string | null
          next_bill_no?: number
          owner_id?: string
          payee_name?: string | null
          qr_path?: string | null
          shop_address?: string
          shop_name?: string
          shop_phone?: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
          use_dynamic_qr?: boolean
        }
        Update: {
          bill_footer?: string | null
          bill_prefix?: string
          created_at?: string
          default_country_code?: string
          id?: string
          last_backup_at?: string | null
          logo_path?: string | null
          next_bill_no?: number
          owner_id?: string
          payee_name?: string | null
          qr_path?: string | null
          shop_address?: string
          shop_name?: string
          shop_phone?: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
          use_dynamic_qr?: boolean
        }
        Relationships: []
      }
      shop_customers: {
        Row: {
          customer_name: string
          customer_phone: string
          customer_user_id: string
          first_order_at: string
          is_blocked: boolean
          last_order_at: string
          order_count: number
          owner_id: string
          owner_note: string | null
        }
        ComputedFields: never
        Insert: {
          customer_name: string
          customer_phone: string
          customer_user_id: string
          first_order_at?: string
          is_blocked?: boolean
          last_order_at?: string
          order_count?: number
          owner_id: string
          owner_note?: string | null
        }
        Update: {
          customer_name?: string
          customer_phone?: string
          customer_user_id?: string
          first_order_at?: string
          is_blocked?: boolean
          last_order_at?: string
          order_count?: number
          owner_id?: string
          owner_note?: string | null
        }
        Relationships: []
      }
      shop_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          note: string | null
          used_at: string | null
          used_by: string | null
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      shops: {
        Row: {
          accepts_orders: boolean
          banner_text: string | null
          city: string | null
          closed_message: string | null
          created_at: string
          deleted_at: string | null
          delivery_fee: number
          delivery_mode: string
          delivery_note: string | null
          ever_published: boolean
          free_delivery_above: number | null
          fssai_no: string | null
          id: string
          is_published: boolean
          lead_time_hours: number
          logo_path: string | null
          min_order: number
          owner_id: string
          pay_cod: boolean
          pay_upi: boolean
          slug: string
          tagline: string | null
          updated_at: string
          whatsapp: string | null
        }
        ComputedFields: never
        Insert: {
          accepts_orders?: boolean
          banner_text?: string | null
          city?: string | null
          closed_message?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_fee?: number
          delivery_mode?: string
          delivery_note?: string | null
          ever_published?: boolean
          free_delivery_above?: number | null
          fssai_no?: string | null
          id?: string
          is_published?: boolean
          lead_time_hours?: number
          logo_path?: string | null
          min_order?: number
          owner_id?: string
          pay_cod?: boolean
          pay_upi?: boolean
          slug: string
          tagline?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accepts_orders?: boolean
          banner_text?: string | null
          city?: string | null
          closed_message?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_fee?: number
          delivery_mode?: string
          delivery_note?: string | null
          ever_published?: boolean
          free_delivery_above?: number | null
          fssai_no?: string | null
          id?: string
          is_published?: boolean
          lead_time_hours?: number
          logo_path?: string | null
          min_order?: number
          owner_id?: string
          pay_cod?: boolean
          pay_upi?: boolean
          slug?: string
          tagline?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          amount_paise: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          owner_id: string
          ref_code: string
          reject_reason: string | null
          resulting_ends_at: string | null
          status: string
          tier: string
          utr: string | null
        }
        ComputedFields: never
        Insert: {
          amount_paise: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          owner_id: string
          ref_code: string
          reject_reason?: string | null
          resulting_ends_at?: string | null
          status?: string
          tier: string
          utr?: string | null
        }
        Update: {
          amount_paise?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          owner_id?: string
          ref_code?: string
          reject_reason?: string | null
          resulting_ends_at?: string | null
          status?: string
          tier?: string
          utr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subscription_requests_tier_fkey'
            columns: ['tier']
            isOneToOne: false
            referencedRelation: 'plan_limits'
            referencedColumns: ['tier']
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          ends_at: string
          owner_id: string
          started_at: string
          terms_accepted_at: string | null
          terms_version: string | null
          tier: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          ends_at: string
          owner_id: string
          started_at?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          owner_id?: string
          started_at?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_tier_fkey'
            columns: ['tier']
            isOneToOne: false
            referencedRelation: 'plan_limits'
            referencedColumns: ['tier']
          },
        ]
      }
      variants: {
        Row: {
          cost_price: number | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          offer_ends_at: string | null
          offer_label: string | null
          offer_price: number | null
          offer_starts_at: string | null
          owner_id: string
          price: number
          product_id: string
          size_amount: number | null
          size_unit: Database['public']['Enums']['size_unit'] | null
          sort_order: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          offer_ends_at?: string | null
          offer_label?: string | null
          offer_price?: number | null
          offer_starts_at?: string | null
          owner_id?: string
          price: number
          product_id: string
          size_amount?: number | null
          size_unit?: Database['public']['Enums']['size_unit'] | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          offer_ends_at?: string | null
          offer_label?: string | null
          offer_price?: number | null
          offer_starts_at?: string | null
          owner_id?: string
          price?: number
          product_id?: string
          size_amount?: number | null
          size_unit?: Database['public']['Enums']['size_unit'] | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'variants_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_invite: { Args: { p_note?: string }; Returns: string }
      admin_decide_request: {
        Args: { p_approve: boolean; p_id: string; p_reason?: string }
        Returns: {
          amount_paise: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          owner_id: string
          ref_code: string
          reject_reason: string | null
          resulting_ends_at: string | null
          status: string
          tier: string
          utr: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'subscription_requests'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_requests: {
        Args: { p_status?: string }
        Returns: {
          amount_paise: number
          created_at: string
          current_ends_at: string
          current_tier: string
          decided_at: string
          email: string
          id: string
          owner_id: string
          ref_code: string
          reject_reason: string
          shop_name: string
          status: string
          tier: string
          utr: string
        }[]
      }
      admin_set_config: { Args: { p_key: string; p_value: string }; Returns: undefined }
      admin_stats: { Args: Record<PropertyKey, never>; Returns: Json }
      analytics_month: { Args: { p_month: string }; Returns: Json }
      apply_product_import: { Args: { p: Json }; Returns: Json }
      bill_content_hash: { Args: { p_order: string }; Returns: string }
      bill_files_to_purge: {
        Args: Record<PropertyKey, never>
        Returns: {
          bill_id: string
          path: string
        }[]
      }
      bulk_offer: { Args: { p: Json }; Returns: number }
      cancel_my_order: { Args: { p_order_id: string }; Returns: Json }
      cancel_subscription_request: { Args: Record<PropertyKey, never>; Returns: undefined }
      check_order_rules: { Args: { p_order: string }; Returns: undefined }
      claim_payment: { Args: { p_order_id: string; p_utr?: string }; Returns: Json }
      compute_order_total: { Args: { p_discount: number; p_order: string }; Returns: number }
      confirm_order: {
        Args: { p_id: string; p_note: string; v: number }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_order: {
        Args: { p: Json }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_shop: { Args: { p_invite: string; p_name: string; p_slug: string }; Returns: Json }
      customer_order_get: { Args: { p_order_id: string }; Returns: Json }
      customer_orders_list: {
        Args: { p_before?: string; p_limit?: number; p_slug: string }
        Returns: Json
      }
      decline_order: { Args: { p_id: string; p_reason: string; v: number }; Returns: Json }
      delete_address: { Args: { p_id: string }; Returns: undefined }
      effective_price: {
        Args: {
          p_at?: string
          p_variant: Omit<
            Database['public']['Tables']['variants']['Row'],
            Database['public']['Tables']['variants']['ComputedFields']
          >
        }
        Returns: number
      }
      end_offers: { Args: { p_variant_ids: string[] }; Returns: number }
      export_my_data: { Args: Record<PropertyKey, never>; Returns: Json }
      export_orders_csv_rows: {
        Args: { p_month: string }
        Returns: {
          bill_no: number
          bill_prefix: string
          customer_name: string
          customer_phone: string
          delivered_at: string
          discount: number
          items: string
          order_date: string
          order_no: number
          paid_at: string
          payment_mode: Database['public']['Enums']['payment_mode']
          payment_status: Database['public']['Enums']['payment_status']
          total: number
          units: number
        }[]
      }
      import_insert_variant: {
        Args: { p_pos: number; p_product: string; p_variant: Json }
        Returns: string
      }
      init_settings: {
        Args: Record<PropertyKey, never>
        Returns: {
          bill_footer: string | null
          bill_prefix: string
          created_at: string
          default_country_code: string
          id: string
          last_backup_at: string | null
          logo_path: string | null
          next_bill_no: number
          owner_id: string
          payee_name: string | null
          qr_path: string | null
          shop_address: string
          shop_name: string
          shop_phone: string
          timezone: string
          updated_at: string
          upi_id: string | null
          use_dynamic_qr: boolean
        }
        SetofOptions: {
          from: '*'
          to: 'settings'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      item_size: {
        Args: {
          p_item: Omit<
            Database['public']['Tables']['order_items']['Row'],
            Database['public']['Tables']['order_items']['ComputedFields']
          >
        }
        Returns: Record<string, unknown>
      }
      list_order_versions: {
        Args: { p_order: string }
        Returns: {
          created_at: string
          reason: string
          snapshot: Json
          summary: string
          version_no: number
        }[]
      }
      mark_bills_purged: { Args: { p_paths: string[] }; Returns: number }
      month_window: { Args: { p_month: string }; Returns: Record<string, unknown> }
      my_context: { Args: Record<PropertyKey, never>; Returns: Json }
      my_customers: { Args: Record<PropertyKey, never>; Returns: Json }
      my_plan: { Args: Record<PropertyKey, never>; Returns: Json }
      next_bill_no: { Args: Record<PropertyKey, never>; Returns: number }
      next_order_no: { Args: Record<PropertyKey, never>; Returns: number }
      normalize_phone: { Args: { p: string }; Returns: string }
      order_snapshot: { Args: { p_order: string }; Returns: Json }
      order_version_snapshot: { Args: { p_order: string }; Returns: Json }
      order_version_state: { Args: { p_order: string; p_version: number }; Returns: Json }
      pending_payments: {
        Args: Record<PropertyKey, never>
        Returns: {
          age_days: number
          bill_no: number
          bucket: string
          customer_name: string
          customer_phone: string
          delivered_at: string
          id: string
          order_no: number
          total: number
        }[]
      }
      ping: { Args: Record<PropertyKey, never>; Returns: number }
      place_order: { Args: { p: Json }; Returns: Json }
      prep_list: { Args: Record<PropertyKey, never>; Returns: Json }
      prune_audit_log: { Args: { p_months?: number }; Returns: number }
      prune_order_history: { Args: { p_days?: number; p_keep_last?: number }; Returns: number }
      record_order_version: {
        Args: { p_order: string; p_reason: string; p_summary: string }
        Returns: undefined
      }
      register_bill_revision: {
        Args: { p_hash: string; p_order: string; p_path: string }
        Returns: {
          bill_no: number
          created_at: string
          generated_at: string
          id: string
          image_path: string
          image_purged_at: string | null
          items_hash: string
          order_id: string
          owner_id: string
          revision: number
          total_at_generation: number
          updated_at: string
        }
        SetofOptions: {
          from: '*'
          to: 'bills'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      register_customer: { Args: { p_name: string; p_phone: string }; Returns: Json }
      reject_payment: { Args: { p_id: string; p_reason: string; v: number }; Returns: Json }
      reorder_categories: { Args: { p_ids: string[] }; Returns: undefined }
      replace_order_items: { Args: { p_items: Json; p_order: string }; Returns: undefined }
      request_account_deletion: { Args: Record<PropertyKey, never>; Returns: undefined }
      request_subscription: {
        Args: { p_tier: string; p_utr?: string }
        Returns: {
          amount_paise: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          owner_id: string
          ref_code: string
          reject_reason: string | null
          resulting_ends_at: string | null
          status: string
          tier: string
          utr: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'subscription_requests'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_bill_number: { Args: { p_order: string }; Returns: Json }
      restore_category: { Args: { p_id: string }; Returns: undefined }
      restore_order: {
        Args: { p_id: string }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      restore_product: { Args: { p_id: string }; Returns: undefined }
      restore_variant: { Args: { p_id: string }; Returns: undefined }
      rollback_order: {
        Args: { p_id: string; p_target: number; p_version: number }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_customer_block: { Args: { p_blocked: boolean; p_customer: string }; Returns: undefined }
      set_order_status: {
        Args: {
          p_id: string
          p_status: Database['public']['Enums']['order_status']
          p_version: number
        }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_payment: {
        Args: {
          p_id: string
          p_mode: Database['public']['Enums']['payment_mode']
          p_status: Database['public']['Enums']['payment_status']
          p_version: number
        }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_shop_published: { Args: { p: boolean }; Returns: Json }
      slim_order_items: { Args: { p_items: Json }; Returns: Json }
      slug_available: { Args: { p_slug: string }; Returns: boolean }
      storefront_catalog: { Args: { p_slug: string }; Returns: Json }
      storefront_shop: { Args: { p_slug: string }; Returns: Json }
      suggest_customers: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          customer_name: string
          customer_phone: string
          last_order_date: string
        }[]
      }
      switch_to_cod: { Args: { p_order_id: string }; Returns: Json }
      trash_category: { Args: { p_id: string }; Returns: undefined }
      trash_order: {
        Args: { p_id: string }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      trash_product: { Args: { p_id: string }; Returns: undefined }
      trash_variant: { Args: { p_id: string }; Returns: undefined }
      undo_product_import: { Args: { p_id: string }; Returns: Json }
      update_order: {
        Args: { p: Json; p_id: string; p_version: number }
        Returns: {
          bill_no: number | null
          bill_prefix: string | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          claim_count: number
          client_key: string | null
          confirmation_status: string
          created_at: string
          customer_name: string
          customer_phone: string | null
          customer_user_id: string | null
          decline_reason: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivery_address: Json | null
          delivery_fee: number
          discount: number
          due_date: string | null
          fulfilment: string | null
          id: string
          idempotency_key: string | null
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_claim_status: string
          payment_claimed_at: string | null
          payment_method: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_reference: string | null
          payment_reject_reason: string | null
          payment_status: Database['public']['Enums']['payment_status']
          payment_verified_at: string | null
          ready_at: string | null
          source: string
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        SetofOptions: {
          from: '*'
          to: 'orders'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_shop: { Args: { p: Json }; Returns: Json }
      upsert_address: {
        Args: { p: Json }
        Returns: {
          area: string | null
          city: string
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          line1: string
          line2: string | null
          name: string
          phone: string
          pincode: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: '*'
          to: 'customer_addresses'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_category: { Args: { p: Json }; Returns: Json }
      upsert_product: { Args: { p: Json }; Returns: Json }
      verify_payment: { Args: { p_id: string; v: number }; Returns: Json }
    }
    Enums: {
      order_status: 'new' | 'ready' | 'delivered' | 'cancelled'
      payment_mode: 'online' | 'cash'
      payment_status: 'pending' | 'paid'
      size_unit: 'g' | 'ml' | 'pcs'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      order_status: ['new', 'ready', 'delivered', 'cancelled'],
      payment_mode: ['online', 'cash'],
      payment_status: ['pending', 'paid'],
      size_unit: ['g', 'ml', 'pcs'],
    },
  },
} as const
