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
          accepted_offer_id: string | null
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
          accepted_offer_id?: string | null
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
          accepted_offer_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "bids_accepted_offer_id_fkey"
            columns: ["accepted_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
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
      bitmap_view_stats: {
        Row: {
          bitmap_height: number
          last_viewed_at: string
          total_views: number
          unique_visitors: number
        }
        Insert: {
          bitmap_height: number
          last_viewed_at?: string
          total_views?: number
          unique_visitors?: number
        }
        Update: {
          bitmap_height?: number
          last_viewed_at?: string
          total_views?: number
          unique_visitors?: number
        }
        Relationships: []
      }
      bitmap_views: {
        Row: {
          bitmap_height: number
          created_at: string
          id: string
          viewer_address: string | null
          visitor_key: string
        }
        Insert: {
          bitmap_height: number
          created_at?: string
          id?: string
          viewer_address?: string | null
          visitor_key: string
        }
        Update: {
          bitmap_height?: number
          created_at?: string
          id?: string
          viewer_address?: string | null
          visitor_key?: string
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
      block_stats: {
        Row: {
          block_height: number
          created_at: string
          pattern: number | null
          preview_height: number
          preview_width: number
          tx_count: number
        }
        Insert: {
          block_height: number
          created_at?: string
          pattern?: number | null
          preview_height: number
          preview_width: number
          tx_count: number
        }
        Update: {
          block_height?: number
          created_at?: string
          pattern?: number | null
          preview_height?: number
          preview_width?: number
          tx_count?: number
        }
        Relationships: []
      }
      build_delegates: {
        Row: {
          bitmap_height: number
          created_at: string
          delegate_address: string
          id: string
          note: string | null
          owner_address: string
        }
        Insert: {
          bitmap_height: number
          created_at?: string
          delegate_address: string
          id?: string
          note?: string | null
          owner_address: string
        }
        Update: {
          bitmap_height?: number
          created_at?: string
          delegate_address?: string
          id?: string
          note?: string | null
          owner_address?: string
        }
        Relationships: []
      }
      builder_follows: {
        Row: {
          builder_address: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          builder_address: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          builder_address?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      coin_balances: {
        Row: {
          address: string
          balance: number
          earned_total: number
          updated_at: string
        }
        Insert: {
          address: string
          balance?: number
          earned_total?: number
          updated_at?: string
        }
        Update: {
          address?: string
          balance?: number
          earned_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      coin_event_entries: {
        Row: {
          address: string
          created_at: string
          event_id: string
          id: string
          spent: number
          tickets: number
        }
        Insert: {
          address: string
          created_at?: string
          event_id: string
          id?: string
          spent?: number
          tickets?: number
        }
        Update: {
          address?: string
          created_at?: string
          event_id?: string
          id?: string
          spent?: number
          tickets?: number
        }
        Relationships: [
          {
            foreignKeyName: "coin_event_entries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "coin_events"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_events: {
        Row: {
          bitmap_height: number | null
          created_at: string
          description: string | null
          drawn_at: string | null
          ends_at: string | null
          entry_cost: number
          host_address: string
          id: string
          kind: string
          max_entries: number | null
          prize: string | null
          prize_coins: number
          prize_paid_at: string | null
          status: string
          title: string
          updated_at: string
          winner_address: string | null
        }
        Insert: {
          bitmap_height?: number | null
          created_at?: string
          description?: string | null
          drawn_at?: string | null
          ends_at?: string | null
          entry_cost?: number
          host_address: string
          id?: string
          kind?: string
          max_entries?: number | null
          prize?: string | null
          prize_coins?: number
          prize_paid_at?: string | null
          status?: string
          title: string
          updated_at?: string
          winner_address?: string | null
        }
        Update: {
          bitmap_height?: number | null
          created_at?: string
          description?: string | null
          drawn_at?: string | null
          ends_at?: string | null
          entry_cost?: number
          host_address?: string
          id?: string
          kind?: string
          max_entries?: number | null
          prize?: string | null
          prize_coins?: number
          prize_paid_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          winner_address?: string | null
        }
        Relationships: []
      }
      coin_ledger: {
        Row: {
          address: string
          created_at: string
          delta: number
          id: string
          reason: string
          ref: string | null
        }
        Insert: {
          address: string
          created_at?: string
          delta: number
          id?: string
          reason: string
          ref?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          delta?: number
          id?: string
          reason?: string
          ref?: string | null
        }
        Relationships: []
      }
      coin_reward_runs: {
        Row: {
          awarded: number
          created_at: string
          recipients: number
          run_date: string
        }
        Insert: {
          awarded?: number
          created_at?: string
          recipients?: number
          run_date: string
        }
        Update: {
          awarded?: number
          created_at?: string
          recipients?: number
          run_date?: string
        }
        Relationships: []
      }
      coin_view_snapshots: {
        Row: {
          bitmap_height: number
          total_views: number
          unique_visitors: number
          updated_at: string
        }
        Insert: {
          bitmap_height: number
          total_views?: number
          unique_visitors?: number
          updated_at?: string
        }
        Update: {
          bitmap_height?: number
          total_views?: number
          unique_visitors?: number
          updated_at?: string
        }
        Relationships: []
      }
      district_bitmaps: {
        Row: {
          bitmap_height: number
          created_at: string
          district_id: string
          id: string
        }
        Insert: {
          bitmap_height: number
          created_at?: string
          district_id: string
          id?: string
        }
        Update: {
          bitmap_height?: number
          created_at?: string
          district_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "district_bitmaps_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          accent: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_address: string
          slug: string
          updated_at: string
        }
        Insert: {
          accent?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_address: string
          slug: string
          updated_at?: string
        }
        Update: {
          accent?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_address?: string
          slug?: string
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
      lease_offers: {
        Row: {
          bitmap_height: number
          created_at: string
          id: string
          max_days: number
          min_days: number
          note: string | null
          owner_address: string
          rate_coins_per_day: number
          rate_sats_per_day: number
          status: string
          updated_at: string
        }
        Insert: {
          bitmap_height: number
          created_at?: string
          id?: string
          max_days?: number
          min_days?: number
          note?: string | null
          owner_address: string
          rate_coins_per_day?: number
          rate_sats_per_day?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bitmap_height?: number
          created_at?: string
          id?: string
          max_days?: number
          min_days?: number
          note?: string | null
          owner_address?: string
          rate_coins_per_day?: number
          rate_sats_per_day?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      leases: {
        Row: {
          bitmap_height: number
          created_at: string
          days: number
          ends_at: string
          fee_sats: number
          id: string
          lessee_address: string
          owner_address: string
          psbt_base64: string | null
          rate_coins_per_day: number
          rate_sats_per_day: number
          starts_at: string
          status: string
          total_coins: number
          total_sats: number
          txid: string | null
          updated_at: string
        }
        Insert: {
          bitmap_height: number
          created_at?: string
          days: number
          ends_at: string
          fee_sats?: number
          id?: string
          lessee_address: string
          owner_address: string
          psbt_base64?: string | null
          rate_coins_per_day?: number
          rate_sats_per_day?: number
          starts_at?: string
          status?: string
          total_coins?: number
          total_sats?: number
          txid?: string | null
          updated_at?: string
        }
        Update: {
          bitmap_height?: number
          created_at?: string
          days?: number
          ends_at?: string
          fee_sats?: number
          id?: string
          lessee_address?: string
          owner_address?: string
          psbt_base64?: string | null
          rate_coins_per_day?: number
          rate_sats_per_day?: number
          starts_at?: string
          status?: string
          total_coins?: number
          total_sats?: number
          txid?: string | null
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
          bid_id: string | null
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
          bid_id?: string | null
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
          bid_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "offers_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_pages: {
        Row: {
          banner_inscription_id: string | null
          bitmap_height: number
          build_config: Json
          build_kind: string
          created_at: string
          description: string | null
          link_url: string | null
          owner_address: string
          title: string | null
          updated_at: string
        }
        Insert: {
          banner_inscription_id?: string | null
          bitmap_height: number
          build_config?: Json
          build_kind?: string
          created_at?: string
          description?: string | null
          link_url?: string | null
          owner_address: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          banner_inscription_id?: string | null
          bitmap_height?: number
          build_config?: Json
          build_kind?: string
          created_at?: string
          description?: string | null
          link_url?: string | null
          owner_address?: string
          title?: string | null
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
      wallet_link_challenges: {
        Row: {
          address: string
          created_at: string
          expires_at: string
          message: string
          nonce: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          expires_at?: string
          message: string
          nonce: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          expires_at?: string
          message?: string
          nonce?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallet_links: {
        Row: {
          address: string
          created_at: string
          id: string
          public_key: string | null
          purpose: string
          user_id: string
          verified_at: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          public_key?: string | null
          purpose?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          public_key?: string | null
          purpose?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      wallet_profiles: {
        Row: {
          address: string
          avatar_inscription_id: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          avatar_inscription_id?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          avatar_inscription_id?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          owner_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_build_bitmap: {
        Args: { _height: number; _owner_address: string; _user_id: string }
        Returns: boolean
      }
      coin_apply: {
        Args: {
          _address: string
          _delta: number
          _reason: string
          _ref?: string
        }
        Returns: number
      }
      coin_close_event: { Args: { _event_id: string }; Returns: undefined }
      coin_create_event: {
        Args: {
          _bitmap_height?: number
          _description?: string
          _ends_at?: string
          _entry_cost?: number
          _host_address: string
          _kind: string
          _max_entries?: number
          _prize?: string
          _prize_coins?: number
          _title: string
        }
        Returns: string
      }
      coin_draw_event: { Args: { _event_id: string }; Returns: string }
      coin_enter_event: {
        Args: { _address: string; _event_id: string; _tickets: number }
        Returns: string
      }
      coin_start_lease: {
        Args: { _days: number; _lessee_address: string; _offer_id: string }
        Returns: string
      }
      owns_wallet: {
        Args: { _address: string; _user_id: string }
        Returns: boolean
      }
      record_bitmap_view: {
        Args: { _address?: string; _height: number; _visitor: string }
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
