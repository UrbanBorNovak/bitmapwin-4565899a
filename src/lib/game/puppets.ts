import { useEffect, useState } from "react";

export const PUPPETS_PARENT = "c1e3330f25adaec23b5361ef1c1412e3fc29d5615f19fe02bf4c017a80c6031bi0";
export const PUPPETS_POOL = "BITMAP EMPORIUM";
/** Safety cap while reading children pages; the real supply is whatever the parent has on-chain. */
export const PUPPETS_SUPPLY = 20000;
/** Map span: BITMAP heights 0 … MAP_SPAN-1. */
const MAP_SPAN = 840_000;
// Multiplier coprime with MAP_SPAN → puppet index → unique BITMAP (a fixed permutation).
const MULT = 492_179;
const OFFSET = 253_952;

export type Puppet = { index: number; inscriptionId: string; bitmap: number };

/** Deterministic, unique BITMAP where puppet #index is found. */
export function puppetBitmap(index: number): number {
  return (index * MULT + OFFSET) % MAP_SPAN;
}

type PuppetSet = { list: Puppet[]; byBitmap: Map<number, Puppet> };
let state: PuppetSet | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();

function load() {
  if (state || loading) return;
  loading = import("./puppets.functions")
    .then(({ getPuppetsFn }) => getPuppetsFn())
    .then(({ ids }) => {
      const list = ids.map((inscriptionId, index) => ({ index, inscriptionId, bitmap: puppetBitmap(index) }));
      state = { list, byBitmap: new Map(list.map((p) => [p.bitmap, p])) };
      subs.forEach((f) => f());
    })
    .catch(() => {
      loading = null;
    });
}

export function usePuppets(): PuppetSet | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    subs.add(f);
    load();
    return () => void subs.delete(f);
  }, []);
  return state;
}
