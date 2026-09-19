import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { rememberReferralCode } from "@/lib/referrals";
import { SalesBackdrop } from "@/components/SalesBackdrop";
import { TradeCrawlerDriver } from "@/components/TradeCrawlerDriver";
import { RegistryResolverDriver } from "@/components/RegistryResolverDriver";
import { LanguageProvider } from "@/lib/i18n";
import { GuidedTour } from "@/components/GuidedTour";




function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="terminal-panel max-w-md p-8 text-center">
        <div className="label text-bitcoin">SYSTEM · 404</div>
        <h1 className="display mt-4 text-7xl text-foreground">404</h1>
        <h2 className="display mt-4 text-xl text-foreground">PAGE NOT FOUND</h2>
        <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
          &gt; THE REQUESTED LOCATION DOES NOT EXIST OR HAS MOVED<span className="blink">_</span>
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-term">[ RETURN HOME ]</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="terminal-panel max-w-md p-8 text-center">
        <div className="label text-bitcoin">SYSTEM · ERROR</div>
        <h1 className="display mt-4 text-2xl text-foreground">THIS PAGE DIDN'T LOAD</h1>
        <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
          &gt; TRY THE REQUEST AGAIN OR RETURN TO THE START<span className="blink">_</span>
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-term"
          >
            [ TRY AGAIN ]
          </button>
          <a href="/" className="btn-term-ghost">[ GO HOME ]</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "XZ9WxCPdOoKgy74M0gLKVtH3qIpEXFZcaJDOjFfs2kk" },
      { title: "Bitmap Unhinged — Bitcoin Digital Land" },
      {
        name: "description",
        content: "Explore, discover and trade Bitcoin Bitmap digital land. The land layer of Bitcoin.",
      },
      { property: "og:title", content: "Bitmap Unhinged — Bitcoin Digital Land" },
      {
        property: "og:description",
        content: "Explore, discover and trade Bitcoin Bitmap digital land.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const routeKey = useRouterState({ select: (state) => state.location.pathname });

  // Remember an incoming ?ref= invite so it can be claimed once a wallet is verified.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) rememberReferralCode(ref);
  }, []);

  // Single auth subscriber for the app: refresh account-scoped data on real
  // identity transitions only (not token refreshes or initial session).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      else queryClient.removeQueries({ queryKey: ["wallet-links"] });
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);


  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <div className="relative flex min-h-screen flex-col bg-background">
        <SalesBackdrop />
        <div className="relative z-40">
          <SiteHeader />
        </div>
        <main className="relative z-10 flex-1">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <div key={routeKey} className="route-stage">
            <Outlet />
          </div>
        </main>
        <div className="relative z-10">
          <SiteFooter />
        </div>
      </div>
      <GuidedTour />
      <TradeCrawlerDriver />
      <RegistryResolverDriver />
      <Toaster />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

