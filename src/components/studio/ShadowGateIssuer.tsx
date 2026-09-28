import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getMyShadowEventsFn, issueShadowEventFn, setShadowEventActiveFn } from "@/lib/shadow-assets.functions";

/** Holders open a Shadow Gate on a BITMAP they hold and choose how many passes exist. */
export function ShadowGateIssuer() {
  const qc = useQueryClient();
  const loadMine = useServerFn(getMyShadowEventsFn);
  const issue = useServerFn(issueShadowEventFn);
  const toggle = useServerFn(setShadowEventActiveFn);
  const mine = useQuery({ queryKey: ["my-shadow-gates"], queryFn: () => loadMine() });

  const [height, setHeight] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [maxPasses, setMaxPasses] = useState("21");

  const open = useMutation({
    mutationFn: () =>
      issue({
        data: {
          height: Number(height),
          title: title.trim(),
          subtitle: subtitle.trim(),
          description: description.trim(),
          maxPasses: Number(maxPasses),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) return void toast.error(res.reason ?? "GATE REFUSED");
      toast.success("GATE OPEN · PASSES CAN NOW BE TAKEN");
      setTitle(""); setSubtitle(""); setDescription("");
      void qc.invalidateQueries({ queryKey: ["my-shadow-gates"] });
      void qc.invalidateQueries({ queryKey: ["shadow-gates-all"] });
    },
    onError: () => toast.error("GATE UNREACHABLE"),
  });

  const flip = useMutation({
    mutationFn: (v: { slug: string; active: boolean }) => toggle({ data: v }),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.reason ?? "NOT YOUR GATE");
      void qc.invalidateQueries({ queryKey: ["my-shadow-gates"] });
    },
  });

  const valid = /^\d+$/.test(height) && title.trim().length >= 3 && Number(maxPasses) >= 1 && Number(maxPasses) <= 1000;
  const input = "w-full border border-border bg-background px-2 py-1.5 font-mono text-xs";

  return (
    <div className="border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <h2 className="label">SHADOW GATES</h2>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          Open a private room on land you hold. Visitors take a pass without showing their wallet.
        </p>
      </header>
      <div className="space-y-2 p-4">
        <input className={input} inputMode="numeric" placeholder="YOUR BITMAP (e.g. 819245)" value={height} onChange={(e) => setHeight(e.target.value.replace(/\D/g, ""))} />
        <input className={input} maxLength={60} placeholder="NAME — e.g. THE ORANGE TAVERN BACKROOM" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className={input} maxLength={80} placeholder="ONE-LINE TEASER (optional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        <textarea className={`${input} min-h-16`} maxLength={600} placeholder="WHAT HAPPENS INSIDE (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="flex items-center gap-2">
          <span className="label shrink-0">PASSES</span>
          <input className={input} inputMode="numeric" value={maxPasses} onChange={(e) => setMaxPasses(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </label>
        <button
          type="button"
          disabled={!valid || open.isPending}
          onClick={() => open.mutate()}
          className="w-full border border-signal px-3 py-2 font-mono text-xs text-signal hover:bg-signal hover:text-background disabled:opacity-40"
        >
          {open.isPending ? "CHECKING YOU HOLD IT…" : "◈ OPEN SHADOW GATE"}
        </button>
      </div>
      {(mine.data ?? []).length > 0 ? (
        <ul className="border-t border-border p-2">
          {mine.data!.map((g) => (
            <li key={g.slug} className="flex items-center justify-between gap-2 px-2 py-1.5">
              <Link to="/bitmap/$block" params={{ block: String(g.territoryBlock) }} hash="shadow-gate" className="min-w-0">
                <p className="truncate font-mono text-xs">{g.title}</p>
                <p className="label text-muted-foreground">
                  {g.territoryBlock}.BITMAP · {g.passesIssued}/{g.maxPasses}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => flip.mutate({ slug: g.slug, active: !g.isActive })}
                className={`shrink-0 border px-2 py-1 font-mono text-[10px] ${g.isActive ? "border-signal text-signal" : "border-border text-muted-foreground"}`}
              >
                {g.isActive ? "OPEN · CLOSE" : "CLOSED · REOPEN"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
