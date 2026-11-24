import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Wallet, RefreshCw, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/lib/auth";
import { useWalletSession } from "@/lib/wallet-session";
import { signMessageWithWallet } from "@/lib/browser-wallet";
import { accountDraftSchema, legacyPasswordHash, passwordCommitment } from "@/lib/l2/l2-account";
import { createL2AccountFn, l2AccountChallengeFn, l2RegistrationStatusFn } from "@/lib/l2/l2-account.functions";

export default function L2AccountRegistration() {
  const { user, loading } = useAuthSession();
  const wallet = useWalletSession();
  const status = useQuery({ queryKey: ["l2-registration-status"], queryFn: () => l2RegistrationStatusFn(), staleTime: 30_000, retry: false });
  const challengeFn = useServerFn(l2AccountChallengeFn);
  const createFn = useServerFn(createL2AccountFn);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState("");
  const ready = status.data?.ready === true;
  async function register() {
    if (!wallet || !user || busy) return;
    setError("");
    const address = wallet.ordinalsAddress;
    const normalized = login.trim().toLowerCase();
    if (!/^[a-z0-9]{3,14}$/.test(normalized)) { setError("Use 3–14 letters or numbers for your login."); return; }
    if (!/^[\x21-\x7e]{8,16}$/.test(password)) { setError("Use 8–16 ASCII characters without spaces for your game password."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const passwordHash = await legacyPasswordHash(password);
      const draft = accountDraftSchema.parse({ login: normalized, address, passwordCommitment: await passwordCommitment(passwordHash) });
      setStage("Preparing signature…");
      const challenge = await challengeFn({ data: draft });
      if (!challenge.ok) { setError(challenge.error); return; }
      setStage("Confirm in your wallet…");
      const signature = await signMessageWithWallet(wallet.provider, address, challenge.message);
      setStage("Creating account…");
      const proof = { ...draft, nonce: challenge.nonce, expiresAt: challenge.expiresAt, signature, passwordHash };
      let result = await createFn({ data: proof });
      if (!result.ok && result.error === "Registration unavailable. Try again later.") result = await createFn({ data: proof });
      if (!result.ok) { setError(result.error ?? "Account could not be created."); return; }
      setCreated(normalized);
    } catch { setError("Registration did not finish. Check your wallet and try again."); }
    finally { setPassword(""); setConfirm(""); setBusy(false); setStage(""); }
  }
  const field = "w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  return <section className="border-y border-border py-6 space-y-4" aria-labelledby="l2-register-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-mono text-xs text-primary">BITCOIN IDENTITY</p><h2 id="l2-register-title" className="font-display text-2xl">Create your L2 account</h2></div>
      <Button variant="ghost" size="icon" title="Check registration availability" aria-label="Check registration availability" disabled={status.isFetching} onClick={() => void status.refetch()}><RefreshCw /></Button>
    </div>
    <p className="text-sm text-muted-foreground">Wallet-linked account · no Bitcoin transaction · no BIT rewards or land rights granted.</p>
    {!ready ? <p role="status" className="border-l-2 border-signal pl-3 text-sm text-muted-foreground">{status.isFetching ? "Checking registration…" : "Registration is awaiting the server connection."}</p> : null}
    {created ? <div role="status" className="flex items-center gap-3 text-signal"><Check /><p>Account <strong className="font-mono" data-no-translate>{created}</strong> created. You can now log in with your game password.</p></div> : <>
      <div className="flex flex-wrap gap-2">
        {!user && !loading ? <Button asChild variant="outline"><Link to="/auth"><KeyRound />Sign in to Passport</Link></Button> : null}
        {!wallet ? <Button asChild variant="outline"><Link to="/wallet"><Wallet />Connect wallet</Link></Button> : <p className="min-w-0 break-all font-mono text-xs text-muted-foreground" data-no-translate>{wallet.ordinalsAddress}</p>}
      </div>
      <form className="grid gap-3 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void register(); }}>
        <label className="space-y-1 text-sm">L2 login<input className={field} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" maxLength={14} disabled={busy} required /></label>
        <label className="space-y-1 text-sm">Game password<input className={field} value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={16} disabled={busy} required /></label>
        <label className="space-y-1 text-sm">Confirm password<input className={field} value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={16} disabled={busy} required /></label>
        <div className="md:col-span-3"><Button type="submit" disabled={!ready || !user || !wallet || busy}><KeyRound />{busy ? stage : "Sign & create account"}</Button></div>
      </form>
      <p className="text-xs leading-relaxed text-muted-foreground">Use a separate game password, never your wallet or Passport password. L2 requires a legacy password hash; only that verifier is sent securely to the account server, never your plaintext password.</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </>}
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer font-mono">Server owner setup</summary>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm"><a href="/tools/l2-account-bridge/l2-account-bridge.zip" download><Download />Account bridge</a></Button>
        <Button asChild variant="link" size="sm"><a href="/tools/l2-account-bridge/README.md" target="_blank" rel="noreferrer">Setup instructions</a></Button>
      </div>
    </details>
  </section>;
}