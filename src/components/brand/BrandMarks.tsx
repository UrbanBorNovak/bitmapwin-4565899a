// Brand marks. Monolith Cell = core BITMAP (solid orange block, terminal-cursor cutout).
// Swarm Stinger = lottery pool insignia (the Monolith pierced by a cyan data needle).
export function MonolithCell({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" fill="var(--bitcoin)" />
      <rect x="1" y="1" width="30" height="30" fill="none" stroke="var(--background)" strokeOpacity="0.35" strokeWidth="1" />
      <rect x="18" y="21" width="9" height="4" fill="var(--background)" />
      <rect x="5" y="5" width="4" height="4" fill="var(--background)" fillOpacity="0.25" />
    </svg>
  );
}

export function SwarmStinger({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="10" y="10" width="28" height="28" fill="var(--bitcoin)" />
      <rect x="25" y="29" width="8" height="4" fill="var(--background)" />
      {/* needle */}
      <path d="M2 2 L27 23 L24 26 Z" fill="var(--signal)" />
      <path d="M2 2 L27 23" stroke="var(--signal)" strokeWidth="1.2" />
      {/* swarm pulses */}
      <rect x="40" y="6" width="3" height="3" fill="var(--signal)" fillOpacity="0.8" />
      <rect x="43" y="14" width="2" height="2" fill="var(--signal)" fillOpacity="0.6" />
      <rect x="4" y="40" width="3" height="3" fill="var(--signal)" fillOpacity="0.7" />
      <rect x="12" y="44" width="2" height="2" fill="var(--signal)" fillOpacity="0.5" />
      <rect x="9" y="9" width="30" height="30" fill="none" stroke="var(--signal)" strokeOpacity="0.5" strokeWidth="0.75" />
    </svg>
  );
}
