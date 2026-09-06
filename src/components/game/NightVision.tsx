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
      {/* Step one: strip all colour out of the world and push the gain up, the
          way an image tube sees — everything becomes bright grey. */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "grayscale(1) brightness(2.3) contrast(1.35)",
          WebkitBackdropFilter: "grayscale(1) brightness(2.3) contrast(1.35)",
        }}
      />
      {/* Step two: that grey image can now only come through as green. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "#19ff6a", mixBlendMode: "multiply" }}
      />
      {/* A faint phosphor glow so the darkest corners still read green. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(20, 190, 80, 0.14)", mixBlendMode: "screen" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.26) 0px, rgba(0,0,0,0.26) 1px, transparent 1px, transparent 4px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 38%, rgba(0,0,0,0.6) 76%, rgba(0,0,0,0.95) 100%)",
        }}
      />
      <div className="absolute left-4 top-4 font-mono text-[10px] tracking-[0.2em] text-[#7dffa8]">
        NV · ON
      </div>
    </div>
  );
}
