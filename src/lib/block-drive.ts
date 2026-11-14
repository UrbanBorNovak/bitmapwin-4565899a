/** Block Drive (BitFS): files reinscribed onto a BITMAP's own sat. Pure helpers shared by browser and server. */
export const DRIVE_MAX_BYTES = 60_000; // same cap as every inscribe flow on the site

export type DriveKind = "journal" | "image" | "model" | "avatar" | "page" | "text" | "other";

const EXT_TYPES: Record<string, string> = {
  md: "text/markdown;charset=utf-8",
  markdown: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  html: "text/html;charset=utf-8",
  htm: "text/html;charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  glb: "model/gltf-binary",
  vrm: "model/gltf-binary",
  gltf: "model/gltf+json",
  stl: "model/stl",
};

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Content type to inscribe. Extension wins because browsers leave .md/.glb/.vrm types blank or wrong. */
export function driveContentType(name: string, browserType: string): string {
  return EXT_TYPES[ext(name)] ?? (browserType || "application/octet-stream");
}

export function driveKind(contentType: string, name = ""): DriveKind {
  const t = contentType.toLowerCase();
  if (ext(name) === "vrm") return "avatar";
  if (t.startsWith("text/markdown")) return "journal";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("model/")) return "model";
  if (t.startsWith("text/html")) return "page";
  if (t.startsWith("text/") || t.includes("json")) return "text";
  return "other";
}

export type DriveCheck = { ok: true } | { ok: false; reason: string };
export function checkDriveFile(size: number): DriveCheck {
  if (size <= 0) return { ok: false, reason: "That file is empty." };
  if (size > DRIVE_MAX_BYTES) return { ok: false, reason: `Too large: keep files under ${DRIVE_MAX_BYTES.toLocaleString("en-US")} bytes (about 60 KB).` };
  return { ok: true };
}
