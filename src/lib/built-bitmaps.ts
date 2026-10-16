import { queryOptions } from "@tanstack/react-query";
import { getBuiltWorldFn } from "@/lib/built-bitmaps.functions";

/** Shared directory of built BITMAPs + placed voxels for the Oasis and the maps. */
export const builtWorldQuery = () =>
  queryOptions({
    queryKey: ["built-world"],
    queryFn: () => getBuiltWorldFn(),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });
