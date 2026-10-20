/** Your Guardian agents in the Oasis: each moves around its own BITMAP by what its brain chose. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useQuery } from "@tanstack/react-query";
import type { Group } from "three";
import { supabase } from "@/integrations/supabase/client";
import { myGuardiansQuery, type AwakeGuardian } from "@/lib/bitmon-queries";
import { driveNow, driveOffset, type Drive } from "@/lib/guardian-brain";
import { WORLD_CELL, WORLD_GRID, cellX, cellZ } from "@/lib/player-state";
import { groundY } from "@/lib/world-terrain";
import { GuardianBody } from "@/components/bitmon/GuardianBody";

function Agent({ g, unit }: { g: AwakeGuardian; unit: number }) {
  const ref = useRef<Group>(null);
  const drive = useRef<Drive>("rest");
  const last = useRef(0);
  const home = useMemo(() => ({ x: cellX(g.height % WORLD_GRID), z: cellZ(Math.floor(g.height / WORLD_GRID)) }), [g.height]);
  useFrame(() => {
    const now = Date.now();
    if (now - last.current > 15000) { drive.current = driveNow(g.height, now).drive; last.current = now; }
    const t = now / 1000;
    const o = driveOffset(drive.current, g.height, t);
    const o2 = driveOffset(drive.current, g.height, t + 0.1);
    const x = home.x + o.dx * WORLD_CELL, z = home.z + o.dz * WORLD_CELL;
    if (ref.current) {
      ref.current.position.set(x, groundY(x, z), z);
      if (o.moving) ref.current.rotation.y = Math.atan2(o2.dx - o.dx, o2.dz - o.dz);
    }
  });
  return (
    <group ref={ref}>
      <GuardianBody species={g.species} rarity={g.rarity} body={g.body} accent={g.accent} unit={unit} height={g.height} inscribed={!!g.inscriptionId} />
    </group>
  );
}

export function GuardianAgentsOasis({ unit }: { unit: number }) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);
  const mine = useQuery(myGuardiansQuery(userId));
  return <>{(mine.data ?? []).slice(0, 24).map((g) => <Agent key={g.height} g={g} unit={unit} />)}</>;
}
