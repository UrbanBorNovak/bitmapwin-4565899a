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
import { applyUiScale, loadUiScale } from "@/graphics/ui-scale";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteTickerTape } from "@/components/SiteTickerTape";

import { SiteFooter } from "@/components/SiteFooter";
import { Toaster } from "@/components/ui/sonner";
import { TransferTrackerHost } from "@/components/TransferTracker";
import { supabase } from "@/integrations/supabase/client";
import { rememberReferralCode } from "@/lib/referrals";
import { SalesBackdrop } from "@/components/SalesBackdrop";
import { TradeCrawlerDriver } from "@/components/TradeCrawlerDriver";
import { BssCrawlerDriver } from "@/components/BssCrawlerDriver";
import { RegistryResolverDriver } from "@/components/RegistryResolverDriver";
import { BlockFactsDriver } from "@/components/BlockFactsDriver";
import { LanguageProvider } from "@/lib/i18n";
import { GuidedTour } from "@/components/GuidedTour";
import { PillarDock } from "@/components/PillarDock";




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

/** A page file fetched after an update no longer exists: reload once to get the fresh one. */
function reloadOnStaleChunk(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (!/dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(msg)) return false;
  // Allow up to 3 reloads per minute: a preview restart can make the first retry fail too.
  const key = "bitmapwin:chunk-reloads";
  const now = Date.now();
  const recent = (JSON.parse(sessionStorage.getItem(key) ?? "[]") as number[]).filter((t) => now - t < 60_000);
  if (recent.length >= 3) return false;
  sessionStorage.setItem(key, JSON.stringify([...recent, now]));
  window.setTimeout(() => window.location.reload(), recent.length * 1500);
  return true;
}

const isChunkError = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported/i.test(
    error instanceof Error ? error.message : String(error ?? ""),
  );

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const chunk = isChunkError(error);
  useEffect(() => {
    if (reloadOnStaleChunk(error)) return undefined;
    if (chunk) {
      // Fast retries exhausted (e.g. preview still restarting): keep retrying slowly, never stay blank.
      const t = window.setTimeout(() => window.location.reload(), 10_000);
      return () => window.clearTimeout(t);
    }
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    return undefined;
  }, [error, chunk]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="terminal-panel max-w-md p-8 text-center">
        <div className="label text-bitcoin">SYSTEM · ERROR</div>
        <h1 className="display mt-4 text-2xl text-foreground">{chunk ? "LOADING THE LATEST VERSION" : "THIS PAGE DIDN'T LOAD"}</h1>
        <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">
          &gt; {chunk ? "THE SITE WAS UPDATED · RELOADING AUTOMATICALLY" : "TRY THE REQUEST AGAIN OR RETURN TO THE START"}<span className="blink">_</span>
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
      { name: "google-site-verification", content: "MxwI74YqqE6NFjku4b8_wFVg6dVt4ocAjHDzO-B2UwM" },
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
      { property: "og:image", content: "https://bitmapwin.app/social-card.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://bitmapwin.app/social-card.jpg" },
      { name: "theme-color", content: "#F7931A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "BitmapWin" },
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
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&family=Work+Sans:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
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
    const onPreload = (e: Event) => { if (reloadOnStaleChunk((e as Event & { payload?: unknown }).payload ?? new Error("dynamically imported module"))) e.preventDefault(); };
    const onRejection = (e: PromiseRejectionEvent) => { reloadOnStaleChunk(e.reason); };
    window.addEventListener("vite:preloadError", onPreload);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("vite:preloadError", onPreload); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);

  useEffect(() => { applyUiScale(loadUiScale()); }, []);

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


  if (routeKey.startsWith("/embed")) {
    return (
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <Outlet />
        </LanguageProvider>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
      <div className="relative flex min-h-screen flex-col bg-background">
        <SalesBackdrop />
        <div className="relative z-40">
          <SiteTickerTape />
          <SiteHeader />
        </div>

        <main className="relative z-10 flex-1 pb-20">
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <div key={routeKey} className="route-stage">
            <Outlet />
          </div>
        </main>
        <div className="relative z-10">
          <SiteFooter />
        </div>
      </div>
      <PillarDock />
      <GuidedTour />
      <TradeCrawlerDriver />
      <BssCrawlerDriver />
      <RegistryResolverDriver />
      <BlockFactsDriver />
      <Toaster />
      <TransferTrackerHost />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

