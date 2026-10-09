export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
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
          items_hash: string
          order_id: string
          owner_id: string
          revision: number
          total_at_generation: number
          updated_at: string
        }
        Insert: {
          bill_no: number
          created_at?: string
          generated_at?: string
          id?: string
          image_path: string
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
      order_items: {
        Row: {
          cost_price: number | null
          created_at: string
          id: string
          line_total: number | null
          order_id: string
          owner_id: string
          position: number
          product_name: string
          quantity: number
          unit_price: number
          updated_at: string
          variant_id: string | null
          variant_name: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          id?: string
          line_total?: number | null
          order_id: string
          owner_id?: string
          position?: number
          product_name: string
          quantity: number
          unit_price: number
          updated_at?: string
          variant_id?: string | null
          variant_name: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          id?: string
          line_total?: number | null
          order_id?: string
          owner_id?: string
          position?: number
          product_name?: string
          quantity?: number
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
          snapshot: Json
          summary: string | null
          version_no: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          owner_id?: string
          reason: string
          snapshot: Json
          summary?: string | null
          version_no: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          owner_id?: string
          reason?: string
          snapshot?: Json
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
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
          status: Database['public']['Enums']['order_status']
          total: number
          updated_at: string
          version_no: number
        }
        Insert: {
          bill_no?: number | null
          cancelled_at?: string | null
          cancelled_from?: Database['public']['Enums']['order_status'] | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: number
          owner_id?: string
          paid_at?: string | null
          payment_mode?: Database['public']['Enums']['payment_mode'] | null
          payment_status?: Database['public']['Enums']['payment_status']
          ready_at?: string | null
          status?: Database['public']['Enums']['order_status']
          total?: number
          updated_at?: string
          version_no?: number
        }
        Update: {
          bill_no?: number | null
          cancelled_at?: string | null
          cancelled_from?: Database['public']['Enums']['order_status'] | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          discount?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: number
          owner_id?: string
          paid_at?: string | null
          payment_mode?: Database['public']['Enums']['payment_mode'] | null
          payment_status?: Database['public']['Enums']['payment_status']
          ready_at?: string | null
          status?: Database['public']['Enums']['order_status']
          total?: number
          updated_at?: string
          version_no?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          qr_path: string | null
          shop_address: string
          shop_name: string
          shop_phone: string
          timezone: string
          updated_at: string
          upi_id: string | null
        }
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
          qr_path?: string | null
          shop_address?: string
          shop_name?: string
          shop_phone?: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
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
          qr_path?: string | null
          shop_address?: string
          shop_name?: string
          shop_phone?: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: []
      }
      variants: {
        Row: {
          cost_price: number | null
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          price: number
          product_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string
          price: number
          product_id: string
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
          owner_id?: string
          price?: number
          product_id?: string
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
      bill_content_hash: { Args: { p_order: string }; Returns: string }
      check_order_rules: { Args: { p_order: string }; Returns: undefined }
      compute_order_total: {
        Args: { p_discount: number; p_order: string }
        Returns: number
      }
      create_order: {
        Args: { p: Json }
        Returns: {
          bill_no: number | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
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
      init_settings: {
        Args: never
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
          qr_path: string | null
          shop_address: string
          shop_name: string
          shop_phone: string
          timezone: string
          updated_at: string
          upi_id: string | null
        }
        SetofOptions: {
          from: '*'
          to: 'settings'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      next_bill_no: { Args: never; Returns: number }
      next_order_no: { Args: never; Returns: number }
      normalize_phone: { Args: { p: string }; Returns: string }
      order_snapshot: { Args: { p_order: string }; Returns: Json }
      ping: { Args: never; Returns: number }
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
      replace_order_items: {
        Args: { p_items: Json; p_order: string }
        Returns: undefined
      }
      reserve_bill_number: { Args: { p_order: string }; Returns: Json }
      restore_order: {
        Args: { p_id: string }
        Returns: {
          bill_no: number | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
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
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
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
      set_order_status: {
        Args: {
          p_id: string
          p_status: Database['public']['Enums']['order_status']
          p_version: number
        }
        Returns: {
          bill_no: number | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
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
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
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
      suggest_customers: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          customer_name: string
          customer_phone: string
          last_order_date: string
        }[]
      }
      trash_order: {
        Args: { p_id: string }
        Returns: {
          bill_no: number | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
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
      update_order: {
        Args: { p: Json; p_id: string; p_version: number }
        Returns: {
          bill_no: number | null
          cancelled_at: string | null
          cancelled_from: Database['public']['Enums']['order_status'] | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          deleted_at: string | null
          delivered_at: string | null
          discount: number
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_no: number
          owner_id: string
          paid_at: string | null
          payment_mode: Database['public']['Enums']['payment_mode'] | null
          payment_status: Database['public']['Enums']['payment_status']
          ready_at: string | null
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
      upsert_product: { Args: { p: Json }; Returns: Json }
    }
    Enums: {
      order_status: 'new' | 'ready' | 'delivered' | 'cancelled'
      payment_mode: 'online' | 'cash'
      payment_status: 'pending' | 'paid'
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    },
  },
} as const
