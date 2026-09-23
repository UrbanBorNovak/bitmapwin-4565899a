import { useEffect, useState } from "react";

export const ORD_TORCHES_PARENT = "d080f9aa909aa6a2e498d5db8326f2a0817d9f27bc20bade8c8e8cdf3c4aa128i0";
export const ORD_TORCHES_SUPPLY = 3000;
export const ORD_TORCHES_POOL = "ORD TORCHES";
/** Map span: BITMAP heights 0 … MAP_SPAN-1. */
const MAP_SPAN = 840_000;
// Multiplier coprime with MAP_SPAN → torch index → unique BITMAP (a fixed permutation).
const MULT = 386_513;
const OFFSET = 715_093;

export type OrdTorch = { index: number; inscriptionId: string; bitmap: number };

/** Deterministic, unique BITMAP where torch #index is found. */
export function torchBitmap(index: number): number {
  return (index * MULT + OFFSET) % MAP_SPAN;
}

type TorchSet = { list: OrdTorch[]; byBitmap: Map<number, OrdTorch> };
let state: TorchSet | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();

function load() {
  if (state || loading) return;
  loading = import("./ordTorches.functions")
    .then(({ getOrdTorchesFn }) => getOrdTorchesFn())
    .then(({ ids }) => {
      const list = ids.map((inscriptionId, index) => ({ index, inscriptionId, bitmap: torchBitmap(index) }));
      state = { list, byBitmap: new Map(list.map((t) => [t.bitmap, t])) };
      subs.forEach((f) => f());
    })
    .catch(() => {
      loading = null;
    });
}

export function useOrdTorches(): TorchSet | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    load();
    return () => void subs.delete(f);
  }, []);
  return state;
}
