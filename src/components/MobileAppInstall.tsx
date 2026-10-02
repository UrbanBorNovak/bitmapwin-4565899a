import { useEffect, useState } from "react";
import { Apple, Smartphone, X } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function MobileAppInstall() {
  const [deferred, setDeferred] = useState<InstallPrompt | null>(null);
  const [guide, setGuide] = useState<null | "ios" | "android">(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallPrompt);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const android = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    setGuide("android");
  };

  if (installed) {
    return <div className="label mt-4 text-signal">● APP INSTALLED // RUNNING FROM YOUR HOME SCREEN</div>;
  }

  return (
    <div className="mt-4">
      <div className="label text-muted-foreground">MOBILE APP // FREE · NO APP STORE NEEDED</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="btn-term-ghost inline-flex items-center gap-2" onClick={() => setGuide("ios")}>
          <Apple className="size-4" aria-hidden="true" /> iOS APP
        </button>
        <button type="button" className="btn-term-ghost inline-flex items-center gap-2" onClick={() => void android()}>
          <Smartphone className="size-4" aria-hidden="true" /> ANDROID APP
        </button>
      </div>

      {guide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={guide === "ios" ? "Install on iPhone" : "Install on Android"}
          onClick={() => setGuide(null)}
        >
          <div className="w-full max-w-md border border-border-strong bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="label text-bitcoin">{guide === "ios" ? "INSTALL ON IPHONE / IPAD" : "INSTALL ON ANDROID"}</div>
              <button type="button" aria-label="Close" onClick={() => setGuide(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <ol className="mt-4 space-y-3 font-mono text-sm">
              {(guide === "ios"
                ? ["Open bitmapwin.app in Safari.", "Tap the Share button (square with an up arrow).", "Choose “Add to Home Screen”, then tap Add."]
                : ["Open bitmapwin.app in Chrome.", "Tap the ⋮ menu in the top corner.", "Choose “Install app” or “Add to Home screen”."]
              ).map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="text-bitcoin">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-foreground">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">BitmapWin then opens full-screen from its own icon, like any other app.</p>
          </div>
        </div>
      )}
    </div>
  );
}
