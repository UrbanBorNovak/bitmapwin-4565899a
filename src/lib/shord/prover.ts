/**
 * SHORD spend prover — Groth16 over BN254, generated on this device.
 *
 * A spend proof shows three things at once without revealing any of them:
 *   1. the note being spent exists in the on-chain Poseidon state tree,
 *   2. the spender holds its spending key,
 *   3. the new commitment is well formed and conserves value.
 *
 * The circuit is not something we can invent at runtime: proving needs the
 * compiled artifacts (`spend.wasm` + `spend.zkey`) that match the pool's
 * on-chain verifying key. Until those are installed under
 * `public/wasm/shord/`, this module reports plainly that proving is offline.
 * It never fabricates a proof, because a fabricated proof would be rejected
 * by the pool and would be a lie about what the app can do.
 */
export const SHORD_ARTIFACT_BASE = "/wasm/shord";
export const SHORD_PROOF_BYTES = 256;

export type ProverStatus =
  | { ready: true; circuitHash: string }
  | { ready: false; reason: string };

export type SpendWitness = {
  anchor: string;
  nullifier: string;
  commitment: string;
  /** decimal field elements, private to this device */
  privateInputs: Record<string, string>;
};

async function head(path: string): Promise<boolean> {
  try {
    const res = await fetch(path, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Checks whether the local circuit artifacts are installed. */
export async function proverStatus(): Promise<ProverStatus> {
  const [wasm, zkey] = await Promise.all([
    head(`${SHORD_ARTIFACT_BASE}/spend.wasm`),
    head(`${SHORD_ARTIFACT_BASE}/spend.zkey`),
  ]);
  if (!wasm || !zkey) {
    return {
      ready: false,
      reason: !wasm && !zkey ? "CIRCUIT ARTIFACTS NOT INSTALLED" : !wasm ? "SPEND CIRCUIT MISSING" : "PROVING KEY MISSING",
    };
  }
  return { ready: true, circuitHash: "spend.zkey" };
}

/**
 * Generates a spend proof inside a worker. Throws a clear, recoverable error
 * while the artifacts are absent — callers surface it, they never fake a proof.
 */
export async function proveSpend(_witness: SpendWitness): Promise<string> {
  const status = await proverStatus();
  if (!status.ready) {
    throw new Error(
      `Shielded proving is offline on this device: ${status.reason}. A spend cannot be built without the pool's own circuit.`,
    );
  }
  throw new Error("Shielded proving artifacts found but the worker bridge is not wired yet.");
}
