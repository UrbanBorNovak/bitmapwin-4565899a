/** Loads map tiles and the props they place from the visitor's game folder (read on demand, never uploaded). */
import type { FolderEntry } from "./game-folder";
import { missingUtx } from "./game-folder";
import { readPackage, envelopeHelp, detectEnvelope, type Ue2Package } from "./ue2-package";
import { decodeStaticMesh, type DecodedMesh } from "./ue2-staticmesh";
import { resolveMaterial, type DecodedTexture } from "./ue2-texture";
import { decodeTerrain, importTarget, staticActors, tileFile, type StaticActor, type TerrainGrid } from "./l2-world";

export interface WorldTile { file: string; terrain: TerrainGrid | null; notes: string[]; actors: StaticActor[]; pkg: Ue2Package }
export interface PropModel { mesh: DecodedMesh; textures: (DecodedTexture | null)[] }

export class WorldLibrary {
  private pkgs = new Map<string, Promise<Ue2Package | null>>();
  private meshes = new Map<string, Promise<PropModel | string>>();
  constructor(private index: Map<string, FolderEntry>) {}

  private open(key: string): Promise<Ue2Package | null> {
    let p = this.pkgs.get(key);
    if (!p) {
      const entry = this.index.get(key);
      p = entry ? entry.open().then(async (f) => readPackage(new Uint8Array(await f.arrayBuffer()), f.name)).catch(() => null) : Promise.resolve(null);
      this.pkgs.set(key, p);
    }
    return p;
  }

  async loadTile(tx: number, ty: number): Promise<{ tile?: WorldTile; error?: string }> {
    const file = tileFile(tx, ty);
    const entry = this.index.get(file.toLowerCase());
    if (!entry) return { error: `Your game folder has no ${file}. It is normally in the maps folder of the client.` };
    let pkg: Ue2Package;
    try {
      const bytes = new Uint8Array(await (await entry.open()).arrayBuffer());
      const env = detectEnvelope(bytes);
      if (env.kind === "unsupported") return { error: `${file}: ${envelopeHelp(env.label)}` };
      pkg = readPackage(bytes, file);
    } catch (e) { return { error: `${file} could not be read: ${e instanceof Error ? e.message : String(e)}` }; }
    const { terrain, issue } = decodeTerrain(pkg);
    const { actors, unreadable } = staticActors(pkg);
    const notes: string[] = [];
    if (issue) notes.push(issue);
    if (unreadable) notes.push(`${unreadable.toLocaleString("en-US")} placed props could not be read and are left out.`);
    return { tile: { file, terrain, notes, actors, pkg } };
  }

  /** Decode the StaticMesh an actor points to, plus the textures its sections use (best effort). */
  meshFor(tile: Ue2Package, ref: number): Promise<PropModel | string> {
    const key = `${tile.file}:${ref}`;
    let p = this.meshes.get(key);
    if (!p) { p = this.decode(tile, ref); this.meshes.set(key, p); }
    return p;
  }

  private async decode(tile: Ue2Package, ref: number): Promise<PropModel | string> {
    let pkg: Ue2Package | null = tile, idx = ref - 1;
    if (ref < 0) {
      const t = importTarget(tile, ref);
      if (!t) return "mesh reference could not be followed";
      pkg = await this.open(`${t.pkg}.usx`);
      if (!pkg) return `${t.pkg}.usx is not in your folder or could not be read`;
      idx = pkg.exports.findIndex((e) => e.className === "StaticMesh" && e.name.toLowerCase() === t.name.toLowerCase());
      if (idx < 0) return `${t.name} is not in ${t.pkg}.usx`;
    }
    let mesh: DecodedMesh;
    try { mesh = decodeStaticMesh(pkg, idx); } catch (e) { return e instanceof Error ? e.message : String(e); }
    const loaded: Ue2Package[] = [pkg];
    const textures: (DecodedTexture | null)[] = [];
    for (const m of mesh.materials) {
      let res = resolveMaterial(loaded, pkg, m);
      const need = !res.ok ? missingUtx(res.reason) : null;
      if (need) { const extra = await this.open(need); if (extra) { loaded.push(extra); res = resolveMaterial(loaded, pkg, m); } }
      textures.push(res.ok ? res.texture : null);
    }
    return { mesh, textures };
  }
}
