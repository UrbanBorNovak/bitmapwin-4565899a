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
    PostgrestVersion: "14.17"
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
      adrenaline_licenses: {
        Row: {
          address: string
          config: Json
          last_seen_at: string
          licensed_at: string
          price_bit: number
          user_id: string
        }
        Insert: {
          address: string
          config?: Json
          last_seen_at?: string
          licensed_at?: string
          price_bit: number
          user_id: string
        }
        Update: {
          address?: string
          config?: Json
          last_seen_at?: string
          licensed_at?: string
          price_bit?: number
          user_id?: string
        }
        Relationships: []
      }
      agent_proposal_events: {
        Row: {
          created_at: string
          detail: string | null
          event: string
          id: string
          proposal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          event: string
          id?: string
          proposal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          event?: string
          id?: string
          proposal_id?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_proposals: {
        Row: {
          citizen_id: string
          created_at: string
          decided_at: string | null
          href: string
          id: string
          item: string | null
          kind: string
          offer_id: string | null
          price_sats: number | null
          reason: string | null
          stale_why: string | null
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          citizen_id: string
          created_at?: string
          decided_at?: string | null
          href: string
          id: string
          item?: string | null
          kind: string
          offer_id?: string | null
          price_sats?: number | null
          reason?: string | null
          stale_why?: string | null
          status?: string
          summary: string
          user_id: string
        }
        Update: {
          citizen_id?: string
          created_at?: string
          decided_at?: string | null
          href?: string
          id?: string
          item?: string | null
          kind?: string
          offer_id?: string | null
          price_sats?: number | null
          reason?: string | null
          stale_why?: string | null
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
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
      biternam_backroom_claims: {
        Row: {
          claimed_at: string
          slug: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          slug: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          slug?: string
          user_id?: string
        }
        Relationships: []
      }
      biternam_chapters: {
        Row: {
          block_height: number
          created_at: string
          owner_address: string
          quote: string
          set_by: string
          title: string
          updated_at: string
        }
        Insert: {
          block_height: number
          created_at?: string
          owner_address: string
          quote: string
          set_by: string
          title: string
          updated_at?: string
        }
        Update: {
          block_height?: number
          created_at?: string
          owner_address?: string
          quote?: string
          set_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      biternam_quest_claims: {
        Row: {
          address: string
          bit: number
          created_at: string
          quest_id: string
          user_id: string
        }
        Insert: {
          address: string
          bit: number
          created_at?: string
          quest_id: string
          user_id: string
        }
        Update: {
          address?: string
          bit?: number
          created_at?: string
          quest_id?: string
          user_id?: string
        }
        Relationships: []
      }
      biternam_quest_steps: {
        Row: {
          created_at: string
          quest_id: string
          step_index: number
          step_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          quest_id: string
          step_index: number
          step_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          quest_id?: string
          step_index?: number
          step_key?: string
          user_id?: string
        }
        Relationships: []
      }
      bitmap_archaeology_nominations: {
        Row: {
          bitmap_height: number
          contributor_name: string
          created_at: string
          evidence_url: string
          featured_position: number | null
          id: string
          inscription_id: string
          review_note: string | null
          reviewed_at: string | null
          status: string
          thesis: string
          trait_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bitmap_height: number
          contributor_name: string
          created_at?: string
          evidence_url: string
          featured_position?: number | null
          id?: string
          inscription_id: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          thesis: string
          trait_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bitmap_height?: number
          contributor_name?: string
          created_at?: string
          evidence_url?: string
          featured_position?: number | null
          id?: string
          inscription_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          thesis?: string
          trait_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bitmap_bss_scenes: {
        Row: {
          bitmap_height: number
          bmp_inscription_id: string
          is_valid: boolean
          object_count: number
          resource_count: number
          updated_at: string
          verified_at: string
          version_label: string
        }
        Insert: {
          bitmap_height: number
          bmp_inscription_id: string
          is_valid?: boolean
          object_count?: number
          resource_count?: number
          updated_at?: string
          verified_at?: string
          version_label: string
        }
        Update: {
          bitmap_height?: number
          bmp_inscription_id?: string
          is_valid?: boolean
          object_count?: number
          resource_count?: number
          updated_at?: string
          verified_at?: string
          version_label?: string
        }
        Relationships: []
      }
      bitmap_chat_messages: {
        Row: {
          bitmap_height: number
          body: string
          created_at: string
          id: string
          sender_address: string | null
          user_id: string
        }
        Insert: {
          bitmap_height: number
          body: string
          created_at?: string
          id?: string
          sender_address?: string | null
          user_id: string
        }
        Update: {
          bitmap_height?: number
          body?: string
          created_at?: string
          id?: string
          sender_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bitmap_crews: {
        Row: {
          added_by: string
          created_at: string
          height: number
          user_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          height: number
          user_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          height?: number
          user_id?: string
        }
        Relationships: []
      }
      bitmap_custody: {
        Row: {
          block_height: number
          checked_at: string
          inscription_id: string
          last_move_block: number | null
          satpoint: string | null
        }
        Insert: {
          block_height: number
          checked_at?: string
          inscription_id: string
          last_move_block?: number | null
          satpoint?: string | null
        }
        Update: {
          block_height?: number
          checked_at?: string
          inscription_id?: string
          last_move_block?: number | null
          satpoint?: string | null
        }
        Relationships: []
      }
      bitmap_forge_builds: {
        Row: {
          archetype: string | null
          bitmap_height: number
          block_count: number
          inscription_id: string
          sat: string | null
          verified_at: string
        }
        Insert: {
          archetype?: string | null
          bitmap_height: number
          block_count?: number
          inscription_id: string
          sat?: string | null
          verified_at?: string
        }
        Update: {
          archetype?: string | null
          bitmap_height?: number
          block_count?: number
          inscription_id?: string
          sat?: string | null
          verified_at?: string
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
      bitmap_kennels: {
        Row: {
          block_height: number
          created_at: string
          holder_address: string
          holder_user: string
          is_open: boolean
          max_supply: number
          minted_count: number
          name: string
          payout_address: string
          price_sats: number
          updated_at: string
        }
        Insert: {
          block_height: number
          created_at?: string
          holder_address: string
          holder_user: string
          is_open?: boolean
          max_supply: number
          minted_count?: number
          name: string
          payout_address: string
          price_sats: number
          updated_at?: string
        }
        Update: {
          block_height?: number
          created_at?: string
          holder_address?: string
          holder_user?: string
          is_open?: boolean
          max_supply?: number
          minted_count?: number
          name?: string
          payout_address?: string
          price_sats?: number
          updated_at?: string
        }
        Relationships: []
      }
      bitmap_land_skins: {
        Row: {
          bitmap_height: number
          bitmap_inscription_id: string | null
          checked_at: string
          content_type: string | null
          has_image: boolean
          image_inscription_id: string | null
        }
        Insert: {
          bitmap_height: number
          bitmap_inscription_id?: string | null
          checked_at?: string
          content_type?: string | null
          has_image?: boolean
          image_inscription_id?: string | null
        }
        Update: {
          bitmap_height?: number
          bitmap_inscription_id?: string | null
          checked_at?: string
          content_type?: string | null
          has_image?: boolean
          image_inscription_id?: string | null
        }
        Relationships: []
      }
      bitmap_models: {
        Row: {
          animation_count: number
          bitmap_height: number
          body_bytes: number
          content_type: string
          created_at: string
          height_offset: number
          inscription_id: string
          owner_address: string
          rotation_y: number
          scale: number
          texture_count: number
          triangle_count: number
          updated_at: string
          validated_at: string
          validation_note: string | null
          validation_status: string
        }
        Insert: {
          animation_count: number
          bitmap_height: number
          body_bytes: number
          content_type: string
          created_at?: string
          height_offset?: number
          inscription_id: string
          owner_address: string
          rotation_y?: number
          scale?: number
          texture_count: number
          triangle_count: number
          updated_at?: string
          validated_at?: string
          validation_note?: string | null
          validation_status?: string
        }
        Update: {
          animation_count?: number
          bitmap_height?: number
          body_bytes?: number
          content_type?: string
          created_at?: string
          height_offset?: number
          inscription_id?: string
          owner_address?: string
          rotation_y?: number
          scale?: number
          texture_count?: number
          triangle_count?: number
          updated_at?: string
          validated_at?: string
          validation_note?: string | null
          validation_status?: string
        }
        Relationships: []
      }
      bitmap_spawn_points: {
        Row: {
          bitmap_height: number
          owner_address: string
          set_by: string
          updated_at: string
          x: number
          yaw: number
          z: number
        }
        Insert: {
          bitmap_height: number
          owner_address: string
          set_by: string
          updated_at?: string
          x: number
          yaw?: number
          z: number
        }
        Update: {
          bitmap_height?: number
          owner_address?: string
          set_by?: string
          updated_at?: string
          x?: number
          yaw?: number
          z?: number
        }
        Relationships: []
      }
      bitmap_spoils: {
        Row: {
          bit: number
          block_height: number
          raids_won: number
          updated_at: string
        }
        Insert: {
          bit?: number
          block_height: number
          raids_won?: number
          updated_at?: string
        }
        Update: {
          bit?: number
          block_height?: number
          raids_won?: number
          updated_at?: string
        }
        Relationships: []
      }
      bitmap_storefront_listings: {
        Row: {
          created_at: string
          offer_id: string
          storefront_height: number
        }
        Insert: {
          created_at?: string
          offer_id: string
          storefront_height: number
        }
        Update: {
          created_at?: string
          offer_id?: string
          storefront_height?: number
        }
        Relationships: [
          {
            foreignKeyName: "bitmap_storefront_listings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
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
      bitmap_watches: {
        Row: {
          bitmap_height: number
          created_at: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
          watch_bids: boolean
          watch_builds: boolean
          watch_coins: boolean
          watch_leases: boolean
          watch_trades: boolean
          watch_visits: boolean
        }
        Insert: {
          bitmap_height: number
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
          watch_bids?: boolean
          watch_builds?: boolean
          watch_coins?: boolean
          watch_leases?: boolean
          watch_trades?: boolean
          watch_visits?: boolean
        }
        Update: {
          bitmap_height?: number
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          watch_bids?: boolean
          watch_builds?: boolean
          watch_coins?: boolean
          watch_leases?: boolean
          watch_trades?: boolean
          watch_visits?: boolean
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
      bitmon_guardians: {
        Row: {
          block_height: number
          created_at: string
          dna_hash: string
          id: string
          payment_txid: string
          rarity: string
          species: string
          stats: Json
          summoned_by_address: string
          summoned_by_user_id: string | null
        }
        Insert: {
          block_height: number
          created_at?: string
          dna_hash: string
          id?: string
          payment_txid: string
          rarity: string
          species: string
          stats?: Json
          summoned_by_address: string
          summoned_by_user_id?: string | null
        }
        Update: {
          block_height?: number
          created_at?: string
          dna_hash?: string
          id?: string
          payment_txid?: string
          rarity?: string
          species?: string
          stats?: Json
          summoned_by_address?: string
          summoned_by_user_id?: string | null
        }
        Relationships: []
      }
      bitmon_summon_orders: {
        Row: {
          amount_sats: number
          block_height: number
          created_at: string
          expires_at: string
          id: string
          payer_address: string
          status: string
          txid: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_sats: number
          block_height: number
          created_at?: string
          expires_at?: string
          id?: string
          payer_address: string
          status?: string
          txid?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_sats?: number
          block_height?: number
          created_at?: string
          expires_at?: string
          id?: string
          payer_address?: string
          status?: string
          txid?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      block_facts: {
        Row: {
          avg_fee_rate: number | null
          block_hash: string
          block_height: number
          btc_usd: number | null
          coinbase_text: string | null
          created_at: string
          mined_at: string
          pool_name: string | null
          size_bytes: number
          total_output_sats: number | null
        }
        Insert: {
          avg_fee_rate?: number | null
          block_hash: string
          block_height: number
          btc_usd?: number | null
          coinbase_text?: string | null
          created_at?: string
          mined_at: string
          pool_name?: string | null
          size_bytes: number
          total_output_sats?: number | null
        }
        Update: {
          avg_fee_rate?: number | null
          block_hash?: string
          block_height?: number
          btc_usd?: number | null
          coinbase_text?: string | null
          created_at?: string
          mined_at?: string
          pool_name?: string | null
          size_bytes?: number
          total_output_sats?: number | null
        }
        Relationships: []
      }
      block_facts_crawl_state: {
        Row: {
          id: string
          last_error: string | null
          locked_until: string
          next_height: number
          updated_at: string
        }
        Insert: {
          id: string
          last_error?: string | null
          locked_until?: string
          next_height?: number
          updated_at?: string
        }
        Update: {
          id?: string
          last_error?: string | null
          locked_until?: string
          next_height?: number
          updated_at?: string
        }
        Relationships: []
      }
      block_props: {
        Row: {
          address: string
          created_at: string
          id: string
          market: string
          multiplier: number
          outcome: string | null
          payout: number
          pick: string
          settled_at: string | null
          stake: number
          status: string
          target_height: number
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          market: string
          multiplier: number
          outcome?: string | null
          payout?: number
          pick: string
          settled_at?: string | null
          stake: number
          status?: string
          target_height: number
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          market?: string
          multiplier?: number
          outcome?: string | null
          payout?: number
          pick?: string
          settled_at?: string | null
          stake?: number
          status?: string
          target_height?: number
          user_id?: string
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
      boss_strikes: {
        Row: {
          boss_slug: string
          created_at: string
          damage: number
          guardian_height: number
          id: string
          spawn_at: string
          user_id: string
        }
        Insert: {
          boss_slug: string
          created_at?: string
          damage: number
          guardian_height: number
          id?: string
          spawn_at: string
          user_id: string
        }
        Update: {
          boss_slug?: string
          created_at?: string
          damage?: number
          guardian_height?: number
          id?: string
          spawn_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcast_sponsorships: {
        Row: {
          created_at: string
          ends_at: string
          handle: string
          id: string
          media: string
          media_kind: string
          paid_sats: number
          pay_txid: string
          payer_address: string
          slot: string
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          handle?: string
          id?: string
          media: string
          media_kind: string
          paid_sats: number
          pay_txid: string
          payer_address: string
          slot: string
          starts_at?: string
          title: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          handle?: string
          id?: string
          media?: string
          media_kind?: string
          paid_sats?: number
          pay_txid?: string
          payer_address?: string
          slot?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      bss_block_scan: {
        Row: {
          block_height: number
          bmp_seen: number
          inscriptions_seen: number
          scanned_at: string
          scenes_found: number
          updated_at: string
        }
        Insert: {
          block_height: number
          bmp_seen?: number
          inscriptions_seen?: number
          scanned_at?: string
          scenes_found?: number
          updated_at?: string
        }
        Update: {
          block_height?: number
          bmp_seen?: number
          inscriptions_seen?: number
          scanned_at?: string
          scenes_found?: number
          updated_at?: string
        }
        Relationships: []
      }
      bss_scan_state: {
        Row: {
          bitmap_height: number
          detail: string | null
          outcome: string
          scanned_at: string
          updated_at: string
        }
        Insert: {
          bitmap_height: number
          detail?: string | null
          outcome?: string
          scanned_at?: string
          updated_at?: string
        }
        Update: {
          bitmap_height?: number
          detail?: string | null
          outcome?: string
          scanned_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      btc_donations: {
        Row: {
          bits_awarded: number
          confirmed: boolean
          created_at: string
          donor_address: string
          donor_user_id: string
          id: string
          note: string | null
          sats: number
          status: string
          txid: string
          updated_at: string
        }
        Insert: {
          bits_awarded: number
          confirmed?: boolean
          created_at?: string
          donor_address: string
          donor_user_id: string
          id?: string
          note?: string | null
          sats: number
          status?: string
          txid: string
          updated_at?: string
        }
        Update: {
          bits_awarded?: number
          confirmed?: boolean
          created_at?: string
          donor_address?: string
          donor_user_id?: string
          id?: string
          note?: string | null
          sats?: number
          status?: string
          txid?: string
          updated_at?: string
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
      build_proposals: {
        Row: {
          bitmap_height: number
          block_count: number
          blocks: Json
          created_at: string
          decided_at: string | null
          id: string
          model_inscription_id: string | null
          note: string | null
          parcel_index: number | null
          proposer_address: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          bitmap_height: number
          block_count: number
          blocks: Json
          created_at?: string
          decided_at?: string | null
          id?: string
          model_inscription_id?: string | null
          note?: string | null
          parcel_index?: number | null
          proposer_address: string
          role: string
          status?: string
          user_id: string
        }
        Update: {
          bitmap_height?: number
          block_count?: number
          blocks?: Json
          created_at?: string
          decided_at?: string | null
          id?: string
          model_inscription_id?: string | null
          note?: string | null
          parcel_index?: number | null
          proposer_address?: string
          role?: string
          status?: string
          user_id?: string
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
      cities: {
        Row: {
          banner_inscription_id: string | null
          created_at: string
          description: string
          founder_address: string
          founder_user_id: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          banner_inscription_id?: string | null
          created_at?: string
          description?: string
          founder_address: string
          founder_user_id: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          banner_inscription_id?: string | null
          created_at?: string
          description?: string
          founder_address?: string
          founder_user_id?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      city_bitmaps: {
        Row: {
          bitmap_height: number
          city_id: string
          created_at: string
          id: string
          member_address: string
          member_user_id: string
        }
        Insert: {
          bitmap_height: number
          city_id: string
          created_at?: string
          id?: string
          member_address: string
          member_user_id: string
        }
        Update: {
          bitmap_height?: number
          city_id?: string
          created_at?: string
          id?: string
          member_address?: string
          member_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_bitmaps_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      clan_members: {
        Row: {
          clan_id: string
          created_at: string
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          created_at: string
          crest_inscription_id: string
          id: string
          leader_user_id: string
          name: string
          tag: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          crest_inscription_id: string
          id?: string
          leader_user_id: string
          name: string
          tag: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          crest_inscription_id?: string
          id?: string
          leader_user_id?: string
          name?: string
          tag?: string
          updated_at?: string
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
      coin_leaderboard_public: {
        Row: {
          address_label: string
          balance: number
          rank: number
          updated_at: string
        }
        Insert: {
          address_label: string
          balance: number
          rank: number
          updated_at: string
        }
        Update: {
          address_label?: string
          balance?: number
          rank?: number
          updated_at?: string
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
      collection_backfill_lock: {
        Row: {
          id: string
          last_run_at: string
        }
        Insert: {
          id: string
          last_run_at?: string
        }
        Update: {
          id?: string
          last_run_at?: string
        }
        Relationships: []
      }
      collection_crawl_state: {
        Row: {
          collection: string
          inscription_id: string
          last_traced_at: string
          owner_address: string | null
          transfers: number
        }
        Insert: {
          collection: string
          inscription_id: string
          last_traced_at?: string
          owner_address?: string | null
          transfers?: number
        }
        Update: {
          collection?: string
          inscription_id?: string
          last_traced_at?: string
          owner_address?: string | null
          transfers?: number
        }
        Relationships: []
      }
      collection_sales: {
        Row: {
          block_height: number | null
          block_time: string | null
          buyer_address: string | null
          collection: string
          created_at: string
          hop: number
          inscription_id: string
          price_sats: number
          seller_address: string | null
          txid: string
        }
        Insert: {
          block_height?: number | null
          block_time?: string | null
          buyer_address?: string | null
          collection: string
          created_at?: string
          hop?: number
          inscription_id: string
          price_sats?: number
          seller_address?: string | null
          txid: string
        }
        Update: {
          block_height?: number | null
          block_time?: string | null
          buyer_address?: string | null
          collection?: string
          created_at?: string
          hop?: number
          inscription_id?: string
          price_sats?: number
          seller_address?: string | null
          txid?: string
        }
        Relationships: []
      }
      collection_trace_state: {
        Row: {
          collection: string
          inscription_id: string
          last_traced_at: string
          verified: boolean
        }
        Insert: {
          collection: string
          inscription_id: string
          last_traced_at?: string
          verified?: boolean
        }
        Update: {
          collection?: string
          inscription_id?: string
          last_traced_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      collection_trades: {
        Row: {
          block_height: number | null
          block_time: string | null
          buyer_address: string | null
          collection: string
          created_at: string
          inscription_id: string
          price_sats: number
          seller_address: string | null
          source: string
          txid: string
        }
        Insert: {
          block_height?: number | null
          block_time?: string | null
          buyer_address?: string | null
          collection: string
          created_at?: string
          inscription_id: string
          price_sats: number
          seller_address?: string | null
          source?: string
          txid: string
        }
        Update: {
          block_height?: number | null
          block_time?: string | null
          buyer_address?: string | null
          collection?: string
          created_at?: string
          inscription_id?: string
          price_sats?: number
          seller_address?: string | null
          source?: string
          txid?: string
        }
        Relationships: []
      }
      community_kits: {
        Row: {
          bags: Json
          behaviors: Json
          block_count: number
          created_at: string
          difficulty: string
          id: string
          maker_address: string
          maker_user: string
          name: string
          pay_txid: string
          steps: Json
          tagline: string
        }
        Insert: {
          bags: Json
          behaviors?: Json
          block_count: number
          created_at?: string
          difficulty?: string
          id?: string
          maker_address: string
          maker_user: string
          name: string
          pay_txid: string
          steps: Json
          tagline?: string
        }
        Update: {
          bags?: Json
          behaviors?: Json
          block_count?: number
          created_at?: string
          difficulty?: string
          id?: string
          maker_address?: string
          maker_user?: string
          name?: string
          pay_txid?: string
          steps?: Json
          tagline?: string
        }
        Relationships: []
      }
      creator_channels: {
        Row: {
          tiktok: string
          updated_at: string
          user_id: string
          x: string
          youtube: string
        }
        Insert: {
          tiktok?: string
          updated_at?: string
          user_id: string
          x?: string
          youtube?: string
        }
        Update: {
          tiktok?: string
          updated_at?: string
          user_id?: string
          x?: string
          youtube?: string
        }
        Relationships: []
      }
      crew_stash: {
        Row: {
          count: number
          height: number
          kind: string
        }
        Insert: {
          count?: number
          height: number
          kind: string
        }
        Update: {
          count?: number
          height?: number
          kind?: string
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
      epic_bosses: {
        Row: {
          hp: number
          kills: number
          max_hp: number
          respawn_at: string | null
          slug: string
          spawned_at: string
          updated_at: string
        }
        Insert: {
          hp: number
          kills?: number
          max_hp: number
          respawn_at?: string | null
          slug: string
          spawned_at?: string
          updated_at?: string
        }
        Update: {
          hp?: number
          kills?: number
          max_hp?: number
          respawn_at?: string | null
          slug?: string
          spawned_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      extender_dependencies: {
        Row: {
          created_at: string
          depends_on_extender_id: string
          id: string
          version_id: string
          version_range: string
        }
        Insert: {
          created_at?: string
          depends_on_extender_id: string
          id?: string
          version_id: string
          version_range?: string
        }
        Update: {
          created_at?: string
          depends_on_extender_id?: string
          id?: string
          version_id?: string
          version_range?: string
        }
        Relationships: [
          {
            foreignKeyName: "extender_dependencies_depends_on_extender_id_fkey"
            columns: ["depends_on_extender_id"]
            isOneToOne: false
            referencedRelation: "extender_public_stats"
            referencedColumns: ["extender_id"]
          },
          {
            foreignKeyName: "extender_dependencies_depends_on_extender_id_fkey"
            columns: ["depends_on_extender_id"]
            isOneToOne: false
            referencedRelation: "extenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extender_dependencies_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "extender_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      extender_deployments: {
        Row: {
          active_from: string
          active_until: string | null
          bitmap_height: number
          config: Json
          created_at: string
          deployed_by_address: string
          deployed_by_user_id: string
          extender_id: string
          granted_via: string
          id: string
          status: string
          updated_at: string
          version_id: string
        }
        Insert: {
          active_from?: string
          active_until?: string | null
          bitmap_height: number
          config?: Json
          created_at?: string
          deployed_by_address: string
          deployed_by_user_id: string
          extender_id: string
          granted_via?: string
          id?: string
          status?: string
          updated_at?: string
          version_id: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          bitmap_height?: number
          config?: Json
          created_at?: string
          deployed_by_address?: string
          deployed_by_user_id?: string
          extender_id?: string
          granted_via?: string
          id?: string
          status?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extender_deployments_extender_id_fkey"
            columns: ["extender_id"]
            isOneToOne: false
            referencedRelation: "extender_public_stats"
            referencedColumns: ["extender_id"]
          },
          {
            foreignKeyName: "extender_deployments_extender_id_fkey"
            columns: ["extender_id"]
            isOneToOne: false
            referencedRelation: "extenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extender_deployments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "extender_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      extender_permissions: {
        Row: {
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["land_permission"]
          reason: string
          version_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["land_permission"]
          reason?: string
          version_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["land_permission"]
          reason?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extender_permissions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "extender_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      extender_state: {
        Row: {
          actor: string | null
          created_at: string
          data: Json
          deployment_id: string
          id: string
          scope: string
          updated_at: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          data?: Json
          deployment_id: string
          id?: string
          scope: string
          updated_at?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          data?: Json
          deployment_id?: string
          id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extender_state_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "extender_deployments"
            referencedColumns: ["id"]
          },
        ]
      }
      extender_versions: {
        Row: {
          changelog: string
          created_at: string
          extender_id: string
          id: string
          manifest: Json
          published_at: string | null
          sdk_version: string
          semver: string
          status: Database["public"]["Enums"]["extender_status"]
        }
        Insert: {
          changelog?: string
          created_at?: string
          extender_id: string
          id?: string
          manifest?: Json
          published_at?: string | null
          sdk_version?: string
          semver: string
          status?: Database["public"]["Enums"]["extender_status"]
        }
        Update: {
          changelog?: string
          created_at?: string
          extender_id?: string
          id?: string
          manifest?: Json
          published_at?: string | null
          sdk_version?: string
          semver?: string
          status?: Database["public"]["Enums"]["extender_status"]
        }
        Relationships: [
          {
            foreignKeyName: "extender_versions_extender_id_fkey"
            columns: ["extender_id"]
            isOneToOne: false
            referencedRelation: "extender_public_stats"
            referencedColumns: ["extender_id"]
          },
          {
            foreignKeyName: "extender_versions_extender_id_fkey"
            columns: ["extender_id"]
            isOneToOne: false
            referencedRelation: "extenders"
            referencedColumns: ["id"]
          },
        ]
      }
      extenders: {
        Row: {
          category: string
          created_at: string
          creator_address: string | null
          creator_user_id: string
          description: string
          icon_inscription_id: string | null
          id: string
          is_ai_built: boolean
          license: string
          monetization: Database["public"]["Enums"]["extender_monetization"]
          name: string
          preview_inscription_id: string | null
          price_bit: number
          price_sats: number
          slug: string
          status: Database["public"]["Enums"]["extender_status"]
          summary: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          creator_address?: string | null
          creator_user_id: string
          description?: string
          icon_inscription_id?: string | null
          id?: string
          is_ai_built?: boolean
          license?: string
          monetization?: Database["public"]["Enums"]["extender_monetization"]
          name: string
          preview_inscription_id?: string | null
          price_bit?: number
          price_sats?: number
          slug: string
          status?: Database["public"]["Enums"]["extender_status"]
          summary?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          creator_address?: string | null
          creator_user_id?: string
          description?: string
          icon_inscription_id?: string | null
          id?: string
          is_ai_built?: boolean
          license?: string
          monetization?: Database["public"]["Enums"]["extender_monetization"]
          name?: string
          preview_inscription_id?: string | null
          price_bit?: number
          price_sats?: number
          slug?: string
          status?: Database["public"]["Enums"]["extender_status"]
          summary?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      forge_modules: {
        Row: {
          author_address: string
          author_user: string
          bit_cost: number
          block_count: number
          blocks: Json
          created_at: string
          id: string
          lineage: Json
          name: string
          sphere: string
          tribute_sats: number
          uses: number
        }
        Insert: {
          author_address: string
          author_user: string
          bit_cost?: number
          block_count: number
          blocks: Json
          created_at?: string
          id?: string
          lineage?: Json
          name: string
          sphere?: string
          tribute_sats?: number
          uses?: number
        }
        Update: {
          author_address?: string
          author_user?: string
          bit_cost?: number
          block_count?: number
          blocks?: Json
          created_at?: string
          id?: string
          lineage?: Json
          name?: string
          sphere?: string
          tribute_sats?: number
          uses?: number
        }
        Relationships: []
      }
      genesis_minters: {
        Row: {
          block_height: number
          inscription_id: string
          minter_address: string
          resolved_at: string
        }
        Insert: {
          block_height: number
          inscription_id: string
          minter_address: string
          resolved_at?: string
        }
        Update: {
          block_height?: number
          inscription_id?: string
          minter_address?: string
          resolved_at?: string
        }
        Relationships: []
      }
      goods_market: {
        Row: {
          base_price: number
          baseline_stock: number
          bought_total: number
          item_id: string
          sold_total: number
          stock: number
          updated_at: string
        }
        Insert: {
          base_price: number
          baseline_stock: number
          bought_total?: number
          item_id: string
          sold_total?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          baseline_stock?: number
          bought_total?: number
          item_id?: string
          sold_total?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      goods_trades: {
        Row: {
          address: string
          created_at: string
          id: string
          item_id: string
          quantity: number
          side: string
          total_coins: number
          unit_price: number
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          side: string
          total_coins: number
          unit_price: number
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          side?: string
          total_coins?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_trades_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "goods_market"
            referencedColumns: ["item_id"]
          },
        ]
      }
      guardian_auras: {
        Row: {
          aura: string
          created_at: string
          height: number
          id: string
          tier: string
          user_id: string
          wager_bit: number
        }
        Insert: {
          aura: string
          created_at?: string
          height: number
          id?: string
          tier: string
          user_id: string
          wager_bit: number
        }
        Update: {
          aura?: string
          created_at?: string
          height?: number
          id?: string
          tier?: string
          user_id?: string
          wager_bit?: number
        }
        Relationships: []
      }
      guardian_dispatches: {
        Row: {
          created_at: string
          directive: string
          ends_at: string
          guardian_height: number
          id: string
          recalled_at: string | null
          repeat: boolean
          started_at: string
          target_height: number | null
          user_id: string
          waypoints: Json
        }
        Insert: {
          created_at?: string
          directive: string
          ends_at: string
          guardian_height: number
          id?: string
          recalled_at?: string | null
          repeat?: boolean
          started_at?: string
          target_height?: number | null
          user_id: string
          waypoints: Json
        }
        Update: {
          created_at?: string
          directive?: string
          ends_at?: string
          guardian_height?: number
          id?: string
          recalled_at?: string | null
          repeat?: boolean
          started_at?: string
          target_height?: number | null
          user_id?: string
          waypoints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "guardian_dispatches_guardian_height_fkey"
            columns: ["guardian_height"]
            isOneToOne: false
            referencedRelation: "bitmon_guardians"
            referencedColumns: ["block_height"]
          },
        ]
      }
      guardian_loot: {
        Row: {
          bit: number
          boss_slug: string
          created_at: string
          guardian_height: number
          id: string
          item: string
          rarity: string
        }
        Insert: {
          bit?: number
          boss_slug: string
          created_at?: string
          guardian_height: number
          id?: string
          item: string
          rarity: string
        }
        Update: {
          bit?: number
          boss_slug?: string
          created_at?: string
          guardian_height?: number
          id?: string
          item?: string
          rarity?: string
        }
        Relationships: []
      }
      guardian_mount_unlocks: {
        Row: {
          block_height: number
          raid_id: number
          unlocked_at: string
          user_id: string
        }
        Insert: {
          block_height: number
          raid_id: number
          unlocked_at?: string
          user_id: string
        }
        Update: {
          block_height?: number
          raid_id?: number
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guardian_raids: {
        Row: {
          attacker_height: number
          defender_height: number
          dispatch_id: string
          id: string
          lap: number
          log: Json
          resolved_at: string
          spoils: number
          winner_height: number
        }
        Insert: {
          attacker_height: number
          defender_height: number
          dispatch_id: string
          id?: string
          lap?: number
          log?: Json
          resolved_at?: string
          spoils?: number
          winner_height: number
        }
        Update: {
          attacker_height?: number
          defender_height?: number
          dispatch_id?: string
          id?: string
          lap?: number
          log?: Json
          resolved_at?: string
          spoils?: number
          winner_height?: number
        }
        Relationships: [
          {
            foreignKeyName: "guardian_raids_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "guardian_dispatches"
            referencedColumns: ["id"]
          },
        ]
      }
      inscription_donations: {
        Row: {
          bits_awarded: number
          created_at: string
          donor_address: string
          donor_user_id: string
          id: string
          inscription_id: string
          note: string | null
          sats: number
          status: string
          txid: string | null
          updated_at: string
        }
        Insert: {
          bits_awarded?: number
          created_at?: string
          donor_address: string
          donor_user_id: string
          id?: string
          inscription_id: string
          note?: string | null
          sats?: number
          status?: string
          txid?: string | null
          updated_at?: string
        }
        Update: {
          bits_awarded?: number
          created_at?: string
          donor_address?: string
          donor_user_id?: string
          id?: string
          inscription_id?: string
          note?: string | null
          sats?: number
          status?: string
          txid?: string | null
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
      kennel_mints: {
        Row: {
          block_height: number
          buyer_address: string | null
          child_index: number
          created_at: string
          id: string
          inscription_id: string
          reveal_txid: string
        }
        Insert: {
          block_height: number
          buyer_address?: string | null
          child_index: number
          created_at?: string
          id?: string
          inscription_id: string
          reveal_txid: string
        }
        Update: {
          block_height?: number
          buyer_address?: string | null
          child_index?: number
          created_at?: string
          id?: string
          inscription_id?: string
          reveal_txid?: string
        }
        Relationships: []
      }
      land_grants: {
        Row: {
          bitmap_height: number
          created_at: string
          expires_at: string | null
          grantee_address: string
          grantee_user_id: string | null
          id: string
          note: string | null
          owner_address: string
          owner_user_id: string
          permissions: Database["public"]["Enums"]["land_permission"][]
        }
        Insert: {
          bitmap_height: number
          created_at?: string
          expires_at?: string | null
          grantee_address: string
          grantee_user_id?: string | null
          id?: string
          note?: string | null
          owner_address: string
          owner_user_id: string
          permissions?: Database["public"]["Enums"]["land_permission"][]
        }
        Update: {
          bitmap_height?: number
          created_at?: string
          expires_at?: string | null
          grantee_address?: string
          grantee_user_id?: string | null
          id?: string
          note?: string | null
          owner_address?: string
          owner_user_id?: string
          permissions?: Database["public"]["Enums"]["land_permission"][]
        }
        Relationships: []
      }
      land_terraform: {
        Row: {
          bitmap_height: number
          chunk_key: string
          id: string
          seeded_at: string
          seeded_by_address: string | null
          seeded_by_user_id: string
          tile_col: number
          tile_row: number
        }
        Insert: {
          bitmap_height: number
          chunk_key: string
          id?: string
          seeded_at?: string
          seeded_by_address?: string | null
          seeded_by_user_id: string
          tile_col: number
          tile_row: number
        }
        Update: {
          bitmap_height?: number
          chunk_key?: string
          id?: string
          seeded_at?: string
          seeded_by_address?: string | null
          seeded_by_user_id?: string
          tile_col?: number
          tile_row?: number
        }
        Relationships: []
      }
      launch_seats: {
        Row: {
          address: string
          created_at: string
          held_bitmap: number | null
          pixel_id: string
          pixel_source: string
          seat_number: number
          ticket_inscription_id: string | null
        }
        Insert: {
          address: string
          created_at?: string
          held_bitmap?: number | null
          pixel_id: string
          pixel_source?: string
          seat_number?: never
          ticket_inscription_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          held_bitmap?: number | null
          pixel_id?: string
          pixel_source?: string
          seat_number?: never
          ticket_inscription_id?: string | null
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
      map_chat_messages: {
        Row: {
          body: string
          created_at: string
          district_height: number | null
          handle: string | null
          id: string
          sender_address: string | null
          user_id: string
          visitor_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          district_height?: number | null
          handle?: string | null
          id?: string
          sender_address?: string | null
          user_id: string
          visitor_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          district_height?: number | null
          handle?: string | null
          id?: string
          sender_address?: string | null
          user_id?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      market_api_hits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      market_api_signatures: {
        Row: {
          action: string
          address: string
          sig_hash: string
          used_at: string
        }
        Insert: {
          action: string
          address: string
          sig_hash: string
          used_at?: string
        }
        Update: {
          action?: string
          address?: string
          sig_hash?: string
          used_at?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          created_at: string
          filled: number
          id: string
          item_id: string
          quantity: number
          seller_address: string
          seller_kind: string
          seller_name: string
          status: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          filled?: number
          id?: string
          item_id: string
          quantity: number
          seller_address: string
          seller_kind?: string
          seller_name?: string
          status?: string
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          filled?: number
          id?: string
          item_id?: string
          quantity?: number
          seller_address?: string
          seller_kind?: string
          seller_name?: string
          status?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "goods_market"
            referencedColumns: ["item_id"]
          },
        ]
      }
      market_npc_state: {
        Row: {
          bought_total: number
          id: boolean
          last_run: string
          listed_total: number
        }
        Insert: {
          bought_total?: number
          id?: boolean
          last_run?: string
          listed_total?: number
        }
        Update: {
          bought_total?: number
          id?: boolean
          last_run?: string
          listed_total?: number
        }
        Relationships: []
      }
      membership_badges: {
        Row: {
          active: boolean
          address: string
          expires_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          expires_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          address: string
          created_at: string
          expires_at: string | null
          id: string
          invoice_sats: number
          paid_at: string | null
          qualifying_trait: string | null
          source: string
          status: string
          txid: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invoice_sats: number
          paid_at?: string | null
          qualifying_trait?: string | null
          source?: string
          status?: string
          txid?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invoice_sats?: number
          paid_at?: string | null
          qualifying_trait?: string | null
          source?: string
          status?: string
          txid?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oasis_voxels: {
        Row: {
          kind: string
          placed_by: string
          updated_at: string
          x: number
          y: number
          z: number
        }
        Insert: {
          kind: string
          placed_by: string
          updated_at?: string
          x: number
          y: number
          z: number
        }
        Update: {
          kind?: string
          placed_by?: string
          updated_at?: string
          x?: number
          y?: number
          z?: number
        }
        Relationships: []
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
          reserved_by: string | null
          reserved_until: string | null
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
          reserved_by?: string | null
          reserved_until?: string | null
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
          reserved_by?: string | null
          reserved_until?: string | null
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
      passport_stamps: {
        Row: {
          bitmap_height: number | null
          created_at: string
          description: string
          earned_at: string
          evidence_event_id: string
          evidence_source_id: string
          evidence_source_type: string
          id: string
          inscription_id: string | null
          name: string
          rule_version: number
          stamp_key: string
          user_id: string
          visibility: string
          wallet_address: string
        }
        Insert: {
          bitmap_height?: number | null
          created_at?: string
          description: string
          earned_at?: string
          evidence_event_id: string
          evidence_source_id: string
          evidence_source_type: string
          id?: string
          inscription_id?: string | null
          name: string
          rule_version?: number
          stamp_key: string
          user_id: string
          visibility?: string
          wallet_address: string
        }
        Update: {
          bitmap_height?: number | null
          created_at?: string
          description?: string
          earned_at?: string
          evidence_event_id?: string
          evidence_source_id?: string
          evidence_source_type?: string
          id?: string
          inscription_id?: string | null
          name?: string
          rule_version?: number
          stamp_key?: string
          user_id?: string
          visibility?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_stamps_evidence_event_id_fkey"
            columns: ["evidence_event_id"]
            isOneToOne: false
            referencedRelation: "provenance_events"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_unlocks: {
        Row: {
          capability_key: string
          created_at: string
          description: string
          granted_at: string
          granted_by_stamp_id: string
          id: string
          name: string
          user_id: string
          visibility: string
          wallet_address: string
        }
        Insert: {
          capability_key: string
          created_at?: string
          description: string
          granted_at?: string
          granted_by_stamp_id: string
          id?: string
          name: string
          user_id: string
          visibility?: string
          wallet_address: string
        }
        Update: {
          capability_key?: string
          created_at?: string
          description?: string
          granted_at?: string
          granted_by_stamp_id?: string
          id?: string
          name?: string
          user_id?: string
          visibility?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_unlocks_granted_by_stamp_id_fkey"
            columns: ["granted_by_stamp_id"]
            isOneToOne: false
            referencedRelation: "passport_stamps"
            referencedColumns: ["id"]
          },
        ]
      }
      patoshi_blocks: {
        Row: {
          block_height: number
        }
        Insert: {
          block_height: number
        }
        Update: {
          block_height?: number
        }
        Relationships: []
      }
      play_profiles: {
        Row: {
          best_streak: number
          created_at: string
          losses: number
          matches: number
          profile: Json
          updated_at: string
          user_id: string
          wallet_address: string
          wins: number
        }
        Insert: {
          best_streak?: number
          created_at?: string
          losses?: number
          matches?: number
          profile: Json
          updated_at?: string
          user_id: string
          wallet_address: string
          wins?: number
        }
        Update: {
          best_streak?: number
          created_at?: string
          losses?: number
          matches?: number
          profile?: Json
          updated_at?: string
          user_id?: string
          wallet_address?: string
          wins?: number
        }
        Relationships: []
      }
      play_season_standings: {
        Row: {
          display_name: string
          losses: number
          points: number
          season: string
          titles: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          display_name: string
          losses?: number
          points?: number
          season: string
          titles?: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          display_name?: string
          losses?: number
          points?: number
          season?: string
          titles?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: []
      }
      play_tables: {
        Row: {
          code: string
          created_at: string
          guest_entrant: number | null
          guest_name: string | null
          guest_token_hash: string | null
          guest_user_id: string | null
          host_entrant: number | null
          host_heights: number[]
          host_name: string
          host_token_hash: string
          host_user_id: string | null
          recorded: boolean
          state: Json | null
          status: string
          tournament_code: string | null
          updated_at: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          guest_entrant?: number | null
          guest_name?: string | null
          guest_token_hash?: string | null
          guest_user_id?: string | null
          host_entrant?: number | null
          host_heights?: number[]
          host_name?: string
          host_token_hash: string
          host_user_id?: string | null
          recorded?: boolean
          state?: Json | null
          status?: string
          tournament_code?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          guest_entrant?: number | null
          guest_name?: string | null
          guest_token_hash?: string | null
          guest_user_id?: string | null
          host_entrant?: number | null
          host_heights?: number[]
          host_name?: string
          host_token_hash?: string
          host_user_id?: string | null
          recorded?: boolean
          state?: Json | null
          status?: string
          tournament_code?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      play_tournament_entrants: {
        Row: {
          entrant: number
          heights: number[]
          name: string
          token_hash: string
          tournament_code: string
          user_id: string | null
        }
        Insert: {
          entrant: number
          heights: number[]
          name: string
          token_hash: string
          tournament_code: string
          user_id?: string | null
        }
        Update: {
          entrant?: number
          heights?: number[]
          name?: string
          token_hash?: string
          tournament_code?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "play_tournament_entrants_tournament_code_fkey"
            columns: ["tournament_code"]
            isOneToOne: false
            referencedRelation: "play_tournaments"
            referencedColumns: ["code"]
          },
        ]
      }
      play_tournaments: {
        Row: {
          bracket: Json
          champion: number | null
          code: string
          created_at: string
          name: string
          players: Json
          size: number
          status: string
          updated_at: string
        }
        Insert: {
          bracket?: Json
          champion?: number | null
          code: string
          created_at?: string
          name: string
          players?: Json
          size: number
          status?: string
          updated_at?: string
        }
        Update: {
          bracket?: Json
          champion?: number | null
          code?: string
          created_at?: string
          name?: string
          players?: Json
          size?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_builds: {
        Row: {
          bitmap_height: number
          builder_address: string | null
          chunk_key: string
          clan_id: string | null
          clan_tag: string | null
          created_at: string
          id: string
          kind: string
          user_id: string
          x: number
          yaw: number
          z: number
        }
        Insert: {
          bitmap_height: number
          builder_address?: string | null
          chunk_key: string
          clan_id?: string | null
          clan_tag?: string | null
          created_at?: string
          id?: string
          kind: string
          user_id: string
          x: number
          yaw?: number
          z: number
        }
        Update: {
          bitmap_height?: number
          builder_address?: string | null
          chunk_key?: string
          clan_id?: string | null
          clan_tag?: string | null
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
          x?: number
          yaw?: number
          z?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_builds_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      player_friend_codes: {
        Row: {
          code: string
          handle: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          handle?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          handle?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      player_friends: {
        Row: {
          a: string
          b: string
          created_at: string
          requested_by: string
          status: string
        }
        Insert: {
          a: string
          b: string
          created_at?: string
          requested_by: string
          status?: string
        }
        Update: {
          a?: string
          b?: string
          created_at?: string
          requested_by?: string
          status?: string
        }
        Relationships: []
      }
      player_share_dividends: {
        Row: {
          created_at: string
          holders: number
          id: string
          player_id: string
          shares_issued: number
          source_reason: string | null
          total_coins: number
        }
        Insert: {
          created_at?: string
          holders: number
          id?: string
          player_id: string
          shares_issued: number
          source_reason?: string | null
          total_coins: number
        }
        Update: {
          created_at?: string
          holders?: number
          id?: string
          player_id?: string
          shares_issued?: number
          source_reason?: string | null
          total_coins?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_share_dividends_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "rank_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_share_holdings: {
        Row: {
          cost_basis: number
          created_at: string
          dividends_earned: number
          holder_address: string
          id: string
          player_id: string
          shares: number
          updated_at: string
        }
        Insert: {
          cost_basis?: number
          created_at?: string
          dividends_earned?: number
          holder_address: string
          id?: string
          player_id: string
          shares?: number
          updated_at?: string
        }
        Update: {
          cost_basis?: number
          created_at?: string
          dividends_earned?: number
          holder_address?: string
          id?: string
          player_id?: string
          shares?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_share_holdings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "rank_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_share_trades: {
        Row: {
          address: string
          created_at: string
          fee_coins: number
          id: string
          player_id: string
          shares: number
          shares_issued_after: number
          side: string
          total_coins: number
          unit_price: number
        }
        Insert: {
          address: string
          created_at?: string
          fee_coins?: number
          id?: string
          player_id: string
          shares: number
          shares_issued_after: number
          side: string
          total_coins: number
          unit_price: number
        }
        Update: {
          address?: string
          created_at?: string
          fee_coins?: number
          id?: string
          player_id?: string
          shares?: number
          shares_issued_after?: number
          side?: string
          total_coins?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_share_trades_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "rank_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stock: {
        Row: {
          bit_raised: number
          created_at: string
          dividends_paid: number
          fees_paid: number
          is_open: boolean
          last_price: number
          opened_at: string | null
          owner_address: string | null
          player_id: string
          shares_issued: number
          shares_offered: number
          updated_at: string
        }
        Insert: {
          bit_raised?: number
          created_at?: string
          dividends_paid?: number
          fees_paid?: number
          is_open?: boolean
          last_price?: number
          opened_at?: string | null
          owner_address?: string | null
          player_id: string
          shares_issued?: number
          shares_offered?: number
          updated_at?: string
        }
        Update: {
          bit_raised?: number
          created_at?: string
          dividends_paid?: number
          fees_paid?: number
          is_open?: boolean
          last_price?: number
          opened_at?: string | null
          owner_address?: string | null
          player_id?: string
          shares_issued?: number
          shares_offered?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_stock_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "rank_players"
            referencedColumns: ["id"]
          },
        ]
      }
      provenance_events: {
        Row: {
          actor_user_id: string | null
          actor_wallet: string | null
          bitmap_height: number | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          proof_level: string
          source_id: string
          source_key: string
          source_type: string
          summary: string
          title: string
          visibility: string
        }
        Insert: {
          actor_user_id?: string | null
          actor_wallet?: string | null
          bitmap_height?: number | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          proof_level: string
          source_id: string
          source_key: string
          source_type: string
          summary?: string
          title: string
          visibility?: string
        }
        Update: {
          actor_user_id?: string | null
          actor_wallet?: string | null
          bitmap_height?: number | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          proof_level?: string
          source_id?: string
          source_key?: string
          source_type?: string
          summary?: string
          title?: string
          visibility?: string
        }
        Relationships: []
      }
      pvp_events: {
        Row: {
          bitmap: number | null
          created_at: string
          district: string | null
          id: string
          karma_delta: number
          killer_id: string | null
          victim_id: string | null
          was_pk: boolean
        }
        Insert: {
          bitmap?: number | null
          created_at?: string
          district?: string | null
          id?: string
          karma_delta?: number
          killer_id?: string | null
          victim_id?: string | null
          was_pk?: boolean
        }
        Update: {
          bitmap?: number | null
          created_at?: string
          district?: string | null
          id?: string
          karma_delta?: number
          killer_id?: string | null
          victim_id?: string | null
          was_pk?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pvp_events_killer_id_fkey"
            columns: ["killer_id"]
            isOneToOne: false
            referencedRelation: "rank_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pvp_events_victim_id_fkey"
            columns: ["victim_id"]
            isOneToOne: false
            referencedRelation: "rank_players"
            referencedColumns: ["id"]
          },
        ]
      }
      raid_squad_members: {
        Row: {
          boss_slug: string
          guardian_height: number
          id: string
          joined_at: string
          ready_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          boss_slug: string
          guardian_height: number
          id?: string
          joined_at?: string
          ready_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          boss_slug?: string
          guardian_height?: number
          id?: string
          joined_at?: string
          ready_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      rank_clan_members: {
        Row: {
          clan_id: string
          created_at: string
          player_id: string
          rank: string
        }
        Insert: {
          clan_id: string
          created_at?: string
          player_id: string
          rank?: string
        }
        Update: {
          clan_id?: string
          created_at?: string
          player_id?: string
          rank?: string
        }
        Relationships: [
          {
            foreignKeyName: "rank_clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "rank_clans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_clan_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "rank_players"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_clans: {
        Row: {
          created_at: string
          crest_color: string
          fame: number
          home_bitmap: number | null
          id: string
          leader_id: string | null
          level: number
          members_count: number
          motto: string
          name: string
          pk_kills: number
          tag: string
          updated_at: string
          xp: number
        }
        Insert: {
          created_at?: string
          crest_color?: string
          fame?: number
          home_bitmap?: number | null
          id?: string
          leader_id?: string | null
          level?: number
          members_count?: number
          motto?: string
          name: string
          pk_kills?: number
          tag: string
          updated_at?: string
          xp?: number
        }
        Update: {
          created_at?: string
          crest_color?: string
          fame?: number
          home_bitmap?: number | null
          id?: string
          leader_id?: string | null
          level?: number
          members_count?: number
          motto?: string
          name?: string
          pk_kills?: number
          tag?: string
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      rank_players: {
        Row: {
          bit_earned: number
          builds_maintained: number
          chaotic_count: number
          clan_id: string | null
          created_at: string
          deaths: number
          districts_visited: number
          fame: number
          home_bitmap: number | null
          id: string
          karma: number
          last_death_at: string | null
          last_district: string | null
          last_kill_at: string | null
          level: number
          name: string
          pk_kills: number
          pvp_kills: number
          status: string
          title: string
          updated_at: string
          user_id: string | null
          wallet: string | null
        }
        Insert: {
          bit_earned?: number
          builds_maintained?: number
          chaotic_count?: number
          clan_id?: string | null
          created_at?: string
          deaths?: number
          districts_visited?: number
          fame?: number
          home_bitmap?: number | null
          id?: string
          karma?: number
          last_death_at?: string | null
          last_district?: string | null
          last_kill_at?: string | null
          level?: number
          name: string
          pk_kills?: number
          pvp_kills?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          wallet?: string | null
        }
        Update: {
          bit_earned?: number
          builds_maintained?: number
          chaotic_count?: number
          clan_id?: string | null
          created_at?: string
          deaths?: number
          districts_visited?: number
          fame?: number
          home_bitmap?: number | null
          id?: string
          karma?: number
          last_death_at?: string | null
          last_district?: string | null
          last_kill_at?: string | null
          level?: number
          name?: string
          pk_kills?: number
          pvp_kills?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
          wallet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rank_players_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "rank_clans"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          owner_address: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          owner_address: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          owner_address?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_paid: number
          code: string
          created_at: string
          id: string
          override_earned: number
          referee_address: string
          referee_user_id: string | null
          referrer_address: string
        }
        Insert: {
          bonus_paid?: number
          code: string
          created_at?: string
          id?: string
          override_earned?: number
          referee_address: string
          referee_user_id?: string | null
          referrer_address: string
        }
        Update: {
          bonus_paid?: number
          code?: string
          created_at?: string
          id?: string
          override_earned?: number
          referee_address?: string
          referee_user_id?: string | null
          referrer_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      shadow_commitments: {
        Row: {
          commitment_hash: string
          created_at: string
          event_id: string
          id: string
        }
        Insert: {
          commitment_hash: string
          created_at?: string
          event_id: string
          id?: string
        }
        Update: {
          commitment_hash?: string
          created_at?: string
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadow_commitments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shadow_events"
            referencedColumns: ["id"]
          },
        ]
      }
      shadow_events: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          issuer_user_id: string | null
          max_passes: number
          passes_issued: number
          slug: string
          starts_at: string
          subtitle: string
          territory_block: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          issuer_user_id?: string | null
          max_passes: number
          passes_issued?: number
          slug: string
          starts_at?: string
          subtitle?: string
          territory_block: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          issuer_user_id?: string | null
          max_passes?: number
          passes_issued?: number
          slug?: string
          starts_at?: string
          subtitle?: string
          territory_block?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      shadow_l1_notes: {
        Row: {
          confirmed_height: number | null
          created_at: string
          digest_hex: string
          id: string
          op: string
          pass_index: number
          payload_hex: string
          slug: string
          status: string
          territory_block: number
          txid: string
          updated_at: string
        }
        Insert: {
          confirmed_height?: number | null
          created_at?: string
          digest_hex: string
          id?: string
          op: string
          pass_index?: number
          payload_hex: string
          slug: string
          status?: string
          territory_block: number
          txid: string
          updated_at?: string
        }
        Update: {
          confirmed_height?: number | null
          created_at?: string
          digest_hex?: string
          id?: string
          op?: string
          pass_index?: number
          payload_hex?: string
          slug?: string
          status?: string
          territory_block?: number
          txid?: string
          updated_at?: string
        }
        Relationships: []
      }
      shadow_spent_commitments: {
        Row: {
          commitment_hash: string
          event_id: string
          spent_at: string
        }
        Insert: {
          commitment_hash: string
          event_id: string
          spent_at?: string
        }
        Update: {
          commitment_hash?: string
          event_id?: string
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadow_spent_commitments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shadow_events"
            referencedColumns: ["id"]
          },
        ]
      }
      shadow_whispers: {
        Row: {
          content: string
          created_at: string
          event_id: string
          id: string
          nullifier_hash: string
        }
        Insert: {
          content: string
          created_at?: string
          event_id: string
          id?: string
          nullifier_hash: string
        }
        Update: {
          content?: string
          created_at?: string
          event_id?: string
          id?: string
          nullifier_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadow_whispers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "shadow_events"
            referencedColumns: ["id"]
          },
        ]
      }
      shard_raid_claims: {
        Row: {
          claimed_at: string
          id: string
          raid_id: number
          shard_height: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          raid_id: number
          shard_height: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          raid_id?: number
          shard_height?: number
          user_id?: string
        }
        Relationships: []
      }
      shord_mint_claims: {
        Row: {
          block_height: number | null
          claim_hash: string
          commit_address: string
          commitment: string
          created_at: string
          id: string
          inscription_id: string | null
          reveal_txid: string | null
          status: string
          updated_at: string
        }
        Insert: {
          block_height?: number | null
          claim_hash: string
          commit_address: string
          commitment: string
          created_at?: string
          id?: string
          inscription_id?: string | null
          reveal_txid?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          block_height?: number | null
          claim_hash?: string
          commit_address?: string
          commitment?: string
          created_at?: string
          id?: string
          inscription_id?: string | null
          reveal_txid?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shord_pool_deposits: {
        Row: {
          commitment: string
          created_at: string
          deposit_txid: string | null
          holder_address: string
          id: string
          inscription_id: string
          signature: string
          status: string
          updated_at: string
        }
        Insert: {
          commitment: string
          created_at?: string
          deposit_txid?: string | null
          holder_address: string
          id?: string
          inscription_id: string
          signature: string
          status?: string
          updated_at?: string
        }
        Update: {
          commitment?: string
          created_at?: string
          deposit_txid?: string | null
          holder_address?: string
          id?: string
          inscription_id?: string
          signature?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shord_pool_leaves: {
        Row: {
          commitment: string
          created_at: string
          deposit_txid: string | null
          idx: number
          inscription_id: string | null
          kind: string
          root_after: string
        }
        Insert: {
          commitment: string
          created_at?: string
          deposit_txid?: string | null
          idx: number
          inscription_id?: string | null
          kind: string
          root_after: string
        }
        Update: {
          commitment?: string
          created_at?: string
          deposit_txid?: string | null
          idx?: number
          inscription_id?: string | null
          kind?: string
          root_after?: string
        }
        Relationships: []
      }
      shord_pool_nullifiers: {
        Row: {
          created_at: string
          envelope_hex: string | null
          nullifier: string
          out_commitment: string
          relay_error: string | null
          relay_fee_sats: number | null
          relay_status: string
          relay_txid: string | null
          root: string
        }
        Insert: {
          created_at?: string
          envelope_hex?: string | null
          nullifier: string
          out_commitment: string
          relay_error?: string | null
          relay_fee_sats?: number | null
          relay_status?: string
          relay_txid?: string | null
          root: string
        }
        Update: {
          created_at?: string
          envelope_hex?: string | null
          nullifier?: string
          out_commitment?: string
          relay_error?: string | null
          relay_fee_sats?: number | null
          relay_status?: string
          relay_txid?: string | null
          root?: string
        }
        Relationships: []
      }
      shord_pool_withdrawals: {
        Row: {
          created_at: string
          destination: string
          fee_sats: number | null
          inscription_id: string
          nullifier: string
          status: string
          txid: string | null
        }
        Insert: {
          created_at?: string
          destination: string
          fee_sats?: number | null
          inscription_id: string
          nullifier: string
          status?: string
          txid?: string | null
        }
        Update: {
          created_at?: string
          destination?: string
          fee_sats?: number | null
          inscription_id?: string
          nullifier?: string
          status?: string
          txid?: string | null
        }
        Relationships: []
      }
      stand_seats: {
        Row: {
          address: string
          created_at: string
          held_bitmap: number
          id: string
          issued_at: string
          seat_number: number
          signature: string
          stand_id: string
        }
        Insert: {
          address: string
          created_at?: string
          held_bitmap: number
          id?: string
          issued_at: string
          seat_number: number
          signature: string
          stand_id: string
        }
        Update: {
          address?: string
          created_at?: string
          held_bitmap?: number
          id?: string
          issued_at?: string
          seat_number?: number
          signature?: string
          stand_id?: string
        }
        Relationships: []
      }
      toon_libraries: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      toon_submissions: {
        Row: {
          created_at: string
          creator_name: string | null
          episode: Json
          id: string
          review_note: string | null
          reviewed_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_name?: string | null
          episode: Json
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_name?: string | null
          episode?: Json
          id?: string
          review_note?: string | null
          reviewed_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      trade_crawl_state: {
        Row: {
          block_height: number
          inscription_id: string | null
          last_error: string | null
          last_traced_at: string
          trades_found: number
          transfers: number
        }
        Insert: {
          block_height: number
          inscription_id?: string | null
          last_error?: string | null
          last_traced_at?: string
          trades_found?: number
          transfers?: number
        }
        Update: {
          block_height?: number
          inscription_id?: string | null
          last_error?: string | null
          last_traced_at?: string
          trades_found?: number
          transfers?: number
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
      trait_holder_badges: {
        Row: {
          active: boolean
          address: string
          bitmap_height: number
          expires_at: string
          inscription_id: string
          trait_ids: string[]
          updated_at: string
          verified_at: string
        }
        Insert: {
          active?: boolean
          address: string
          bitmap_height: number
          expires_at: string
          inscription_id: string
          trait_ids?: string[]
          updated_at?: string
          verified_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          bitmap_height?: number
          expires_at?: string
          inscription_id?: string
          trait_ids?: string[]
          updated_at?: string
          verified_at?: string
        }
        Relationships: []
      }
      ui_translations: {
        Row: {
          created_at: string
          lang: string
          source: string
          source_key: string
          translated: string
        }
        Insert: {
          created_at?: string
          lang: string
          source: string
          source_key: string
          translated: string
        }
        Update: {
          created_at?: string
          lang?: string
          source?: string
          source_key?: string
          translated?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voxel_bag_meta: {
        Row: {
          last_harvest_at: string
          user_id: string
        }
        Insert: {
          last_harvest_at?: string
          user_id: string
        }
        Update: {
          last_harvest_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voxel_bags: {
        Row: {
          count: number
          kind: string
          user_id: string
        }
        Insert: {
          count?: number
          kind: string
          user_id: string
        }
        Update: {
          count?: number
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      voxel_tools: {
        Row: {
          created_at: string
          tool: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tool: string
          user_id: string
        }
        Update: {
          created_at?: string
          tool?: string
          user_id?: string
        }
        Relationships: []
      }
      walker_raid_scores: {
        Row: {
          damage: number
          kills: number
          last_hit_at: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          damage?: number
          kills?: number
          last_hit_at?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          damage?: number
          kills?: number
          last_hit_at?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      walker_raids: {
        Row: {
          hp: number
          id: string
          last_killer: string | null
          max_hp: number
          respawn_at: string | null
          updated_at: string
        }
        Insert: {
          hp: number
          id: string
          last_killer?: string | null
          max_hp: number
          respawn_at?: string | null
          updated_at?: string
        }
        Update: {
          hp?: number
          id?: string
          last_killer?: string | null
          max_hp?: number
          respawn_at?: string | null
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
          residency_height: number | null
          residency_name: string | null
          residency_name_inscription_id: string | null
          updated_at: string
        }
        Insert: {
          address: string
          avatar_inscription_id?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          owner_user_id?: string | null
          residency_height?: number | null
          residency_name?: string | null
          residency_name_inscription_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          avatar_inscription_id?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          owner_user_id?: string | null
          residency_height?: number | null
          residency_name?: string | null
          residency_name_inscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      world_structures: {
        Row: {
          bitmap_height: number
          builder_address: string | null
          builder_user_id: string
          chunk_key: string
          created_at: string
          id: string
          kind: string
          tile_col: number
          tile_row: number
          x: number
          yaw: number
          z: number
        }
        Insert: {
          bitmap_height: number
          builder_address?: string | null
          builder_user_id: string
          chunk_key: string
          created_at?: string
          id?: string
          kind: string
          tile_col: number
          tile_row: number
          x: number
          yaw?: number
          z: number
        }
        Update: {
          bitmap_height?: number
          builder_address?: string | null
          builder_user_id?: string
          chunk_key?: string
          created_at?: string
          id?: string
          kind?: string
          tile_col?: number
          tile_row?: number
          x?: number
          yaw?: number
          z?: number
        }
        Relationships: []
      }
    }
    Views: {
      extender_public_stats: {
        Row: {
          active_deployments: number | null
          extender_id: string | null
          last_published_at: string | null
          published_versions: number | null
        }
        Insert: {
          active_deployments?: never
          extender_id?: string | null
          last_published_at?: never
          published_versions?: never
        }
        Update: {
          active_deployments?: never
          extender_id?: string | null
          last_published_at?: never
          published_versions?: never
        }
        Relationships: []
      }
    }
    Functions: {
      adrenaline_claim: { Args: { _user: string }; Returns: Json }
      archaeology_ledger: { Args: never; Returns: Json }
      atlas_region_stats: {
        Args: { p_hi: number; p_lo: number }
        Returns: Json
      }
      biternam_claim_backroom: {
        Args: { _commitment: string; _slug: string; _user: string }
        Returns: string
      }
      biternam_claim_quest: {
        Args: {
          _address: string
          _bit: number
          _quest: string
          _steps: number
          _user: string
        }
        Returns: string
      }
      biternam_record_step: {
        Args: { _index: number; _key: string; _quest: string; _user: string }
        Returns: string
      }
      bitmap_has_height_trait: {
        Args: { _height: number; _trait: string }
        Returns: boolean
      }
      block_fact_trait: {
        Args: { _height: number; _trait: string }
        Returns: boolean
      }
      can_build_bitmap: {
        Args: { _height: number; _owner_address: string; _user_id: string }
        Returns: boolean
      }
      can_build_on_height: { Args: { _height: number }; Returns: boolean }
      claim_block_facts_crawl: {
        Args: { _lock_seconds: number }
        Returns: number
      }
      clan_builds_by_tag: {
        Args: { _tag: string }
        Returns: {
          bitmap_height: number
          chunk_key: string
          created_at: string
          id: string
          kind: string
          x: number
          yaw: number
          z: number
        }[]
      }
      clan_for_users: {
        Args: { _user_ids: string[] }
        Returns: {
          clan_id: string
          clan_name: string
          clan_tag: string
          crest_inscription_id: string
          user_id: string
        }[]
      }
      clan_level_for_xp: { Args: { _xp: number }; Returns: number }
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
      coin_spend: {
        Args: {
          _address: string
          _amount: number
          _reason: string
          _ref?: string
        }
        Returns: number
      }
      coin_start_lease: {
        Args: { _days: number; _lessee_address: string; _offer_id: string }
        Returns: string
      }
      create_clan: {
        Args: { _crest_inscription_id: string; _name: string; _tag: string }
        Returns: string
      }
      crew_move: {
        Args: { _height: number; _kind: string; _n: number; _user: string }
        Returns: string
      }
      goods_price: {
        Args: { _base: number; _baseline: number; _stock: number }
        Returns: number
      }
      goods_trade: {
        Args: { _address: string; _item: string; _qty: number; _side: string }
        Returns: {
          filled: number
          price: number
          stock: number
          total_coins: number
          unit_price: number
        }[]
      }
      has_passport_unlock: {
        Args: { _capability_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_clan_member: {
        Args: { _clan_id: string; _user_id: string }
        Returns: boolean
      }
      join_rank_clan: {
        Args: { _clan_id: string; _wallet: string }
        Returns: {
          clan_id: string
          clan_tag: string
          player_id: string
        }[]
      }
      join_rank_clan_admin: {
        Args: { _clan_id: string; _user_id: string; _wallet: string }
        Returns: {
          clan_id: string
          clan_tag: string
          player_id: string
        }[]
      }
      land_raid_spoils: {
        Args: { _bit: number; _height: number }
        Returns: undefined
      }
      land_terraform_in_chunks: {
        Args: { _keys: string[] }
        Returns: {
          bitmap_height: number
          chunk_key: string
          id: string
          seeded_at: string
          seeded_by_address: string
          tile_col: number
          tile_row: number
        }[]
      }
      map_bitmap_models: {
        Args: {
          _col_from: number
          _col_to: number
          _row_from: number
          _row_to: number
        }
        Returns: {
          animation_count: number
          bitmap_height: number
          height_offset: number
          inscription_id: string
          owner_address: string
          rotation_y: number
          scale: number
          triangle_count: number
        }[]
      }
      map_owners: {
        Args: {
          _col_from: number
          _col_to: number
          _row_from: number
          _row_to: number
        }
        Returns: {
          block_height: number
          owner_address: string
        }[]
      }
      market_api_claim_signature: {
        Args: { _action: string; _address: string; _hash: string }
        Returns: boolean
      }
      market_api_hit: {
        Args: { _bucket: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      market_buy_listing: {
        Args: { _buyer_address: string; _listing_id: string; _qty: number }
        Returns: {
          filled: number
          item_id: string
          total_coins: number
          unit_price: number
        }[]
      }
      market_cancel_listing: {
        Args: { _address: string; _listing_id: string }
        Returns: {
          item_id: string
          remaining: number
        }[]
      }
      market_list_goods: {
        Args: {
          _address: string
          _item: string
          _qty: number
          _unit_price: number
        }
        Returns: string
      }
      market_npc_tick: {
        Args: never
        Returns: {
          bought: number
          listed: number
          skipped: boolean
        }[]
      }
      official_trait_bitmaps: {
        Args: { p_limit?: number; p_offset?: number; p_trait: string }
        Returns: {
          block_height: number
          genesis_height: number
          inscription_id: string
          owner_address: string
          total_count: number
        }[]
      }
      owns_wallet: {
        Args: { _address: string; _user_id: string }
        Returns: boolean
      }
      owns_wallet_address: { Args: { _address: string }; Returns: boolean }
      play_season_record: {
        Args: {
          _name: string
          _season: string
          _title: boolean
          _user_id: string
          _win: boolean
        }
        Returns: undefined
      }
      player_share_base_value: { Args: { _player_id: string }; Returns: number }
      player_share_price: {
        Args: { _base: number; _issued: number }
        Returns: number
      }
      player_stock_issue: {
        Args: { _address: string; _player_id: string; _shares_offered: number }
        Returns: {
          fee_coins: number
          is_open: boolean
          price: number
          shares_issued: number
          shares_offered: number
        }[]
      }
      player_stock_pay_dividend: {
        Args: { _amount: number; _player_id: string; _source: string }
        Returns: number
      }
      player_stock_trade: {
        Args: {
          _address: string
          _player_id: string
          _shares: number
          _side: string
        }
        Returns: {
          filled: number
          price: number
          shares_issued: number
          total_coins: number
          unit_price: number
        }[]
      }
      record_bitmap_view: {
        Args: { _address?: string; _height: number; _visitor: string }
        Returns: undefined
      }
      referral_claim: {
        Args: { _address: string; _code: string; _user_id: string }
        Returns: string
      }
      referral_ensure_code: {
        Args: { _address: string; _user_id: string }
        Returns: string
      }
      referral_pay_override: {
        Args: { _amount: number; _ref: string; _referee_address: string }
        Returns: number
      }
      refresh_coin_leaderboard_public: { Args: never; Returns: undefined }
      release_offer_reservation: {
        Args: { _buyer: string; _offer_id: string }
        Returns: boolean
      }
      reserve_offer: {
        Args: { _buyer: string; _offer_id: string; _seconds?: number }
        Returns: {
          ok: boolean
          reason: string
          reserved_until: string
        }[]
      }
      shadow_claim_pass: {
        Args: { _commitment: string; _slug: string }
        Returns: {
          max_passes: number
          ok: boolean
          pass_index: number
          passes_issued: number
          reason: string
        }[]
      }
      shadow_post_whisper: {
        Args: {
          _commitment: string
          _content: string
          _nullifier: string
          _slug: string
        }
        Returns: boolean
      }
      shadow_transfer_pass: {
        Args: { _new_commitment: string; _salt: string; _slug: string }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      shadow_verify_pass: {
        Args: { _commitment: string; _slug: string }
        Returns: boolean
      }
      voxel_bag_add: {
        Args: { _kind: string; _n: number; _user: string }
        Returns: boolean
      }
      voxel_bag_ensure: { Args: { _user: string }; Returns: undefined }
      voxel_craft: { Args: { _out: string; _user: string }; Returns: string }
      voxel_edit: {
        Args: {
          _kind: string
          _user: string
          _x: number
          _y: number
          _z: number
        }
        Returns: string
      }
      voxel_forge: { Args: { _tool: string; _user: string }; Returns: string }
      voxel_harvest: { Args: { _kind: string; _user: string }; Returns: string }
      voxel_pay: { Args: { _cost: Json; _user: string }; Returns: boolean }
      voxel_stamp: { Args: { _blocks: Json; _user: string }; Returns: string }
      voxel_trade: { Args: { _offer: string; _user: string }; Returns: string }
      walker_hit: {
        Args: { _damage: number; _name: string; _user: string; _walker: string }
        Returns: {
          hp: number
          killed: boolean
          max_hp: number
          respawn_at: string
        }[]
      }
      world_metrics: { Args: never; Returns: Json }
      world_metrics_daily: {
        Args: { _days?: number }
        Returns: {
          bit_minted: number
          day: string
          mined: number
          trade_volume: number
          trades: number
        }[]
      }
      world_structures_in_chunks: {
        Args: { _keys: string[] }
        Returns: {
          bitmap_height: number
          builder_address: string
          chunk_key: string
          created_at: string
          id: string
          kind: string
          tile_col: number
          tile_row: number
          x: number
          yaw: number
          z: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      extender_monetization: "free" | "paid" | "lease"
      extender_status: "draft" | "published" | "archived"
      land_permission:
        | "view"
        | "enter"
        | "build"
        | "edit"
        | "deploy"
        | "manage"
        | "lease"
        | "monetize"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      extender_monetization: ["free", "paid", "lease"],
      extender_status: ["draft", "published", "archived"],
      land_permission: [
        "view",
        "enter",
        "build",
        "edit",
        "deploy",
        "manage",
        "lease",
        "monetize",
      ],
    },
  },
} as const
