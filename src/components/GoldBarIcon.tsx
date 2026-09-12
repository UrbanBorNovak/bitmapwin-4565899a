import { ordContentUrl } from "@/lib/oci";

/** The on-chain gold bar image everyone sees next to smelted bars. */
export const GOLD_BAR_ICON_INSCRIPTION =
  "bb6e4d1717b3a57dff49326fd939784bae48db05ec24e9a323d5776552194299i0";

/**
 * Small on-chain icon for a smelted gold bar. Pixel art, so it is kept crisp
 * rather than smoothed as it scales.
 */
export function GoldBarIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <img
      src={ordContentUrl(GOLD_BAR_ICON_INSCRIPTION)}
      alt="Gold bar"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ width: size, height: size, imageRendering: "pixelated", objectFit: "contain" }}
    />
  );
}
