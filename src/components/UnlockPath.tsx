import { Lock, Unlock } from "lucide-react";
import type { PassportStamp, PassportUnlock } from "@/lib/passport";
import { UNLOCK_RULES } from "@/lib/passport";
export function UnlockPath({ stamps, unlocks }: { stamps: PassportStamp[]; unlocks: PassportUnlock[] }) {
  const earned = new Set(stamps.map((s) => s.stampKey)); const active = new Set(unlocks.map((u) => u.capabilityKey));
  return <div className="grid gap-px bg-border sm:grid-cols-2">
    {Object.entries(UNLOCK_RULES).map(([key, rule]) => { const on = active.has(key as any); return <div key={key} className="bg-background p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="display text-sm">{rule.name}</h3>{on ? <Unlock className="size-4 text-bitcoin" /> : <Lock className="size-4 text-muted-foreground" />}</div>
      <p className="mt-2 text-xs text-muted-foreground">{rule.description}</p><p className="label mt-3 text-[9px]">{on ? "UNLOCKED" : earned.has(rule.stamp) ? "VERIFYING" : `REQUIRES ${rule.stamp.replaceAll("-", " ")}`}</p>
    </div>; })}
  </div>;
}
