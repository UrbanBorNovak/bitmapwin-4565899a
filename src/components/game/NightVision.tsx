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
      {/* Step one: push the gain up, the way an image tube sees — the world
          stays readable instead of becoming a flat green wash. */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: "grayscale(0.85) brightness(3.1) contrast(1.1)",
          WebkitBackdropFilter: "grayscale(0.85) brightness(3.1) contrast(1.1)",
        }}
      />
      {/* Step two: tint the brightened image green, but keep it translucent
          enough that shapes and details come through. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(25, 255, 106, 0.42)", mixBlendMode: "multiply" }}
      />
      {/* A faint phosphor glow so the darkest corners still read green. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(20, 190, 80, 0.08)", mixBlendMode: "screen" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 4px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 46%, rgba(0,0,0,0.42) 80%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      <div className="absolute left-4 top-4 font-mono text-[10px] tracking-[0.2em] text-[#7dffa8]">
        NV · ON
      </div>
    </div>
  );
}
