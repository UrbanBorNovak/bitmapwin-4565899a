/**
 * CHARACTER PORTRAIT — the live 3D figure on a page (not in the world).
 *
 * Wraps the inventory shelf's preview canvas so 2D pages can show the same
 * figure, with the same worn kit, behind a client-only gate.
 */

import { ClientOnly } from "@tanstack/react-router";
import { EquippedAvatarPreview } from "@/components/game/CharacterSheet";
import type { WeaponKind } from "@/components/game/weapons";

export function CharacterPortrait({
  model,
  weapon = null,
  className = "h-72",
}: {
  model: string | null;
  weapon?: WeaponKind | null;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`} data-no-translate>
      <ClientOnly
        fallback={
          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-muted-foreground">
            &gt; LOADING FIGURE…
          </div>
        }
      >
        <EquippedAvatarPreview model={model} weapon={weapon} flying={false} />
      </ClientOnly>
      <span className="pointer-events-none absolute left-2 top-2 text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
        LIVE LOADOUT
      </span>
    </div>
  );
}
