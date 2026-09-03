CREATE TABLE public.map_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  visitor_id TEXT,
  handle TEXT,
  sender_address TEXT,
  district_height BIGINT,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX map_chat_messages_created_at_idx ON public.map_chat_messages (created_at DESC);

GRANT SELECT ON public.map_chat_messages TO anon;
GRANT SELECT, INSERT, DELETE ON public.map_chat_messages TO authenticated;
GRANT ALL ON public.map_chat_messages TO service_role;

ALTER TABLE public.map_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Map chat is public to read"
  ON public.map_chat_messages FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Signed in accounts can post map chat"
  ON public.map_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can delete their own map chat"
  ON public.map_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.map_chat_messages;