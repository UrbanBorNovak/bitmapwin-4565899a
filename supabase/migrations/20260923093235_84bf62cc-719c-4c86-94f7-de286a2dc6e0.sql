-- bitmap_chat_messages: hide user_id from anonymous readers
REVOKE SELECT ON public.bitmap_chat_messages FROM anon;
GRANT SELECT (id, bitmap_height, sender_address, body, created_at) ON public.bitmap_chat_messages TO anon;

-- bitmap_views: hide visitor_key from anonymous readers
REVOKE SELECT ON public.bitmap_views FROM anon;
GRANT SELECT (id, bitmap_height, viewer_address, created_at) ON public.bitmap_views TO anon;

-- builder_follows: hide user_id from anonymous readers
REVOKE SELECT ON public.builder_follows FROM anon;
GRANT SELECT (id, builder_address, created_at) ON public.builder_follows TO anon;

-- land_terraform: hide seeded_by_user_id from anonymous readers
REVOKE SELECT ON public.land_terraform FROM anon;
GRANT SELECT (id, chunk_key, bitmap_height, tile_col, tile_row, seeded_at, seeded_by_address) ON public.land_terraform TO anon;

-- world_structures: hide builder_user_id from anonymous readers
REVOKE SELECT ON public.world_structures FROM anon;
GRANT SELECT (id, chunk_key, bitmap_height, tile_col, tile_row, kind, x, z, yaw, builder_address, created_at) ON public.world_structures TO anon;

-- wallet_profiles: hide owner_user_id from anonymous readers
REVOKE SELECT ON public.wallet_profiles FROM anon;
GRANT SELECT (address, display_name, bio, avatar_inscription_id, created_at, updated_at) ON public.wallet_profiles TO anon;