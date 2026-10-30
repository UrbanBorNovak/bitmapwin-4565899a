import { useEffect, useState } from "react";
import { lotteryFound, useLottery } from "@/lib/bitmap-lottery";
import {
  DELETE_PHRASE, VAULT_MIN_PASS, deleteSealed, encryptedBackupText, importBackupText, listSealed,
  openSealed, sealFoundKey, setupVault, tryDownload, vaultConfigured,
} from "@/lib/key-vault";
import { safeError } from "@/lib/puzzle-secret";

/** Encrypted on-device recovery backup for a found key. Works on every page. */
export function KeyVaultPanel({ compact = false }: { compact?: boolean }) {
  const { found } = useLottery();
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [pass, setPass] = useState(""); const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [del, setDel] = useState("");
  const refresh = () => { setReady(vaultConfigured()); setCount(listSealed().length); };
  useEffect(() => { refresh(); const t = setInterval(refresh, 2000); return () => clearInterval(t); }, []);

  const setup = async () => {
    setMsg(null);
    if (pass !== pass2) return setMsg("Passphrases do not match");
    try {
      await setupVault(pass); setPass(""); setPass2("");
      if (found) await sealFoundKey(found);
      refresh(); setMsg(found ? "Passphrase set — the found key is now sealed on this device." : "Passphrase set. Any key found from now on is sealed on this device automatically.");
    } catch (e) { setMsg(safeError(e)); }
  };
  const download = () => {
    const text = encryptedBackupText(); if (!text) return setMsg("No sealed key to back up yet");
    const r = tryDownload(text, `puzzle71-encrypted-backup-${Date.now()}.json`);
    setWarn(r.likelyBlocked
      ? "Your browser may have BLOCKED this download (embedded pages often do). Check your downloads. If no file appeared, copy the encrypted text below and save it somewhere safe."
      : "Check that the file appeared in your downloads. If it did not, your browser blocked it — copy the encrypted text below instead.");
    setFallback(text);
  };
  const restore = async () => {
    setMsg(null);
    try {
      const keys = await openSealed(pass); setPass("");
      if (keys.length && !found) lotteryFound(keys[keys.length - 1]);
      setMsg(`Unlocked ${keys.length} backup(s). The key is loaded in this tab — open the sweep terminal.`);
    } catch (e) { setMsg(safeError(e)); }
  };
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try { const n = importBackupText(await f.text()); refresh(); setMsg(`Imported ${n} encrypted backup(s). Unlock with your passphrase.`); }
    catch (e) { setMsg(safeError(e)); }
  };

  const unprotected = !!found && count === 0;
  return (
    <div className={`rounded border p-3 font-mono text-[11px] ${unprotected ? "border-destructive bg-destructive/10" : "border-border"}`}>
      <p className="label text-accent">ENCRYPTED KEY BACKUP</p>
      {unprotected && <p className="mt-1 text-destructive">A KEY WAS FOUND AND IS ONLY IN THIS TAB. Set a passphrase now to seal it on this device, then download the backup.</p>}
      {!compact && <p className="mt-1 text-muted-foreground">If a key is found while you're away, it's encrypted with your passphrase and kept on this device, so a crash or closed tab doesn't lose it. The passphrase is never stored or sent anywhere. Keys never go to our server. Backups are only removed when you delete them yourself.</p>}
      <p className="mt-2">{ready ? `PASSPHRASE SET · ${count} SEALED KEY(S)` : "NO PASSPHRASE SET — found keys are only held in the open tab"}</p>

      {(!ready || unprotected) && (
        <div className="mt-2 space-y-1">
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={`Passphrase (${VAULT_MIN_PASS}+ chars)`} className="w-full rounded border border-border bg-background px-2 py-1" autoComplete="new-password" />
          <input type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Repeat passphrase" className="w-full rounded border border-border bg-background px-2 py-1" autoComplete="new-password" />
          <button onClick={setup} className="rounded bg-primary px-3 py-1 text-primary-foreground">[ SET PASSPHRASE ]</button>
          <p className="text-muted-foreground">Lose the passphrase and the backup can't be opened. Nobody can reset it.</p>
        </div>
      )}

      {ready && count > 0 && (
        <div className="mt-2 space-y-2">
          <button onClick={download} className="rounded border border-primary px-3 py-1 text-primary">[ DOWNLOAD ENCRYPTED BACKUP ]</button>
          {!found && (
            <div className="flex gap-1">
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase to unlock" className="flex-1 rounded border border-border bg-background px-2 py-1" autoComplete="current-password" />
              <button onClick={restore} className="rounded border border-accent px-2 py-1 text-accent">UNLOCK</button>
            </div>
          )}
        </div>
      )}

      {warn && <p className="mt-2 border border-destructive p-2 text-destructive">{warn}</p>}
      {fallback && (
        <div className="mt-1">
          <textarea readOnly value={fallback} className="h-20 w-full rounded border border-border bg-background p-1 text-[9px]" data-no-translate />
          <button onClick={() => navigator.clipboard?.writeText(fallback).then(() => setMsg("Encrypted backup copied."), () => setMsg("Copy blocked — select the text and copy it by hand."))} className="text-accent underline">COPY ENCRYPTED TEXT</button>
        </div>
      )}

      {!compact && (
        <div className="mt-3 space-y-2 border-t border-border pt-2">
          <label className="block text-muted-foreground">RESTORE FROM BACKUP FILE
            <input type="file" accept=".json,application/json" onChange={(e) => importFile(e.target.files?.[0])} className="mt-1 block text-[10px]" />
          </label>
          {count > 0 && (
            <div className="flex gap-1">
              <input value={del} onChange={(e) => setDel(e.target.value)} placeholder={`Type ${DELETE_PHRASE}`} className="flex-1 rounded border border-border bg-background px-2 py-1" />
              <button onClick={() => { if (deleteSealed(del)) { setDel(""); refresh(); setMsg("Backups deleted from this device."); } else setMsg(`Type ${DELETE_PHRASE} to delete`); }} className="rounded border border-destructive px-2 py-1 text-destructive">DELETE</button>
            </div>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-accent">{msg}</p>}
    </div>
  );
}
