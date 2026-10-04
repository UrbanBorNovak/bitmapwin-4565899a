/**
 * After a reveal is broadcast, polls the chain until the inscription confirms
 * and indexes, then records it on the Guardian via on-chain proof only.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { verifyDelegateGuardianFn } from "@/lib/bitmon.functions";

export function InscriptionWatcher({ inscriptionId, height }: { inscriptionId: string; height: number }) {
  const verify = useServerFn(verifyDelegateGuardianFn);
  const qc = useQueryClient();
  const [state, setState] = useState<{ done: boolean; msg: string }>({ done: false, msg: "WAITING FOR THE REVEAL TO CONFIRM…" });

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await verify({ data: { inscriptionId } });
        if (stop) return;
        if (r.awakened) {
          setState({ done: true, msg: "VERIFIED ON CHAIN · RECORDED AS A COLLECTION ITEM" });
          qc.invalidateQueries({ queryKey: ["guardian", height] });
          qc.invalidateQueries({ queryKey: ["guardians"] });
          return true;
        }
        setState({ done: false, msg: r.denied ?? "WAITING…" });
      } catch {
        /* keep polling */
      }
      return false;
    };
    let id: number | undefined;
    void tick().then((ok) => {
      if (!ok && !stop) id = window.setInterval(async () => { if (await tick()) window.clearInterval(id); }, 30_000);
    });
    return () => { stop = true; if (id) window.clearInterval(id); };
  }, [inscriptionId, height, verify, qc]);

  return (
    <div className="space-y-1 border border-signal/60 p-2 font-mono text-[10px]">
      <p className="text-signal">INSCRIPTION ID</p>
      <p className="break-all text-foreground">{inscriptionId}</p>
      <p className={state.done ? "text-bitcoin" : "text-muted-foreground"}>{state.done ? "◆ " : "… "}{state.msg}</p>
      <a className="text-signal underline" target="_blank" rel="noreferrer" href={`https://ordinals.com/inscription/${inscriptionId}`}>VIEW ON ORDINALS ↗</a>
    </div>
  );
}
