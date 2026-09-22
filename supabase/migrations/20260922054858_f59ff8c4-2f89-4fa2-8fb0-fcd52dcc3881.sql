DROP VIEW IF EXISTS public.map_chat_public;

-- Public reads are allowed again, but only on columns that carry no account identity.
DROP POLICY IF EXISTS "Map chat is public to read" ON public.map_chat_messages;
CREATE POLICY "Map chat is public to read"
ON public.map_chat_messages FOR SELECT TO anon, authenticated
USING (true);

REVOKE SELECT ON public.map_chat_messages FROM anon, authenticated;
GRANT SELECT (id, visitor_id, handle, sender_address, district_height, body, created_at)
  ON public.map_chat_messages TO anon, authenticated;
GRANT INSERT, DELETE ON public.map_chat_messages TO authenticated;
GRANT ALL ON public.map_chat_messages TO service_role;