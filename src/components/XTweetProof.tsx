import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { verifyXTweetProofFn } from "@/lib/profiles.functions";
import { xProofText, xProofToken } from "@/lib/x-handle";

/** Public tweet proof: post a code naming the wallet, paste the link, the server checks it via X's free oEmbed. */
export function XTweetProof({ address, savedHandle, verifiedTweetId }: { address: string; savedHandle: string | null; verifiedTweetId: string | null }) {
  const [token, setToken] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const verify = useServerFn(verifyXTweetProofFn);
  const qc = useQueryClient();

  useEffect(() => {
    void xProofToken(address).then(setToken);
  }, [address]);

  if (!savedHandle) {
    return <p className="font-mono text-[9px] text-muted-foreground">SAVE A HANDLE TO VERIFY IT WITH A PUBLIC TWEET.</p>;
  }
  if (verifiedTweetId) {
    return (
      <a href={`https://x.com/${savedHandle}/status/${verifiedTweetId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-signal underline underline-offset-4" data-no-translate>
        ✓ @{savedHandle} VERIFIED BY PUBLIC TWEET
      </a>
    );
  }
  const text = token ? xProofText(address, token) : "";
  const submit = async () => {
    setBusy(true);
    try {
      const r = await verify({ data: { address, tweetUrl: url } });
      if (r.ok) {
        toast("X HANDLE VERIFIED", { description: `@${savedHandle}` });
        await qc.invalidateQueries({ queryKey: ["wallet-profile", address] });
      } else toast("NOT VERIFIED", { description: r.error });
    } catch (e) {
      toast("NOT VERIFIED", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-readout space-y-2 p-3">
      <p className="label text-profile-warm-muted">VERIFY @{savedHandle} WITH A PUBLIC TWEET</p>
      <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-foreground" data-no-translate>{text}</pre>
      <a
        href={`https://x.com/intent/post?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-9 items-center border border-primary px-3 font-mono text-[10px] text-primary hover:bg-primary/10"
      >
        1 · POST PROOF ON X
      </a>
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://x.com/you/status/…"
          data-no-translate
          className="min-h-9 flex-1 border border-border bg-transparent px-2 font-mono text-[10px] text-foreground outline-none"
        />
        <button type="button" onClick={submit} disabled={busy || !url} className="min-h-9 border border-signal px-3 font-mono text-[10px] text-signal disabled:opacity-40">
          {busy ? "CHECKING…" : "2 · VERIFY"}
        </button>
      </div>
      <p className="font-mono text-[9px] text-muted-foreground">THE TWEET MUST STAY PUBLIC WHILE WE CHECK IT. CHANGING YOUR HANDLE CLEARS THE BADGE.</p>
    </div>
  );
}
