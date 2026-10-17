import { useSyncExternalStore } from "react";

/** A queued open ask. Each item is still bought with its own wallet-signed PSBT. */
export type CartItem = { offerId: string; height: number; priceSats: number; inscriptionId: string };

const KEY = "bitmapwin.sweep-cart.v1";
export const CART_MAX = 20;
let items: CartItem[] = [];
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (Array.isArray(raw)) items = raw.filter((i) => i && typeof i.offerId === "string").slice(0, CART_MAX);
  } catch { items = []; }
}
function emit(next: CartItem[]) {
  items = next;
  try { window.localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full */ }
  subs.forEach((f) => f());
}

/** Adds items not already queued, keeping the cap. */
export function mergeCart(cur: CartItem[], add: CartItem[], max = CART_MAX): CartItem[] {
  const seen = new Set(cur.map((i) => i.offerId));
  const out = [...cur];
  for (const a of add) if (!seen.has(a.offerId) && out.length < max) { out.push(a); seen.add(a.offerId); }
  return out;
}
export const cartTotal = (list: CartItem[]) => list.reduce((s, i) => s + i.priceSats, 0);

export const cart = {
  add: (add: CartItem[]) => { load(); emit(mergeCart(items, add)); },
  toggle: (i: CartItem) => { load(); emit(items.some((x) => x.offerId === i.offerId) ? items.filter((x) => x.offerId !== i.offerId) : mergeCart(items, [i])); },
  remove: (offerId: string) => { load(); emit(items.filter((x) => x.offerId !== offerId)); },
  clear: () => emit([]),
};

const EMPTY: CartItem[] = [];
export function useCart(): CartItem[] {
  return useSyncExternalStore(
    (f) => { load(); subs.add(f); f(); return () => subs.delete(f); },
    () => items,
    () => EMPTY,
  );
}
