import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  sendPasswordReset,
  signInWithEmail,
  signUpWithEmail,
  useAuthSession,
} from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In — Bitmap Marketplace Account" },
      {
        name: "description",
        content:
          "Create a Bitmap Marketplace account and link your Bitcoin wallet with a signed message so your profile, parcels and bids persist across devices.",
      },
      { property: "og:title", content: "Sign In — Bitmap Marketplace Account" },
      {
        property: "og:description",
        content:
          "Account login for Bitmap Marketplace. Link your ordinals address by signing a challenge to own your profile permanently.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { session, loading } = useAuthSession();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/wallet" });
  }, [loading, session, navigate]);

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

  const google = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      toast("GOOGLE SIGN-IN FAILED", { description: (err as Error).message.toUpperCase() });
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
        PROFILE, PARCEL PAGES AND BIDS STAY YOURS<span className="blink">_</span>
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4 border border-border p-5">
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

      <button
        type="button"
        onClick={() => void google()}
        disabled={busy}
        className="btn-term-ghost mt-3 w-full"
      >
        [ CONTINUE WITH GOOGLE ]
      </button>

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
