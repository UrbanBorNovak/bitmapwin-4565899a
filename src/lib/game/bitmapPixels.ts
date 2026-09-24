import { useEffect, useState } from "react";
import { getBitmapPixelsCollection, type BitmapPixel } from "@/lib/bitmap-pixels.functions";
import { hash } from "./cardFactory";

let pixels: BitmapPixel[] | null = null;
let loading: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function loadBitmapPixels() {
  if (pixels || loading) return;
  loading = getBitmapPixelsCollection()
    .then((collection) => {
      pixels = collection.pixels;
      subscribers.forEach((notify) => notify());
    })
    .catch(() => {
      loading = null;
    });
}

export function bitmapPixelForHeight(height: number, collection: BitmapPixel[]): BitmapPixel | null {
  if (collection.length === 0) return null;
  return collection[hash(height) % collection.length] ?? null;
}

/** Shared, immutable collection cache used by every PLAY card surface. */
export function useBitmapPixels(): BitmapPixel[] | null {
  const [, rerender] = useState(0);
  useEffect(() => {
    const notify = () => rerender((value) => value + 1);
    subscribers.add(notify);
    loadBitmapPixels();
    return () => void subscribers.delete(notify);
  }, []);
  return pixels;
}