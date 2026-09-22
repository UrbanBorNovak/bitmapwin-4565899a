import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Public chat room for the land map. Anyone can read; a signed-in account can
 * post. Messages carry the visitor id so the colour of a person's live cursor
 * dot on the map matches their colour in the chat.
 */

export type MapChatMessage = {
  id: string;
  visitorId: string | null;
  handle: string | null;
  senderAddress: string | null;
  districtHeight: number | null;
  body: string;
  createdAt: string;
};

export const MAP_CHAT_MAX_LENGTH = 500;

export async function fetchMapChat(): Promise<MapChatMessage[]> {
  const { data, error } = await supabase
    .from("map_chat_messages")
    .select("id, visitor_id, handle, sender_address, district_height, body, created_at")
    .order("created_at", { ascending: false })
    .limit(120);
  if (error) throw error;
  return (data ?? [])
    .map((row) => ({
      id: row.id,
      visitorId: row.visitor_id,
      handle: row.handle,
      senderAddress: row.sender_address,
      districtHeight: row.district_height === null ? null : Number(row.district_height),
      body: row.body,
      createdAt: row.created_at,
    }))
    .reverse();
}

export const mapChatQuery = () =>
  queryOptions({
    queryKey: ["map-chat"],
    queryFn: fetchMapChat,
    staleTime: 5_000,
  });

export async function sendMapChatMessage(input: {
  userId: string;
  visitorId: string;
  handle: string;
  senderAddress: string | null;
  districtHeight: number | null;
  body: string;
}) {
  const body = input.body.trim().slice(0, MAP_CHAT_MAX_LENGTH);
  if (!body) throw new Error("MESSAGE IS EMPTY");
  const { error } = await supabase.from("map_chat_messages").insert({
    user_id: input.userId,
    visitor_id: input.visitorId,
    handle: input.handle,
    sender_address: input.senderAddress,
    district_height: input.districtHeight,
    body,
  });
  if (error) throw error;
}

export async function deleteMapChatMessage(id: string) {
  const { error } = await supabase.from("map_chat_messages").delete().eq("id", id);
  if (error) throw error;
}
