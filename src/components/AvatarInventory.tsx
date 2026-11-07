import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { myBitmapModelsQuery } from "@/lib/bitmap-models";
import { addToWardrobe, avatarWardrobe, removeFromWardrobe } from "@/lib/map-identity";
import { walletQuery } from "@/lib/wallet";

/**
 * In-world inventory. Lists the real on-chain 3D inscriptions this visitor can
 * wear — models they already published on their own BITMAPs, 3D inscriptions
 * sitting in their connected wallet, plus any inscription id they pin manually —
 * and lets them equip, unequip and swap the worn avatar without leaving the map.
 */

type InventoryItem = {
  inscriptionId: string;
  source: string;
  detail?: string | undefined;
  pinned?: boolean | undefined;
};


const short = (id: string) => `${id.slice(0, 8)}…${id.slice(-6)}`;

export function AvatarInventory({
  addresses,
  equipped,
  onEquip,
  onClose,
}: {
  /** wallet + linked addresses used to look up owned on-chain models */
  addresses: string[];
  equipped: string | null;
  onEquip: (inscriptionId: string | null) => void;
  onClose: () => void;
}) {
  const [pinned, setPinned] = useState<string[]>(() => avatarWardrobe());
  const [draft, setDraft] = useState("");

  const published = useQuery(myBitmapModelsQuery(addresses));
  const primary = addresses[0] ?? "";
  const wallet = useQuery(walletQuery(primary));

  const items = useMemo<InventoryItem[]>(() => {
    const map = new Map<string, InventoryItem>();
    for (const model of published.data ?? []) {
      map.set(model.inscriptionId, {
        inscriptionId: model.inscriptionId,
        source: "PLACED ON YOUR BITMAP",
        detail: `${model.bitmapHeight}.BITMAP · ${model.triangleCount.toLocaleString("en-US")} TRIS`,
      });
    }
    for (const utxo of wallet.data?.utxos ?? []) {
      for (const inscription of utxo.inscriptions) {
        const type = (inscription.contentType ?? "").toLowerCase();
        if (!type.includes("gltf") && !type.includes("model")) continue;
        if (map.has(inscription.id)) continue;
        map.set(inscription.id, {
          inscriptionId: inscription.id,
          source: "IN YOUR WALLET",
          detail: inscription.contentType ?? undefined,
        });
      }
    }
    for (const id of pinned) {
      const existing = map.get(id);
      if (existing) map.set(id, { ...existing, pinned: true });
      else map.set(id, { inscriptionId: id, source: "PINNED BY YOU", pinned: true });
    }
    return [...map.values()];
  }, [published.data, wallet.data, pinned]);

  const loading = published.isLoading || (primary !== "" && wallet.isLoading);

  return (
    <div className="absolute right-3 top-16 z-50 flex max-h-[calc(100%-5rem)] w-[min(320px,calc(100%-1.5rem))] flex-col border border-bitcoin bg-background/95">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="label">AVATAR INVENTORY</span>
        <button type="button" aria-label="Close inventory" onClick={onClose} className="text-muted-foreground hover:text-bitcoin">
          <X className="size-3.5" />
        </button>
      </div>

      <div className="border-b border-border px-3 py-2 font-mono text-[10px]" data-no-translate>
        {equipped ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-bitcoin">WEARING {short(equipped)}</span>
            <Button className="btn-term-ghost" variant="ghost" onClick={() => onEquip(null)}>[ UNEQUIP ]</Button>
          </div>
        ) : (
          <span className="text-muted-foreground">WEARING THE DEFAULT CYPHERPUNK FIGURE</span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-border">
        {loading ? (
          <p className="px-3 py-3 font-mono text-[10px] text-muted-foreground">SCANNING YOUR ON-CHAIN 3D INSCRIPTIONS…</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-3 font-mono text-[10px] text-muted-foreground">
            NO 3D INSCRIPTIONS FOUND YET — PIN AN INSCRIPTION ID BELOW TO WEAR IT
          </p>
        ) : (
          items.map((item) => {
            const isOn = item.inscriptionId === equipped;
            return (
              <div key={item.inscriptionId} className="px-3 py-2" data-no-translate>
                <p className="truncate font-mono text-[11px] text-foreground">{short(item.inscriptionId)}</p>
                <p className="label mt-0.5">{item.source}{item.detail ? ` · ${item.detail}` : ""}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Button
                    className={isOn ? "btn-term" : "btn-term-ghost"}
                    variant="ghost"
                    onClick={() => onEquip(isOn ? null : item.inscriptionId)}
                  >
                    {isOn ? "[ UNEQUIP ]" : equipped ? "[ SWAP IN ]" : "[ EQUIP ]"}
                  </Button>
                  {item.pinned ? (
                    <Button
                      className="btn-term-ghost"
                      variant="ghost"
                      onClick={() => setPinned(removeFromWardrobe(item.inscriptionId))}
                    >
                      [ UNPIN ]
                    </Button>
                  ) : (
                    <Button
                      className="btn-term-ghost"
                      variant="ghost"
                      onClick={() => setPinned(addToWardrobe(item.inscriptionId))}
                    >
                      [ PIN ]
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        className="flex gap-1 border-t border-border px-3 py-2"
        onSubmit={(event) => {
          event.preventDefault();
          const id = draft.trim();
          if (!id) return;
          setPinned(addToWardrobe(id));
          onEquip(id);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="GLB INSCRIPTION ID"
          aria-label="Inscription id to equip"
          className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-[10px] text-foreground outline-none placeholder:text-muted-foreground focus:border-bitcoin"
        />
        <Button className="btn-term" type="submit" disabled={!draft.trim()}>[ EQUIP ]</Button>
      </form>

      {addresses.length === 0 ? (
        <p className="label border-t border-border px-3 py-2">CONNECT OR LINK A WALLET TO SEE YOUR OWN 3D INSCRIPTIONS</p>
      ) : null}
    </div>
  );
}
