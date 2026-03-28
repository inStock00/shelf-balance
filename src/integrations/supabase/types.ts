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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attribute_options: {
        Row: {
          attribute_id: string
          id: string
          value: string
        }
        Insert: {
          attribute_id: string
          id?: string
          value: string
        }
        Update: {
          attribute_id?: string
          id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribute_options_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attributes"
            referencedColumns: ["id"]
          },
        ]
      }
      attributes: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          change_amount: number
          created_at: string
          id: string
          organization_id: string | null
          product_id: string
          reason: string
          reference_transaction_id: string | null
          variant_id: string | null
        }
        Insert: {
          change_amount: number
          created_at?: string
          id?: string
          organization_id?: string | null
          product_id: string
          reason: string
          reference_transaction_id?: string | null
          variant_id?: string | null
        }
        Update: {
          change_amount?: number
          created_at?: string
          id?: string
          organization_id?: string | null
          product_id?: string
          reason?: string
          reference_transaction_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_reference_transaction_id_fkey"
            columns: ["reference_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_name: string
          created_at: string
          credit: number
          debit: number
          id: string
          organization_id: string | null
          transaction_id: string
        }
        Insert: {
          account_name: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          organization_id?: string | null
          transaction_id: string
        }
        Update: {
          account_name?: string
          created_at?: string
          credit?: number
          debit?: number
          id?: string
          organization_id?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_features: {
        Row: {
          enabled: boolean
          feature_name: string
          id: string
          organization_id: string
        }
        Insert: {
          enabled?: boolean
          feature_name: string
          id?: string
          organization_id: string
        }
        Update: {
          enabled?: boolean
          feature_name?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_features_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          organization_id: string | null
          price_override: number | null
          product_id: string
          reorder_point: number
          sku: string
          stock_quantity: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          price_override?: number | null
          product_id: string
          reorder_point?: number
          sku: string
          stock_quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          price_override?: number | null
          product_id?: string
          reorder_point?: number
          sku?: string
          stock_quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category: string
          created_at: string
          current_stock: number
          description: string | null
          has_variants: boolean
          id: string
          image_url: string | null
          name: string
          organization_id: string | null
          reorder_point: number
          selling_price: number
          sku: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string
          created_at?: string
          current_stock?: number
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          name: string
          organization_id?: string | null
          reorder_point?: number
          selling_price?: number
          sku: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string
          created_at?: string
          current_stock?: number
          description?: string | null
          has_variants?: boolean
          id?: string
          image_url?: string | null
          name?: string
          organization_id?: string | null
          reorder_point?: number
          selling_price?: number
          sku?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string | null
          status: string
          total_amount: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          status?: string
          total_amount?: number
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          status?: string
          total_amount?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      variant_attribute_values: {
        Row: {
          attribute_option_id: string
          id: string
          variant_id: string
        }
        Insert: {
          attribute_option_id: string
          id?: string
          variant_id: string
        }
        Update: {
          attribute_option_id?: string
          id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variant_attribute_values_attribute_option_id_fkey"
            columns: ["attribute_option_id"]
            isOneToOne: false
            referencedRelation: "attribute_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variant_attribute_values_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "group_admin" | "user"
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
      app_role: ["super_admin", "group_admin", "user"],
    },
  },
} as const
