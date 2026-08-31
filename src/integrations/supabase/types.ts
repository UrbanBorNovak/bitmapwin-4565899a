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
      activity: {
        Row: {
          bitmap_id: string | null
          created_at: string
          id: string
          metadata: Json
          type: string
          wallet_address: string | null
        }
        Insert: {
          bitmap_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          type: string
          wallet_address?: string | null
        }
        Update: {
          bitmap_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          type?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_bitmap_id_fkey"
            columns: ["bitmap_id"]
            isOneToOne: false
            referencedRelation: "bitmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          bidder_address: string
          bitmap_height: number
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          price_sats: number
          signature: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bidder_address: string
          bitmap_height: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          price_sats: number
          signature?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bidder_address?: string
          bitmap_height?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          price_sats?: number
          signature?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bitmap_index: {
        Row: {
          block_height: number
          content: string | null
          genesis_height: number | null
          inscription_id: string | null
          is_valid: boolean
          owner_address: string | null
          resolved_at: string
          sat: number
          sat_index: number
        }
        Insert: {
          block_height: number
          content?: string | null
          genesis_height?: number | null
          inscription_id?: string | null
          is_valid?: boolean
          owner_address?: string | null
          resolved_at?: string
          sat: number
          sat_index?: number
        }
        Update: {
          block_height?: number
          content?: string | null
          genesis_height?: number | null
          inscription_id?: string | null
          is_valid?: boolean
          owner_address?: string | null
          resolved_at?: string
          sat?: number
          sat_index?: number
        }
        Relationships: []
      }
      bitmaps: {
        Row: {
          block_height: number
          created_at: string
          id: string
          image_url: string | null
          inscription_id: string | null
          owner_address: string | null
          price_btc: number | null
          status: string
          updated_at: string
        }
        Insert: {
          block_height: number
          created_at?: string
          id?: string
          image_url?: string | null
          inscription_id?: string | null
          owner_address?: string | null
          price_btc?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          block_height?: number
          created_at?: string
          id?: string
          image_url?: string | null
          inscription_id?: string | null
          owner_address?: string | null
          price_btc?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inscriptions: {
        Row: {
          bitmap_height: number | null
          block_height: number | null
          body_bytes: number
          body_text: string | null
          content_type: string | null
          created_at: string
          fields: Json
          id: string
          input_index: number
          is_bitmap_claim: boolean
          txid: string
          updated_at: string
        }
        Insert: {
          bitmap_height?: number | null
          block_height?: number | null
          body_bytes?: number
          body_text?: string | null
          content_type?: string | null
          created_at?: string
          fields?: Json
          id: string
          input_index?: number
          is_bitmap_claim?: boolean
          txid: string
          updated_at?: string
        }
        Update: {
          bitmap_height?: number | null
          block_height?: number | null
          body_bytes?: number
          body_text?: string | null
          content_type?: string | null
          created_at?: string
          fields?: Json
          id?: string
          input_index?: number
          is_bitmap_claim?: boolean
          txid?: string
          updated_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          bitmap_id: string
          created_at: string
          id: string
          price_btc: number
          seller_address: string
          status: string
        }
        Insert: {
          bitmap_id: string
          created_at?: string
          id?: string
          price_btc: number
          seller_address: string
          status?: string
        }
        Update: {
          bitmap_id?: string
          created_at?: string
          id?: string
          price_btc?: number
          seller_address?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_bitmap_id_fkey"
            columns: ["bitmap_id"]
            isOneToOne: false
            referencedRelation: "bitmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          bitmap_height: number | null
          buyer_address: string | null
          buyer_psbt_base64: string | null
          buyer_txid: string | null
          created_at: string
          delivered_at: string | null
          delivery_note: string | null
          id: string
          inscription_id: string | null
          outpoint: string
          price_sats: number
          psbt_base64: string
          psbt_hash: string
          seller_address: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bitmap_height?: number | null
          buyer_address?: string | null
          buyer_psbt_base64?: string | null
          buyer_txid?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_note?: string | null
          id?: string
          inscription_id?: string | null
          outpoint: string
          price_sats?: number
          psbt_base64: string
          psbt_hash: string
          seller_address?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bitmap_height?: number | null
          buyer_address?: string | null
          buyer_psbt_base64?: string | null
          buyer_txid?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_note?: string | null
          id?: string
          inscription_id?: string | null
          outpoint?: string
          price_sats?: number
          psbt_base64?: string
          psbt_hash?: string
          seller_address?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          bitmap_height: number
          block_height: number | null
          block_time: string | null
          buyer_address: string | null
          created_at: string
          hop: number
          inscription_id: string | null
          price_sats: number
          seller_address: string | null
          txid: string
          updated_at: string
        }
        Insert: {
          bitmap_height: number
          block_height?: number | null
          block_time?: string | null
          buyer_address?: string | null
          created_at?: string
          hop?: number
          inscription_id?: string | null
          price_sats?: number
          seller_address?: string | null
          txid: string
          updated_at?: string
        }
        Update: {
          bitmap_height?: number
          block_height?: number | null
          block_time?: string | null
          buyer_address?: string | null
          created_at?: string
          hop?: number
          inscription_id?: string | null
          price_sats?: number
          seller_address?: string | null
          txid?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
