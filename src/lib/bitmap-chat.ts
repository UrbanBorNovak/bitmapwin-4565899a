import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public per-bitmap chat room. Anyone can read a bitmap's messages; only a
 * signed-in account can post, tagged with the wallet address it has connected.
 */

export type ChatMessage = {
  id: string;
  bitmapHeight: number;
  userId: string;
  senderAddress: string | null;
  body: string;
  createdAt: string;
};

export const CHAT_MAX_LENGTH = 500;

export async function fetchBitmapChat(height: number): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("bitmap_chat_messages")
    .select("id, bitmap_height, user_id, sender_address, body, created_at")
    .eq("bitmap_height", height)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      bitmapHeight: Number(row.bitmap_height),
      userId: row.user_id,
      senderAddress: row.sender_address,
      body: row.body,
      createdAt: row.created_at,
    }))
    .reverse();
}

export const bitmapChatQuery = (height: number) =>
  queryOptions({
    queryKey: ["bitmap-chat", height],
    queryFn: () => fetchBitmapChat(height),
    staleTime: 5_000,
  });

export async function sendBitmapChatMessage(input: {
  height: number;
  userId: string;
  senderAddress: string | null;
  body: string;
}) {
  const body = input.body.trim().slice(0, CHAT_MAX_LENGTH);
  if (!body) throw new Error("MESSAGE IS EMPTY");
  const { error } = await supabase.from("bitmap_chat_messages").insert({
    bitmap_height: input.height,
    user_id: input.userId,
    sender_address: input.senderAddress,
    body,
  });
  if (error) throw error;
}

export async function deleteBitmapChatMessage(id: string) {
  const { error } = await supabase.from("bitmap_chat_messages").delete().eq("id", id);
  if (error) throw error;
}
