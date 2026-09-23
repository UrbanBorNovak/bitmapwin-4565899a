import { Lock, Unlock } from "lucide-react";
import type { PassportStamp, PassportUnlock } from "@/lib/passport";
import { UNLOCK_RULES } from "@/lib/passport";
export function UnlockPath({ stamps, unlocks }: { stamps: PassportStamp[]; unlocks: PassportUnlock[] }) {
  const earned = new Set(stamps.map((s) => s.stampKey)); const active = new Set(unlocks.map((u) => u.capabilityKey));
  return <div className="grid gap-px bg-[var(--passport-line)] sm:grid-cols-2">
    {Object.entries(UNLOCK_RULES).map(([key, rule]) => { const on = active.has(key as any); return <div key={key} className={`p-4 ${on ? "bg-[var(--passport-green)]" : "bg-[var(--passport-panel)]"}`}>
      <div className="flex items-center justify-between gap-3"><h3 className="font-mono text-sm font-bold text-[var(--passport-paper)]">{rule.name}</h3>{on ? <Unlock className="size-4 text-[var(--passport-gold)]" /> : <Lock className="size-4 text-[var(--passport-muted)]" />}</div>
      <p className="mt-2 text-xs text-[var(--passport-muted)]">{rule.description}</p><p className="passport-kicker mt-3 text-[8px]">{on ? "UNLOCKED" : earned.has(rule.stamp) ? "VERIFYING" : `REQUIRES ${rule.stamp.replaceAll("-", " ")}`}</p>
    </div>; })}
  </div>;
}
