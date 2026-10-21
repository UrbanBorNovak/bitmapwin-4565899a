import { mintSealed, noteKey, anchorScript, anchorCommitment } from "../../src/lib/shadow-seal";
const T = (c: string) => c.repeat(64);
const held: any[] = []; const routes: Record<string, any> = { "/blocks/tip/height": 200 };
const conf = (h: number | null) => ({ status: h ? { confirmed: true, block_height: h } : { confirmed: false }, vout: [] });
function zero(name: string, slug: string, c: string, h: number | null, spent = false, down = false) {
  const mine = { txid: T(c), vout: 0, salt: "s" + c };
  held.push({ c: { note: mintSealed(name, `keycard:${slug}`, mine, "2026-10-21T00:00:00Z"), steps: [], reveals: [] }, mine });
  routes[`/tx/${T(c)}`] = down ? "DOWN" : conf(h);
  routes[`/tx/${T(c)}/outspend/0`] = spent ? { spent: true, txid: T("9") } : { spent: false };
}
function oneStep(name: string, slug: string, c: string, spender: string, withAnchor: boolean) {
  const seal = { txid: T(c), vout: 0, salt: "s" + c };
  const note = mintSealed(name, `keycard:${slug}`, seal, "2026-10-21T00:00:00Z");
  const step = { txid: T("e"), assignments: [{ note: noteKey(note.genesis), to: { kind: "witness", vout: 0 } }] };
  held.push({ c: { note, steps: [step], reveals: [seal] }, mine: { txid: T("e"), vout: 0, salt: "" } });
  routes[`/tx/${T(c)}`] = conf(100);
  routes[`/tx/${T(c)}/outspend/0`] = { spent: true, txid: T(spender) };
  routes[`/tx/${T(spender)}`] = { status: { confirmed: true, block_height: 150 }, vout: withAnchor ? [{ scriptpubkey: anchorScript(anchorCommitment([{ note: "f".repeat(64), to: { kind: "witness", vout: 0 } }])) }] : [{ scriptpubkey: "0014" + "11".repeat(20) }] };
}
const sets: Record<string, () => void> = {
  sealed: () => zero("OK", "cypherpunk-assembly", "1", 100),
  pending: () => zero("P", "cypherpunk-assembly", "2", 198),
  conflict: () => oneStep("C", "cypherpunk-assembly", "3", "7", true),
  lost: () => oneStep("L", "cypherpunk-assembly", "4", "8", false),
  moved: () => zero("M", "cypherpunk-assembly", "5", 100, true),
  unavailable: () => zero("U", "cypherpunk-assembly", "6", 100, false, true),
  wronggate: () => zero("W", "night-market", "a", 100),
  none: () => {},
};
const out: Record<string, any> = {};
for (const [k, f] of Object.entries(sets)) { held.length = 0; for (const key of Object.keys(routes)) if (key !== "/blocks/tip/height") delete routes[key]; f(); out[k] = { held: [...held], routes: { ...routes } }; }
await Bun.write("/tmp/gate_fixtures.json", JSON.stringify(out));
console.log(Object.keys(out));
