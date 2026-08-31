import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set A New Password — Bitmap Marketplace" },
      {
        name: "description",
        content: "Choose a new password for your Bitmap Marketplace account after a reset link.",
      },
      { property: "og:title", content: "Set A New Password — Bitmap Marketplace" },
      {
        property: "og:description",
        content: "Finish your password reset and get back to your bitmap parcels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast("PASSWORD UPDATED");
      await navigate({ to: "/wallet" });
    } catch (err) {
      toast("UPDATE FAILED", { description: (err as Error).message.toUpperCase() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-14 md:px-8">
      <h1 className="display text-3xl">NEW PASSWORD</h1>
      <form onSubmit={submit} className="mt-8 space-y-4 border border-border p-5">
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
        <button type="submit" className="btn-term w-full disabled:opacity-30" disabled={busy}>
          {busy ? "[ SAVING… ]" : "[ SET PASSWORD ]"}
        </button>
      </form>
    </main>
  );
}
