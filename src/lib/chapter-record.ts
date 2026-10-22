// Browser-only chapter clip recorder: captures this tab (cropped to the player
// when Region Capture exists) with its sound, records locally, never uploads.

export function pickClipType(isSupported: (t: string) => boolean): { mime: string; ext: "mp4" | "webm" } | null {
  const order: Array<[string, "mp4" | "webm"]> = [
    ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9,opus", "webm"],
    ["video/webm;codecs=vp8,opus", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of order) if (isSupported(mime)) return { mime, ext };
  return null;
}

export type ClipSession = { stop: () => Promise<Blob>; cancel: () => void; ext: "mp4" | "webm"; onEnded: (cb: () => void) => void };

export async function startClipCapture(el: HTMLElement): Promise<ClipSession> {
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser cannot record clips. Try desktop Chrome or Edge.");
  const type = pickClipType((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error("This browser cannot record video.");
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 30 }, audio: true,
    // @ts-expect-error newer capture hints
    preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "include",
  });
  const [track] = stream.getVideoTracks();
  const CT = (globalThis as unknown as { CropTarget?: { fromElement: (e: Element) => Promise<unknown> } }).CropTarget;
  try { if (CT && track && "cropTo" in track) await (track as unknown as { cropTo: (t: unknown) => Promise<void> }).cropTo(await CT.fromElement(el)); } catch { /* full tab fallback */ }
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: 6_000_000 });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const end = () => stream.getTracks().forEach((t) => t.stop());
  let endedCb: (() => void) | null = null;
  track?.addEventListener("ended", () => endedCb?.());
  rec.start(500);
  return {
    ext: type.ext,
    onEnded: (cb) => { endedCb = cb; },
    cancel: () => { try { rec.stop(); } catch { /* */ } end(); },
    stop: () => new Promise<Blob>((res) => {
      rec.onstop = () => { end(); res(new Blob(chunks, { type: String(type.mime.split(";")[0]) })); };
      rec.stop();
    }),
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverClip(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if ((e as DOMException).name === "AbortError") return; }
  }
  downloadBlob(blob, filename);
}
