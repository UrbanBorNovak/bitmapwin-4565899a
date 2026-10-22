import { useState } from "react";
import { decodeNote, verifyNote, type ShadowNote } from "@/lib/shadow-notes";
import { importPass, parseReceiveCode, shadowHandle } from "@/lib/shadow-vault";

type Result =
  | { kind: "note"; note: ShadowNote; valid: boolean }
  | { kind: "pass"; slug: string; commitment: string; handle: string }
  | { kind: "recv"; slug: string; commitment: string }
  | { kind: "bad" };

const short = (s: string) => `${s.slice(0, 10)}…${s.slice(-6)}`;

function inspect(code: string): Result {
  const note = decodeNote(code);
  if (code.trim().startsWith("SHADOW-NOTE-v1.") && !note) return { kind: "bad" };
  if (note) return { kind: "note", note, valid: verifyNote(note) };
  const pass = importPass(code);
  if (pass && /^[a-z0-9-]{1,64}$/.test(pass.slug) && /^[0-9a-f]{128}$/.test(pass.salt + pass.nullifierSecret)) return { kind: "pass", slug: pass.slug, commitment: pass.commitment, handle: shadowHandle(pass.nullifier) };
  const recv = parseReceiveCode(code);
  if (recv) return { kind: "recv", ...recv };
  return { kind: "bad" };
}

const STEPS = [
  ["1 · YOUR DEVICE MAKES A SECRET", "When you claim a pass or relic, your browser creates a random secret and keeps it on this device. The only time it is sent is a pass handoff, which uses it once to retire your old copy."],
  ["2 · BITMAPWIN SEES ONLY A FINGERPRINT", "For passes we store a one-way fingerprint (a hash) of that secret; vault notes are not stored at all. It can't be turned back into the secret, your wallet or your account."],
  ["3 · YOU PROVE ACCESS, NOT IDENTITY", "To enter a private room, your device shows it knows the secret behind a stored fingerprint. Nobody learns which wallet you use."],
  ["4 · A PEN NAME PER ROOM", "Each room gives you a separate pen name, so your activity in one room can't be matched with another."],
  ["5 · GIVE IT AWAY PRIVATELY", "The receiver shares a receive code. A pass moves to them and BITMAPWIN stops accepting your old copy. Vault notes are checked only on devices, so a sender who kept a copy could still give the same note twice. No wallet transfer appears on Bitcoin."],
];

/** Plain-language explainer plus an on-device checker for pasted shadow codes. */
export function RelicInspector() {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  return (
    <section className="mt-8 rounded border border-border bg-card/60 p-4">
      <div className="text-[11px] tracking-widest text-signal">SHADOW UTILITY · HOW IT WORKS</div>
      <p className="mt-2 max-w-2xl font-sans text-muted-foreground">
        Hold passes, relics and keys for BITMAPWIN worlds without tying them to your public wallet history.
      </p>
      <ol className="mt-3 grid gap-2 md:grid-cols-2">
        {STEPS.map(([t, d]) => (
          <li key={t} className="rounded border border-border/60 bg-background/40 p-3">
            <div className="text-[11px] text-primary">{t}</div>
            <p className="mt-1 font-sans text-[13px] leading-normal text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-6 text-[11px] tracking-widest text-signal">RELIC INSPECTOR</div>
      <p className="mt-1 font-sans text-[12px] text-muted-foreground">
        Paste a note, pass backup or receive code. It's checked here in your browser; nothing is sent anywhere.
      </p>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={2}
        placeholder="SHADOW-NOTE-v1.… / SHADOW-PASS-v1.… / SHADOW-RECV-v1.…"
        className="mt-2 w-full rounded border border-border bg-background px-2 py-1.5 text-[11px]"
        data-no-translate
      />
      <button
        type="button"
        onClick={() => setRes(code.trim() ? inspect(code) : null)}
        className="mt-2 rounded border border-primary bg-primary/15 px-3 py-1.5 text-[12px] text-primary"
      >
        [ INSPECT ]
      </button>
      {res ? (
        <div className="mt-3 rounded border border-border/60 bg-background/40 p-3 text-[12px]">
          {res.kind === "note" ? (
            <>
              <div className={res.valid ? "text-signal" : "text-destructive"}>
                {res.valid ? "✓ HISTORY IS INTACT" : "✗ HISTORY IS BROKEN, EDITED OR FORGED"}
              </div>
              <div className="mt-1 text-foreground">{res.note.label}</div>
              <div className="mt-1 text-muted-foreground">
                {res.note.chain.length - 1} handoffs · origin <span data-no-translate>{short(res.note.genesis)}</span>
              </div>
              <ul className="mt-2 space-y-0.5 font-sans text-[12px] text-muted-foreground">
                <li>{res.valid ? "✓" : "✗"} History: every link and every handoff sign-off checks out.</li>
                <li>– Ownership: not proven here. Only the device holding the latest secret can accept or pass it on.</li>
                <li>– Copies: not prevented. Notes aren't recorded on Bitcoin, so a sender who kept a copy could give it twice.</li>
              </ul>
              <p className="mt-1 font-sans text-muted-foreground">Shows no wallet, account or holder name — only fingerprints.</p>
            </>
          ) : res.kind === "pass" ? (
            <>
              <div className="text-primary">⚠ PASS BACKUP — THIS IS THE SECRET ITSELF</div>
              <div className="mt-1 text-muted-foreground">
                Room <span data-no-translate>{res.slug}</span> · pen name <span data-no-translate>{res.handle}</span>
              </div>
              <div className="mt-1 text-muted-foreground">
                Public fingerprint <span data-no-translate>{short(res.commitment)}</span>
              </div>
              <p className="mt-1 font-sans text-muted-foreground">Anyone with this text holds the pass. Never post it.</p>
            </>
          ) : res.kind === "recv" ? (
            <>
              <div className="text-signal">✓ RECEIVE CODE — SAFE TO SHARE</div>
              <div className="mt-1 text-muted-foreground">
                For room <span data-no-translate>{res.slug}</span> · fingerprint <span data-no-translate>{short(res.commitment)}</span>
              </div>
            </>
          ) : (
            <div className="text-destructive">✗ NOT A SHADOW CODE</div>
          )}
        </div>
      ) : null}
    </section>
  );
}
