CREATE TABLE public.bitmap_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bitmap_height INTEGER NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_address TEXT,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX bitmap_chat_messages_height_created_idx ON public.bitmap_chat_messages (bitmap_height, created_at DESC);

GRANT SELECT ON public.bitmap_chat_messages TO anon;
GRANT SELECT, INSERT, DELETE ON public.bitmap_chat_messages TO authenticated;
GRANT ALL ON public.bitmap_chat_messages TO service_role;

ALTER TABLE public.bitmap_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bitmap chat is public to read" ON public.bitmap_chat_messages FOR SELECT USING (true);
CREATE POLICY "Signed-in users can post as themselves" ON public.bitmap_chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors can remove their messages" ON public.bitmap_chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.bitmap_chat_messages;
ALTER TABLE public.bitmap_chat_messages REPLICA IDENTITY FULL;