import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Districts: named neighborhoods an owner assembles from the bitmaps they hold.
 * Writes are guarded by RLS (`owns_wallet`), so only a signed-in user with a
 * verified wallet link for the owner address can create or edit one.
 */

export type District = {
  id: string;
  slug: string;
  ownerAddress: string;
  name: string;
  description: string | null;
  accent: string | null;
  updatedAt: string | null;
  heights: number[];
};

const SELECT = "id, slug, owner_address, name, description, accent, updated_at, district_bitmaps(bitmap_height)";

type Row = {
  id: string;
  slug: string;
  owner_address: string;
  name: string;
  description: string | null;
  accent: string | null;
  updated_at: string | null;
  district_bitmaps: { bitmap_height: number }[] | null;
};

function toDistrict(row: Row): District {
  return {
    id: row.id,
    slug: row.slug,
    ownerAddress: row.owner_address,
    name: row.name,
    description: row.description,
    accent: row.accent,
    updatedAt: row.updated_at,
    heights: (row.district_bitmaps ?? [])
      .map((d) => Number(d.bitmap_height))
      .sort((a, b) => a - b),
  };
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function fetchDistricts(limit = 60): Promise<District[]> {
  const { data, error } = await supabase
    .from("districts")
    .select(SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toDistrict);
}

export async function fetchDistrictsByOwner(address: string): Promise<District[]> {
  const { data, error } = await supabase
    .from("districts")
    .select(SELECT)
    .eq("owner_address", address)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toDistrict);
}

export async function fetchDistrictBySlug(slug: string): Promise<District | null> {
  const { data, error } = await supabase.from("districts").select(SELECT).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? toDistrict(data as unknown as Row) : null;
}

export async function fetchDistrictsForHeights(heights: number[]): Promise<Map<number, District>> {
  const map = new Map<number, District>();
  if (heights.length === 0) return map;
  const { data, error } = await supabase
    .from("district_bitmaps")
    .select("bitmap_height, districts(" + SELECT + ")")
    .in("bitmap_height", heights);
  if (error) throw error;
  for (const row of (data ?? []) as unknown as { bitmap_height: number; districts: Row | null }[]) {
    if (row.districts) map.set(Number(row.bitmap_height), toDistrict(row.districts));
  }
  return map;
}

export async function createDistrict(input: {
  ownerAddress: string;
  name: string;
  description: string | null;
  accent: string | null;
}): Promise<District> {
  const base = slugify(input.name) || "district";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("districts")
    .insert({
      slug,
      owner_address: input.ownerAddress,
      name: input.name,
      description: input.description,
      accent: input.accent,
    })
    .select(SELECT)
    .single();
  if (error) throw error;
  return toDistrict(data as unknown as Row);
}

export async function updateDistrict(input: {
  id: string;
  name: string;
  description: string | null;
  accent: string | null;
}) {
  const { error } = await supabase
    .from("districts")
    .update({ name: input.name, description: input.description, accent: input.accent })
    .eq("id", input.id);
  if (error) throw error;
}

export async function deleteDistrict(id: string) {
  const { error } = await supabase.from("districts").delete().eq("id", id);
  if (error) throw error;
}

export async function addBitmapToDistrict(districtId: string, height: number) {
  const { error } = await supabase
    .from("district_bitmaps")
    .insert({ district_id: districtId, bitmap_height: height });
  if (error) throw error;
}

export async function removeBitmapFromDistrict(districtId: string, height: number) {
  const { error } = await supabase
    .from("district_bitmaps")
    .delete()
    .eq("district_id", districtId)
    .eq("bitmap_height", height);
  if (error) throw error;
}

export const districtsQuery = (limit = 60) =>
  queryOptions({ queryKey: ["districts", limit], queryFn: () => fetchDistricts(limit), staleTime: 30_000 });

export const districtsByOwnerQuery = (address: string | null) =>
  queryOptions({
    queryKey: ["districts", "owner", address],
    queryFn: () => fetchDistrictsByOwner(address as string),
    enabled: Boolean(address),
    staleTime: 15_000,
  });

export const districtBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["district", slug],
    queryFn: () => fetchDistrictBySlug(slug),
    staleTime: 30_000,
  });

export const districtForHeightQuery = (height: number) =>
  queryOptions({
    queryKey: ["district", "height", height],
    queryFn: async () => (await fetchDistrictsForHeights([height])).get(height) ?? null,
    staleTime: 30_000,
  });
