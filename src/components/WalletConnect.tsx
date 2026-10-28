import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  WALLET_LABEL,
  WALLET_PROVIDER_STORAGE_KEY,
  WALLET_SITE,
  connectWallet,
  isWalletInstalled,
  type ConnectedWallet,
  type WalletProviderId,
} from "@/lib/browser-wallet";
import { shortenAddress } from "@/lib/registry";
import { clearWalletSession, saveWalletSession } from "@/lib/wallet-session";
import { RgbBadge } from "@/components/RgbBadge";


const PROVIDERS: WalletProviderId[] = ["unisat", "xverse"];

export function WalletConnect({
  onConnect,
  onDisconnect,
  connectedAddress,
}: {
  onConnect: (wallet: ConnectedWallet) => void;
  onDisconnect?: () => void;
  connectedAddress?: string;
}) {
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [touchDevice, setTouchDevice] = useState(false);
  const [busy, setBusy] = useState<WalletProviderId | null>(null);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);

  useEffect(() => {
    setTouchDevice(window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
    // Extensions inject their provider asynchronously, so keep probing briefly.
    let ticks = 0;
    const probe = () =>
      setInstalled({
        unisat: isWalletInstalled("unisat"),
        xverse: isWalletInstalled("xverse"),
      });
    probe();
    const id = window.setInterval(() => {
      ticks += 1;
      probe();
      if (ticks >= 10) window.clearInterval(id);
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  const run = async (provider: WalletProviderId) => {
    setBusy(provider);
    try {
      const next = await connectWallet(provider);
      setWallet(next);
      window.localStorage.setItem(WALLET_PROVIDER_STORAGE_KEY, provider);
      saveWalletSession(next);
      onConnect(next);
      toast(`${WALLET_LABEL[provider]} CONNECTED`, { description: next.ordinalsAddress });
    } catch (e) {
      toast(`${WALLET_LABEL[provider]} CONNECT FAILED`, {
        description: (e as Error).message.toUpperCase(),
      });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = () => {
    setWallet(null);
    window.localStorage.removeItem(WALLET_PROVIDER_STORAGE_KEY);
    clearWalletSession();
    onDisconnect?.();
  };


  const active = wallet !== null && connectedAddress === wallet.ordinalsAddress;

  return (
    <section className="mt-8 border border-border">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="label">CONNECT WALLET</p>
        {active && (
          <button className="btn-term-ghost" type="button" onClick={disconnect}>
            [ DISCONNECT ]
          </button>
        )}
      </header>

      {active ? (
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          <Field k="PROVIDER" v={WALLET_LABEL[wallet.provider]} />
          <Field k="ORDINALS" v={shortenAddress(wallet.ordinalsAddress)} title={wallet.ordinalsAddress} />
          <Field k="PAYMENT" v={shortenAddress(wallet.paymentAddress)} title={wallet.paymentAddress} />
          <div className="px-4 py-3 md:col-span-3"><RgbBadge /></div>
        </div>
      ) : (
        <div className="p-4">
          {touchDevice && !Object.values(installed).some(Boolean) ? (
            <p className="mb-3 border border-border p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
              MOBILE · OPEN THIS PAGE INSIDE YOUR WALLET'S BROWSER TO CONNECT. YOU CAN STILL INSPECT ANY ADDRESS BELOW.
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">{PROVIDERS.map((p) => {
            const has = installed[p] === true;
            return has ? (
              <button
                key={p}
                type="button"
                className="btn-term flex-1"
                disabled={busy !== null}
                onClick={() => void run(p)}
              >
                {busy === p ? "[ WAITING… ]" : `[ CONNECT ${WALLET_LABEL[p]} ]`}
              </button>
            ) : (
              <a
                key={p}
                href={WALLET_SITE[p]}
                target="_blank"
                rel="noreferrer"
                className="btn-term-ghost flex-1 text-center"
              >
                [ INSTALL {WALLET_LABEL[p]} ]
              </a>
            );
          })}</div>
        </div>
      )}
    </section>
  );
}

function Field({ k, v, title }: { k: string; v: string; title?: string }) {
  return (
    <div className="px-4 py-3">
      <p className="label">{k}</p>
      <p className="mt-1 font-mono text-xs break-all text-foreground" title={title}>
        {v}
      </p>
    </div>
  );
}
