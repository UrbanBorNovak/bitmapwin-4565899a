import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ToonEpisode } from "@/lib/toon-script";
import { applyCast, isMigrated, loadLibrary, markMigrated, mergeLibraries, newId, saveLibrary, upsertEpisode, type ToonLibrary } from "@/lib/toon-library";
import { fetchCloudLibrary, pushCloudLibrary } from "@/lib/toon-cloud";
import { useAuthSession } from "@/lib/auth";

const field = "w-full border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground";
const btn = "border border-border px-2 py-1 font-mono text-[11px] hover:border-bitcoin disabled:opacity-40";
type Sync = "local" | "loading" | "synced" | "saving" | "error";

/** Series, saved episodes and recurring casts. Signed in: the account copy is the source of truth. */
export function ToonLibraryPanel({ episode, onOpen }: { episode: ToonEpisode; onOpen: (e: ToonEpisode) => void }) {
  const { user, loading } = useAuthSession();
  const [lib, setLib] = useState<ToonLibrary>({ series: [], casts: [] });
  const [seriesId, setSeriesId] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [newSeries, setNewSeries] = useState("");
  const [castName, setCastName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [sync, setSync] = useState<Sync>("local");

  const show = (l: ToonLibrary) => { setLib(l); setSeriesId((cur) => (l.series.some((s) => s.id === cur) ? cur : l.series[0]?.id ?? "")); };

  useEffect(() => {
    if (loading) return;
    const local = loadLibrary();
    if (!user) { show(local); setSync("local"); return; }
    let live = true;
    setSync("loading");
    (async () => {
      try {
        const cloud = await fetchCloudLibrary(user.id);
        let next = cloud ?? { series: [], casts: [] };
        // First sign-in on this device: fold browser-saved projects into the account, never dropping either side.
        if (!isMigrated(user.id) && (local.series.length || local.casts.length)) {
          next = mergeLibraries(next, local);
          await pushCloudLibrary(user.id, next);
          if (live) setNote("YOUR BROWSER-SAVED PROJECTS WERE ADDED TO YOUR ACCOUNT.");
        }
        markMigrated(user.id);
        saveLibrary(next);
        if (live) { show(next); setSync("synced"); }
      } catch {
        if (live) { show(local); setSync("error"); setNote("COULD NOT REACH YOUR ACCOUNT — SHOWING THIS DEVICE'S COPY."); }
      }
    })();
    return () => { live = false; };
  }, [user, loading]);

  const commit = (l: ToonLibrary, msg: string) => {
    setLib(l);
    const okLocal = saveLibrary(l);
    if (!user || sync === "error" || sync === "loading") return setNote(okLocal ? msg : "COULD NOT SAVE — BROWSER STORAGE IS FULL OR BLOCKED.");
    setSync("saving");
    pushCloudLibrary(user.id, l)
      .then(() => { setSync("synced"); setNote(msg); })
      .catch(() => { setSync("error"); setNote("SAVED ON THIS DEVICE, BUT NOT TO YOUR ACCOUNT. TRY AGAIN."); });
  };
  const series = lib.series.find((s) => s.id === seriesId);

  const save = (asNew: boolean) => {
    if (!series) return setNote("CREATE A SERIES FIRST.");
    const id = !asNew && currentId && series.episodes.some((e) => e.id === currentId) ? currentId : newId();
    setCurrentId(id);
    commit(upsertEpisode(lib, series.id, { id, savedAt: Date.now(), episode }), `SAVED TO ${series.name.toUpperCase()}.`);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="label text-signal">MY SERIES</div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {sync === "local" ? "THIS DEVICE" : sync === "loading" ? "LOADING…" : sync === "saving" ? "SAVING…" : sync === "synced" ? "● SYNCED TO ACCOUNT" : "⚠ OFFLINE COPY"}
        </span>
      </div>
      {!user && !loading && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Saved on this device only. <Link to="/auth" className="text-signal underline">Sign in</Link> to keep your series on every device — what you saved here comes with you.
        </p>
      )}
      {sync === "error" && user && (
        <button className={`${btn} mt-2`} onClick={async () => { setSync("saving"); try { const merged = mergeLibraries((await fetchCloudLibrary(user.id)) ?? { series: [], casts: [] }, lib); await pushCloudLibrary(user.id, merged); saveLibrary(merged); show(merged); setSync("synced"); setNote("SYNCED."); } catch { setSync("error"); } }}>RETRY SYNC</button>
      )}
      <div className="mt-2 flex gap-2">
        <input className={field} value={newSeries} placeholder="New series name" onChange={(e) => setNewSeries(e.target.value.slice(0, 60))} aria-label="New series name" />
        <button className={btn} disabled={!newSeries.trim()} onClick={() => {
          const s = { id: newId(), name: newSeries.trim(), episodes: [] };
          commit({ ...lib, series: [...lib.series, s] }, "SERIES CREATED."); setSeriesId(s.id); setNewSeries(""); setCurrentId(null);
        }}>+ SERIES</button>
      </div>
      {lib.series.length > 0 && (
        <>
          <select className={`${field} mt-2`} value={seriesId} onChange={(e) => { setSeriesId(e.target.value); setCurrentId(null); }} aria-label="Series">
            {lib.series.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.episodes.length})</option>)}
          </select>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="btn-term text-[11px]" onClick={() => save(false)}>[ {currentId ? "SAVE" : "SAVE EPISODE"} ]</button>
            {currentId && <button className={btn} onClick={() => save(true)}>SAVE AS NEW</button>}
            <button className={btn} onClick={() => {
              if (!series || !confirm(`Delete series "${series.name}" and its ${series.episodes.length} episodes?`)) return;
              const rest = lib.series.filter((s) => s.id !== series.id);
              commit({ ...lib, series: rest }, "SERIES DELETED."); setSeriesId(rest[0]?.id ?? ""); setCurrentId(null);
            }}>DELETE SERIES</button>
          </div>
          <div className="mt-3 border border-dashed border-border p-2">
            <div className="font-mono text-[10px] text-muted-foreground">
              SERIES TEMPLATE · {series?.template ? `SET ${new Date(series.template.savedAt).toLocaleDateString()} · ${series.template.episode.scenes.length} SCENES · ${series.template.episode.aspect}` : "NONE YET"}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Keeps the cast, BITMAP locations, camera moves, timing, format and sound effects. Dialogue starts empty.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btn} disabled={!series} onClick={() => {
                if (!series) return;
                if (series.template && !confirm("Replace this series' template with the current episode?")) return;
                commit({ ...lib, series: lib.series.map((s) => (s.id === series.id ? { ...s, template: { savedAt: Date.now(), episode: toTemplate(episode) } } : s)) }, "TEMPLATE SET FROM THIS EPISODE.");
              }}>{series?.template ? "UPDATE TEMPLATE" : "USE AS TEMPLATE"}</button>
              <button className="btn-term text-[11px]" disabled={!series?.template} onClick={() => {
                const next = series && episodeFromTemplate(series);
                if (!next) return;
                onOpen(next); setCurrentId(null); setNote(`STARTED ${next.title.toUpperCase()} — WRITE THE DIALOGUE, THEN SAVE.`);
              }}>[ NEXT EPISODE ]</button>
            </div>
          </div>
          <ol className="mt-3 space-y-1">
            {series?.episodes.map((e, k) => (
              <li key={e.id} className={`flex items-center gap-2 border px-2 py-1 font-mono text-[11px] ${e.id === currentId ? "border-bitcoin" : "border-border"}`}>
                <span className="text-muted-foreground">EP{k + 1}</span>
                <button className="flex-1 truncate text-left hover:text-bitcoin" onClick={() => { onOpen(e.episode); setCurrentId(e.id); setNote(`OPENED EP${k + 1}.`); }}>{e.episode.title}</button>
                <span className="text-muted-foreground">{new Date(e.savedAt).toLocaleDateString()}</span>
                <button aria-label="Delete episode" className="text-muted-foreground hover:text-bitcoin" onClick={() => {
                  if (!confirm(`Delete "${e.episode.title}"?`)) return;
                  commit({ ...lib, series: lib.series.map((s) => (s.id === seriesId ? { ...s, episodes: s.episodes.filter((x) => x.id !== e.id) } : s)) }, "EPISODE DELETED.");
                  if (currentId === e.id) setCurrentId(null);
                }}>✕</button>
              </li>
            ))}
            {series && series.episodes.length === 0 && <li className="text-[11px] text-muted-foreground">No episodes yet.</li>}
          </ol>
        </>
      )}

      <div className="label mt-4 text-signal">RECURRING CASTS</div>
      <div className="mt-2 flex gap-2">
        <input className={field} value={castName} placeholder="Cast name" onChange={(e) => setCastName(e.target.value.slice(0, 40))} aria-label="Cast name" />
        <button className={btn} disabled={!castName.trim()} onClick={() => {
          const heights = (episode.scenes.reduce((m, s) => (s.cast.length > m.length ? s.cast : m), episode.scenes[0]?.cast ?? [])).map((a) => a.height);
          commit({ ...lib, casts: [...lib.casts, { id: newId(), name: castName.trim(), heights }] }, "CAST SAVED."); setCastName("");
        }}>SAVE CAST</button>
      </div>
      <ul className="mt-2 space-y-1">
        {lib.casts.map((c) => (
          <li key={c.id} className="flex items-center gap-2 border border-border px-2 py-1 font-mono text-[11px]">
            <span className="flex-1 truncate"><span className="text-bitcoin">{c.name}</span> · {c.heights.join(", ")}</span>
            <button className="text-signal hover:text-bitcoin" onClick={() => { onOpen(applyCast(episode, c.heights)); setNote(`${c.name.toUpperCase()} CAST IN EVERY SCENE.`); }}>USE</button>
            <button aria-label="Delete cast" className="text-muted-foreground hover:text-bitcoin" onClick={() => commit({ ...lib, casts: lib.casts.filter((x) => x.id !== c.id) }, "CAST DELETED.")}>✕</button>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 font-mono text-[11px] text-signal">&gt; {note}</p>}
    </section>
  );
}
