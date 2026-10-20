/**
 * Tracy-9 on your wrist in the Oasis: she calls in when you board a ride or
 * walk into a sealed gateway. Reacts only to existing world events.
 */
import { useEffect, useRef, useState } from "react";
import { TracyCom } from "@/components/game/TracyCom";
import { cueKey, cueScript, onTracyCue, shouldSpeak, tracyCue, type TracyScript } from "@/lib/tracy-com";
import { currentRide, isDriving, subscribeVehicle } from "@/lib/world-vehicle";

export function OasisTracy({ hidden = false }: { hidden?: boolean }) {
  const [call, setCall] = useState<{ n: number; script: TracyScript } | null>(null);
  const last = useRef(new Map<string, number>());
  const wasDriving = useRef(isDriving());

  useEffect(() => {
    const offCue = onTracyCue((cue) => {
      const key = cueKey(cue);
      const now = Date.now();
      if (!shouldSpeak(last.current.get(key), now)) return;
      last.current.set(key, now);
      setCall((c) => ({ n: (c?.n ?? 0) + 1, script: cueScript(cue) }));
    });
    const offRide = subscribeVehicle(() => {
      const d = isDriving();
      if (d && !wasDriving.current) {
        const ride = currentRide();
        tracyCue({ kind: "board", rideId: ride.id, label: ride.label });
      }
      wasDriving.current = d;
    });
    return () => { offCue(); offRide(); };
  }, []);

  if (!call || hidden) return null;
  return (
    <div className="pointer-events-none absolute right-3 top-32 z-[85]">
      <TracyCom key={call.n} passive script={call.script} onEnd={() => setCall(null)} />
    </div>
  );
}
