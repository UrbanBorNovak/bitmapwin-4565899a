import { Suspense, useState } from "react";
import { SafeCanvas as Canvas } from "@/components/game/SafeCanvas";
import { OrbitControls } from "@react-three/drei";
import { useQuery } from "@tanstack/react-query";
import { storefrontQuery } from "@/components/BitmapStorefront";
import { BuyButton } from "@/components/BuyButton";
import { formatSats } from "@/lib/trades";
import { shortenAddress } from "@/lib/registry";

// Three.js materials need literal colours; these mirror the site tokens.
const ORANGE = "#f7931a";
const CYAN = "#3fe0d0";
const DARK = "#0b0e14";

function Pedestal({ x, active, onPick }: { x: number; active: boolean; onPick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.5, 0]} onClick={(e) => { e.stopPropagation(); onPick(); }}
        onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <boxGeometry args={[0.8, 1, 0.8]} />
        <meshStandardMaterial color={DARK} emissive={active || hover ? ORANGE : "#000"} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0, 1.45, 0]} rotation={[0.6, 0.6, 0]} onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <boxGeometry args={[0.45, 0.45, 0.45]} />
        <meshStandardMaterial color={active ? ORANGE : CYAN} emissive={active ? ORANGE : CYAN} emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

/** 3D merchant stall for a BITMAP: one pedestal per open storefront listing; picking one opens a real PSBT buy. */
export function TerritoryKiosk({ height }: { height: number }) {
  const { data: rows = [] } = useQuery(storefrontQuery(height));
  const [sel, setSel] = useState(0);
  const items = rows.slice(0, 9);
  const picked = items[sel];
  const span = Math.max(1, items.length) * 1.3;

  return (
    <section className="mt-6 border border-border" data-no-translate>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border p-4">
        <h3 className="display text-lg">{height}.BITMAP · 3D KIOSK</h3>
        <span className="label">{items.length} ON DISPLAY · TAP A PEDESTAL</span>
      </header>
      <div className="h-72 w-full bg-background">
        <Canvas camera={{ position: [0, 3, 6], fov: 45 }} dpr={[1, 1.5]}>
          <Suspense fallback={null}>
            <ambientLight intensity={0.4} />
            <pointLight position={[0, 5, 3]} intensity={30} color={ORANGE} />
            <mesh position={[0, -0.05, 0]}>
              <boxGeometry args={[span + 1.5, 0.1, 3]} />
              <meshStandardMaterial color={ORANGE} />
            </mesh>
            <mesh position={[0, 2.6, -1.2]}>
              <boxGeometry args={[span + 1.5, 0.15, 0.15]} />
              <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.8} />
            </mesh>
            {items.map((r, i) => (
              <Pedestal key={r.offer_id} x={(i - (items.length - 1) / 2) * 1.3} active={i === sel} onPick={() => setSel(i)} />
            ))}
            <OrbitControls enablePan={false} minDistance={3} maxDistance={12} maxPolarAngle={1.45} />
          </Suspense>
        </Canvas>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4 font-mono text-xs">
        {picked?.offers ? (
          <>
            <span className="break-all">
              {picked.offers.inscription_id?.slice(0, 12)}… · {shortenAddress(picked.offers.seller_address ?? "")} ·{" "}
              <span className="text-bitcoin">{formatSats(Number(picked.offers.price_sats))}</span>
            </span>
            <BuyButton offerId={picked.offer_id} priceSats={Number(picked.offers.price_sats)} />
          </>
        ) : (
          <span className="text-muted-foreground">&gt; NO LISTINGS YET — LIST AN ORDINAL IN THE STOREFRONT ABOVE</span>
        )}
      </div>
    </section>
  );
}
