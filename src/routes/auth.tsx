import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import {
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  useAuthSession,
} from "@/lib/auth";
import { WalletSignIn } from "@/components/WalletSignIn";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Bitmap Unhinged Account" },
      {
        name: "description",
        content:
          "Create a Bitmap Unhinged account and link your Bitcoin wallet with a signed message so your profile, bitmaps and bids persist across devices.",
      },
      { property: "og:title", content: "Sign In — Bitmap Unhinged Account" },
      {
        property: "og:description",
        content:
          "Account login for Bitmap Unhinged. Link your ordinals address by signing a challenge to own your profile permanently.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const raw = s['next'];
    return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")
      ? { next: raw }
      : {};
  },
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { session, loading } = useAuthSession();
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !session) return;
    if (next) window.location.replace(next);
    else void navigate({ to: "/wallet" });
  }, [loading, session, navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        await sendPasswordReset(email.trim());
        setSent("CHECK YOUR INBOX FOR THE RESET LINK");
      } else if (mode === "signup") {
        const res = await signUpWithEmail(email.trim(), password);
        if (res.session) {
          toast("ACCOUNT CREATED", { description: "YOU ARE SIGNED IN" });
        } else {
          setSent("CONFIRM YOUR EMAIL TO ACTIVATE THE ACCOUNT");
        }
      } else {
        await signInWithEmail(email.trim(), password);
        toast("SIGNED IN");
      }
    } catch (err) {
      toast("AUTH FAILED", { description: (err as Error).message.toUpperCase() });
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    try {
      await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: next ? `${window.location.origin}${next}` : window.location.origin,
      });
    } catch (err) {
      toast(`${provider.toUpperCase()} SIGN-IN FAILED`, { description: (err as Error).message.toUpperCase() });
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-14 md:px-8">
      <h1 className="display text-3xl">
        {mode === "signup" ? "CREATE ACCOUNT" : mode === "forgot" ? "RESET PASSWORD" : "SIGN IN"}
      </h1>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        &gt; ONE ACCOUNT, MANY ADDRESSES. LINK YOUR WALLET WITH A SIGNED MESSAGE AND YOUR
        PROFILE, BITMAP PAGES AND BIDS STAY YOURS<span className="blink">_</span>
      </p>

      <div className="mt-8 border border-border p-5">
        <p className="label">SIGN IN WITH YOUR BITCOIN WALLET</p>
        <p className="mt-2 mb-3 font-mono text-[11px] text-muted-foreground">
          &gt; NO EMAIL NEEDED — YOUR ADDRESS SIGNS A MESSAGE AND BECOMES YOUR ACCOUNT
        </p>
        <WalletSignIn />
      </div>

      <p className="mt-6 label">OR USE AN EMAIL ACCOUNT</p>

      <form onSubmit={submit} className="mt-2 space-y-4 border border-border p-5">
        <label className="block">
          <span className="label">EMAIL</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
          />
        </label>

        {mode !== "forgot" && (
          <label className="block">
            <span className="label">PASSWORD</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
            />
          </label>
        )}

        <button type="submit" className="btn-term w-full disabled:opacity-30" disabled={busy}>
          {busy
            ? "[ WORKING… ]"
            : mode === "signup"
              ? "[ CREATE ACCOUNT ]"
              : mode === "forgot"
                ? "[ SEND RESET LINK ]"
                : "[ SIGN IN ]"}
        </button>

        {sent && <p className="font-mono text-xs text-foreground">&gt; {sent}</p>}
      </form>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void oauth("google")}
          disabled={busy}
          className="btn-term-ghost w-full"
        >
          [ GOOGLE ]
        </button>
        <button
          type="button"
          onClick={() => void oauth("apple")}
          disabled={busy}
          className="btn-term-ghost w-full"
        >
          [ APPLE ]
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-4 font-mono text-[11px] uppercase text-muted-foreground">
        {mode !== "signin" && (
          <button type="button" className="underline" onClick={() => setMode("signin")}>
            SIGN IN
          </button>
        )}
        {mode !== "signup" && (
          <button type="button" className="underline" onClick={() => setMode("signup")}>
            CREATE ACCOUNT
          </button>
        )}
        {mode !== "forgot" && (
          <button type="button" className="underline" onClick={() => setMode("forgot")}>
            FORGOT PASSWORD
          </button>
        )}
        <Link to="/marketplace" className="underline">
          BROWSE WITHOUT ACCOUNT
        </Link>
      </div>
    </main>
  );
}
