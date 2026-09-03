import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OwnerWindow } from "@/lib/map-owners";

export type BitmapModel = {
  bitmapHeight: number;
  ownerAddress: string;
  inscriptionId: string;
  scale: number;
  rotationY: number;
  heightOffset: number;
  triangleCount: number;
  animationCount: number;
};

const mapRow = (row: {
  bitmap_height: number; owner_address: string; inscription_id: string; scale: number;
  rotation_y: number; height_offset: number; triangle_count: number; animation_count: number;
}): BitmapModel => ({
  bitmapHeight: Number(row.bitmap_height), ownerAddress: row.owner_address, inscriptionId: row.inscription_id,
  scale: Number(row.scale), rotationY: Number(row.rotation_y), heightOffset: Number(row.height_offset),
  triangleCount: row.triangle_count, animationCount: row.animation_count,
});

export const bitmapModelQuery = (height: number) => queryOptions({
  queryKey: ["bitmap-model", height],
  queryFn: async () => {
    const { data, error } = await supabase.from("bitmap_models").select("*").eq("bitmap_height", height).maybeSingle();
    if (error) throw error;
    return data ? mapRow(data) : null;
  },
  staleTime: 60_000,
});

export const mapBitmapModelsQuery = (window_: OwnerWindow | null) => queryOptions({
  queryKey: ["map-bitmap-models", window_?.rowFrom, window_?.rowTo, window_?.colFrom, window_?.colTo],
  queryFn: async () => {
    if (!window_) return [];
    const { data, error } = await supabase.rpc("map_bitmap_models", {
      _row_from: window_.rowFrom, _row_to: window_.rowTo, _col_from: window_.colFrom, _col_to: window_.colTo,
    });
    if (error) throw error;
    return (data ?? []).map(mapRow);
  },
  enabled: Boolean(window_),
  staleTime: 60_000,
});
/** Every model this wallet has published on its own BITMAPs — real on-chain inventory. */
export const myBitmapModelsQuery = (addresses: string[]) =>
  queryOptions({
    queryKey: ["my-bitmap-models", [...addresses].sort()],
    queryFn: async () => {
      if (addresses.length === 0) return [];
      const { data, error } = await supabase
        .from("bitmap_models")
        .select("*")
        .in("owner_address", addresses)
        .order("bitmap_height", { ascending: true });
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
    enabled: addresses.length > 0,
    staleTime: 60_000,
  });
