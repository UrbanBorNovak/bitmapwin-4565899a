import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type OAuthDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  approveAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
  denyAuthorization: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-4 py-16 md:px-8">
      <h1 className="display text-2xl">AUTHORIZATION FAILED</h1>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        &gt; {String((error as Error)?.message ?? error).toUpperCase()}
      </p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "AN AGENT";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16 md:px-8">
      <h1 className="display text-2xl">CONNECT {clientName.toUpperCase()}</h1>
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        &gt; THIS LETS {clientName.toUpperCase()} USE BITMAP UNHINGED AS YOU — READ YOUR BITMAPS,
        BIDS, BUILDS AND BIT BALANCE<span className="blink">_</span>
      </p>
      {error && (
        <p role="alert" className="mt-4 font-mono text-xs text-destructive">
          &gt; {error.toUpperCase()}
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <button className="btn-term" type="button" disabled={busy} onClick={() => decide(true)}>
          [ APPROVE ]
        </button>
        <button className="btn-term-ghost" type="button" disabled={busy} onClick={() => decide(false)}>
          [ DENY ]
        </button>
      </div>
    </main>
  );
}
