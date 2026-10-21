/**
 * GATE ACCESS — the step-through decision for one Shadow Gate archway, kept pure
 * so it can be driven deterministically in tests.
 *
 * - Entering reach tests the gate once (armed → disarmed).
 * - A refusal remembers `denied`; any relic re-check (RECHECK) re-arms that gate
 *   in place, so a keycard that just reached 6 confirmations opens it.
 * - Leaving the outer ring clears the retry.
 * - Refusals reuse one toast id per gate, so messages update, never stack.
 */
import { keycardDenial, type HeldRelic, type KeycardDenial } from "./sealed-relics";

export type GateInput = { slug: string; active: boolean; hasPass: boolean; relics: HeldRelic[] };
export type GateAction =
  | { kind: "none" }
  | { kind: "closed" }
  | { kind: "deny"; denial: KeycardDenial; toastId: string; recheck: boolean }
  | { kind: "enter" };

export class GateAccess {
  armed = true;
  denied = false;
  /** call whenever relic states were re-read from Bitcoin */
  relicsChanged() { if (this.denied) this.armed = true; }
  tick(dist: number, reach: number, g: GateInput): GateAction {
    if (dist > reach * 2.2) { this.armed = true; this.denied = false; }
    if (!this.armed || dist > reach) return { kind: "none" };
    this.armed = false;
    if (!g.active) return { kind: "closed" };
    const recheck = this.denied;
    const denial = g.hasPass ? null : keycardDenial(g.relics, g.slug);
    if (denial) { this.denied = true; return { kind: "deny", denial, toastId: `gate-${g.slug}`, recheck }; }
    this.denied = false;
    return { kind: "enter" };
  }
}
