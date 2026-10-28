/**
 * Funded-bot build engine (Bitcoin signet). Everything here runs on the device:
 * voxels are generated from the prompt + block, and the bot's own key signs a
 * commit (bot coins → one-time inscription address) and a reveal (inscription
 * → back to the bot). The total fee must stay under the bot's max fee.
 */
import * as btc from "@scure/btc-signer";
import { hex } from "@scure/base";
import { p2tr_ord_reveal, OutOrdinalReveal } from "micro-ordinals";
import { schnorr } from "@noble/curves/secp256k1.js";
import { generateBuild, forgeInscriptionHtml, type ArchetypeId } from "@/lib/voxel-populate";
import type { TplBlock } from "@/lib/voxel-templates";

export const SIGNET = btc.TEST_NETWORK;
export const SIGNET_API = "https://mempool.space/signet/api";
export const POSTAGE = 546;
const customScripts = [OutOrdinalReveal];

export type Ground = { rect: { index: number; x0: number; z0: number; x1: number; z1: number; cells: number[] } | null; txCount: number | null };

/** Prompt words pick the archetype; anything else is a citadel. */
export function archetypeFor(prompt: string): ArchetypeId {
  const p = prompt.toLowerCase();
  if (/tower|spire|antenna|radio|needle|mast/.test(p)) return "spire";
  if (/neon|casino|cyber|glass|sign/.test(p)) return "casino";
  if (/arena|stadium|ring|colosseum/.test(p)) return "arena";
  if (/vault|bunker|bank|treasure/.test(p)) return "vault";
  return "citadel";
}

/** Deterministic voxels for this BITMAP, clipped to the owned ground. */
export function botVoxels(height: number, prompt: string, ground: Ground): { archetype: ArchetypeId; blocks: TplBlock[] } {
  const archetype = archetypeFor(prompt);
  let blocks = generateBuild(height, ground.txCount, archetype);
  const r = ground.rect;
  if (r) {
    // Re-centre the build onto the parcel tile, then keep only owned cells.
    const cx = Math.floor((r.x0 + r.x1) / 2) - 32, cz = Math.floor((r.z0 + r.z1) / 2) - 32;
    const owned = new Set(r.cells);
    blocks = blocks.map((b) => ({ ...b, dx: b.dx + cx, dz: b.dz + cz }))
      .filter((b) => b.dx >= r.x0 && b.dx <= r.x1 && b.dz >= r.z0 && b.dz <= r.z1 && owned.has(b.dx * 64 + b.dz));
  }
  return { archetype, blocks };
}

/** Exact fee plan: commit (n key-path inputs → commit + change) and reveal. */
export function planFees(bodyBytes: number, inputs: number, feeRate: number) {
  const commitVb = 11 + inputs * 58 + 2 * 43;
  const revealVb = Math.ceil((bodyBytes + 200) / 4) + 150;
  const commitFee = Math.ceil(commitVb * feeRate), revealFee = Math.ceil(revealVb * feeRate);
  return { commitFee, revealFee, total: commitFee + revealFee, commitAmount: POSTAGE + revealFee };
}

/** Refuses when fees exceed the cap or the balance can't cover them. */
export function checkBudget(plan: { total: number }, balance: number, maxFee: number): string | null {
  if (plan.total > maxFee) return `Fees would be ${plan.total.toLocaleString()} sats, above this bot's ${maxFee.toLocaleString()} sat limit.`;
  if (balance < plan.total + POSTAGE + 330) return `Not enough sats: needs ${(plan.total + POSTAGE + 330).toLocaleString()}, has ${balance.toLocaleString()}.`;
  return null;
}

type Utxo = { txid: string; vout: number; value: number; status: { confirmed: boolean } };

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${SIGNET_API}${path}`, init);
  if (!r.ok) throw new Error(`Signet: ${(await r.text()).slice(0, 160)}`);
  return r;
}
export async function signetFeeRate(): Promise<number> {
  const j = await (await api("/v1/fees/recommended")).json();
  return Math.max(1, Number(j.halfHourFee) || 1);
}
const broadcast = async (rawHex: string) => (await api("/tx", { method: "POST", body: rawHex })).text();

export type BuildStep = "VALIDATING" | "GENERATING" | "SIGNING_COMMIT" | "WAITING_COMMIT" | "SIGNING_REVEAL" | "DONE";

/** Runs the whole build. The browser must stay open from commit to reveal. */
export async function runSignetBuild(o: {
  secretHex: string; height: number; prompt: string; maxFeeSats: number; ground: Ground;
  onStep: (s: BuildStep, info?: string) => void;
}): Promise<{ commitTxid: string; revealTxid: string; blocks: number; fees: number }> {
  const secret = hex.decode(o.secretHex);
  const pub = schnorr.getPublicKey(secret);
  const bot = btc.p2tr(pub, undefined, SIGNET);

  o.onStep("GENERATING");
  const { archetype, blocks } = botVoxels(o.height, o.prompt, o.ground);
  if (blocks.length < 4) throw new Error("No voxels fit on this ground.");
  const html = forgeInscriptionHtml(o.height, archetype, blocks, "", o.ground.rect ?? undefined);
  const body = new TextEncoder().encode(html);

  const utxos = ((await (await api(`/address/${bot.address}/utxo`)).json()) as Utxo[]).filter((u) => u.status.confirmed);
  const balance = utxos.reduce((n, u) => n + u.value, 0);
  const plan = planFees(body.length, utxos.length, await signetFeeRate());
  const why = checkBudget(plan, balance, o.maxFeeSats);
  if (why) throw new Error(why);

  o.onStep("SIGNING_COMMIT", `${blocks.length} voxels · ${plan.total} sats fees`);
  const inscription = { tags: { contentType: "text/html;charset=utf-8", metaprotocol: `bitmapwin-bot:${o.height}` } as never, body };
  const reveal = btc.p2tr(undefined, p2tr_ord_reveal(pub, [inscription]), SIGNET, false, customScripts);
  const commit = new btc.Transaction();
  for (const u of utxos) commit.addInput({ txid: u.txid, index: u.vout, witnessUtxo: { script: bot.script, amount: BigInt(u.value) }, tapInternalKey: pub });
  commit.addOutputAddress(reveal.address!, BigInt(plan.commitAmount), SIGNET);
  commit.addOutputAddress(bot.address!, BigInt(balance - plan.commitAmount - plan.commitFee), SIGNET);
  commit.sign(secret); commit.finalize();
  const commitTxid = await broadcast(commit.hex);

  o.onStep("WAITING_COMMIT", commitTxid);
  o.onStep("SIGNING_REVEAL");
  const tx = new btc.Transaction({ customScripts });
  tx.addInput({ ...reveal, txid: commitTxid, index: 0, witnessUtxo: { script: reveal.script, amount: BigInt(plan.commitAmount) } } as never);
  tx.addOutputAddress(bot.address!, BigInt(POSTAGE), SIGNET);
  tx.sign(secret, undefined, new Uint8Array(32)); tx.finalize();
  const revealTxid = await broadcast(tx.hex);
  o.onStep("DONE", revealTxid);
  return { commitTxid, revealTxid, blocks: blocks.length, fees: plan.total };
}
