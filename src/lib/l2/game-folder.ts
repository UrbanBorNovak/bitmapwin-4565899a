// Indexes a local Lineage II client folder by package name. Files are only read when opened.
export const PACKAGE_EXT = /\.(usx|ukx|utx|unr|u)$/i;

export interface FolderEntry { name: string; path: string; size: number; open: () => Promise<File> }

/** Package key used by UE2 imports: lowercase file name without extension. */
export const packageKey = (name: string) => name.replace(/^.*[\\/]/, "").replace(PACKAGE_EXT, "").toLowerCase();

export function indexEntries(entries: FolderEntry[]): Map<string, FolderEntry> {
  const map = new Map<string, FolderEntry>();
  for (const e of entries) {
    if (!PACKAGE_EXT.test(e.name)) continue;
    const k = `${packageKey(e.name)}.${e.name.split(".").pop()!.toLowerCase()}`;
    if (!map.has(k)) map.set(k, e);
  }
  return map;
}

/** Finds the texture package a "load X.utx too" reason names. */
export function missingUtx(reason: string): string | null {
  const m = /lives in ([^\s]+)\.utx/i.exec(reason);
  return m ? `${m[1]!.toLowerCase()}.utx` : null;
}

export function fromFileList(files: File[]): FolderEntry[] {
  return files.map((f) => ({ name: f.name, path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, size: f.size, open: async () => f }));
}

type DirHandle = { name: string; values: () => AsyncIterable<{ kind: string; name: string; getFile?: () => Promise<File> } & Record<string, unknown>> };

export async function fromDirectoryHandle(root: DirHandle, limit = 20000): Promise<FolderEntry[]> {
  const out: FolderEntry[] = [];
  const walk = async (dir: DirHandle, prefix: string, depth: number) => {
    if (depth > 4) return;
    for await (const h of dir.values()) {
      if (out.length >= limit) return;
      if (h.kind === "directory") await walk(h as unknown as DirHandle, `${prefix}${h.name}/`, depth + 1);
      else if (PACKAGE_EXT.test(h.name) && h.getFile) {
        const file = await h.getFile();
        out.push({ name: h.name, path: prefix + h.name, size: file.size, open: async () => file });
      }
    }
  };
  await walk(root, `${root.name}/`, 0);
  return out;
}

export type ServerStatus = "idle" | "connecting" | "open" | "closed" | "error";
/** Only local WebSocket bridges are allowed: the site never relays game traffic. */
export function isLocalBridgeUrl(url: string): boolean {
  try { const u = new URL(url); return (u.protocol === "ws:" || u.protocol === "wss:") && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname); }
  catch { return false; }
}
