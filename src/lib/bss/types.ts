/**
 * BITMAP SUNSET SCRIPT (BSS) — client-safe types.
 *
 * BSS is a declarative on-chain scene format: a script is compiled to a compact
 * binary instruction stream and that stream is carried inside the pixel data of
 * a BMP image inscription. We only ever READ it. Nothing here is executed as
 * JavaScript; a scene is plain data.
 */

export type BssVersion = { major: number; minor: number; patch: number };

export type BssResource = {
  /** Script-local name, e.g. `ram0`. */
  name: string;
  /** Referenced inscription, e.g. `<txid>i0`. */
  inscriptionId: string;
};

/** Object kinds we recognise in the instruction stream. */
export type BssObjectKind = "quad" | "model" | "billboard" | "mosaic" | "primitive";

export type BssObject = {
  kind: BssObjectKind;
  /** Resource name bound to this object, when it carries one. */
  bind: string | null;
  /** Resolved inscription for `bind`, when the script declared it. */
  inscriptionId: string | null;
  /** BSS units (clamped to ±10100 by the format). */
  position: { x: number; y: number; z: number };
  /** Degrees. */
  rotation: { x: number; y: number; z: number };
  /** Uniform scale in BSS units. */
  scale: number;
};

export type BssScene = {
  /** Version declared by the file itself — never assumed. */
  version: BssVersion;
  versionLabel: string;
  /** Inscription the BMP was read from. */
  source: string;
  /** `block <n>` target carried in the binary, when present. */
  blockTarget: number | null;
  /** `sunset <n>` target carried in the binary, when present. */
  sunsetTarget: number | null;
  resources: BssResource[];
  objects: BssObject[];
  /** Payload size declared in the 9-byte header. */
  declaredSize: number;
  /** Bytes recovered from the BMP pixel data (before padding). */
  payloadSize: number;
  /** Bytes actually consumed by the instruction walk. */
  consumed: number;
  /** false = the file failed validation and must not be rendered. */
  ok: boolean;
  /** Human-readable notes: unsupported opcodes, truncation, validation. */
  diagnostics: string[];
};

export type BssLoad =
  | { status: "none"; reason: string }
  | { status: "error"; reason: string; source?: string }
  | { status: "ok"; scene: BssScene };
