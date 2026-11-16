import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { gradeSlab, type SlabGrade } from "@/lib/land-slab";
import { loadSatProof } from "@/lib/sat-lookup";

/** Retryable: the data a grade needs is temporarily missing. Never graded around. */
export class GradeDataUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GradeDataUnavailable";
  }
}

export type BlockFacts = { classes: number[]; hash: string | null; txCount: number; covered: number };

function isPartial(r: Response): boolean {
  const count = Number(r.headers.get("x-tx-count"));
  const covered = Number(r.headers.get("x-tx-covered"));
  return Number.isFinite(count) && Number.isFinite(covered) && count > 0 && covered < count;
}

/** null = the block does not exist; throws GradeDataUnavailable on a degraded or failed read. */
export async function fetchBlock(height: number): Promise<BlockFacts | null> {
  let r: Response | null = null;
  let partial = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    // After a partial answer, bypass any cached copy so the server re-reads the chain.
    const url: string = partial ? `/api/public/blocks/${height}?fresh=${Date.now()}` : `/api/public/blocks/${height}`;
    r = await fetch(url, partial ? { cache: "no-store" } : undefined).catch(() => null);
    partial = !!r && r.ok && r.status !== 204 && isPartial(r);
    if (r && r.status !== 429 && r.status !== 503 && !r.headers.get("x-degraded") && !partial) break;
    if (attempt < 2) await new Promise((res) => setTimeout(res, 1500 * 2 ** attempt));
  }
  if (!r) throw new GradeDataUnavailable("block data source unreachable");
  if (r.headers.get("x-degraded")) throw new GradeDataUnavailable("block data source timed out");
  if (r.status === 204) return null;
  if (!r.ok) throw new GradeDataUnavailable(`block data source answered ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const txCount = Number(r.headers.get("x-tx-count") ?? bytes.length) || bytes.length;
  const covered = Number(r.headers.get("x-tx-covered") ?? bytes.length) || bytes.length;
  return { classes: Array.from(bytes), hash: r.headers.get("x-block-hash"), txCount, covered };
}

/** A grade is only computed from complete facts: every transaction, the block hash and the sat. */
export function missingGradeFacts(b: BlockFacts, sat: number | null): string | null {
  if (b.classes.length === 0) return "block transactions missing";
  if (b.classes.length < b.txCount || b.covered < b.txCount) return `only ${b.classes.length} of ${b.txCount} transactions read`;
  if (!b.hash) return "block hash missing";
  if (sat == null) return "sat number not found (LiveOCI and site index)";
  return null;
}

/* Background pre-grades run at most two at a time; the active BITMAP jumps the line. */
export const BACKGROUND_LIMIT = 2;
type Job = { key: number; run: (slot: boolean) => void };
let running = 0;
const waiting: Job[] = [];
const promoted = new Set<number>();

function next() {
  while (running < BACKGROUND_LIMIT && waiting.length) waiting.shift()!.run(true);
}

export function limited<T>(key: number, work: () => Promise<T>, priority = false): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = (slot: boolean) => {
      if (slot) running++;
      work().then(resolve, reject).finally(() => {
        if (slot) running--;
        next();
      });
    };
    // priority work runs now, outside the background limit
    if (priority || promoted.has(key)) return run(false);
    waiting.push({ key, run });
    next();
  });
}

/** Mark a BITMAP as the one the user is waiting on; start it now if it is still queued. */
export function promoteGrade(key: number | undefined) {
  promoted.clear();
  if (key == null) return;
  promoted.add(key);
  const i = waiting.findIndex((j) => j.key === key);
  if (i >= 0) waiting.splice(i, 1)[0]!.run(false);
}

/** Test hook. */
export function limiterState() {
  return { running, waiting: waiting.length };
}

async function gradeNow(height: number): Promise<{ grade: SlabGrade; hash: string | null; txCount: number; sat: number } | null> {
  const [b, proof] = await Promise.all([fetchBlock(height), loadSatProof(height).catch(() => null)]);
  if (!b) return null;
  const missing = missingGradeFacts(b, proof?.sat ?? null);
  if (missing) throw new GradeDataUnavailable(missing);
  const layout = layoutFromSizeClasses(b.classes);
  const sat = proof!.sat;
  return {
    grade: gradeSlab({ height, txCount: b.txCount, hash: b.hash, layoutWidth: layout.width, layoutHeight: layout.height, parcelSizes: layout.parcels.map((p) => p.size), sat }),
    hash: b.hash,
    txCount: b.txCount,
    sat,
  };
}

/** Pre-grade from the same block facts the certificate will carry. null = block unknown. */
export function fetchSlabGrade(height: number, opts: { priority?: boolean } = {}) {
  return limited(height, () => gradeNow(height), opts.priority);
}
