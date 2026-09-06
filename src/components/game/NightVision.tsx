/**
 * NIGHT VISION — the goggles' view.
 *
 * While the goggles are on in first person, the world reads as an intensified
 * green image: brightened and desaturated through the overlay, ringed with a
 * dark vignette and lightly scanlined so it looks like a tube, not a filter.
 */

export function NightVision({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-20" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "brightness(2.1) saturate(0.15) contrast(1.15)",
          WebkitBackdropFilter: "brightness(2.1) saturate(0.15) contrast(1.15)",
          backgroundColor: "rgba(40, 255, 110, 0.16)",
          mixBlendMode: "screen",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 4px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 42%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0.9) 100%)",
        }}
      />
      <div className="absolute left-4 top-4 font-mono text-[10px] tracking-[0.2em] text-[#7dffa8]">
        NV · ON
      </div>
    </div>
  );
}
