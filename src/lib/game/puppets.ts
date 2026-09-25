import { useEffect, useState } from "react";

export const PUPPETS_PARENT = "89d8bfdc528550b34b22741d579645ba7c0899f534c617ed6f18609b280c1bc2i0";
export const PUPPETS_POOL = "BITCOIN HOODS";
/** Safety cap while reading children pages; the real supply is whatever the parent has on-chain. */
export const PUPPETS_SUPPLY = 500;
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
