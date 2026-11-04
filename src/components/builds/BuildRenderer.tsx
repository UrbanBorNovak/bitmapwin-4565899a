import { Suspense, lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { parseBuildConfig, type BuildKind } from "@/lib/build-sdk";
import { InfoBuild } from "@/components/builds/InfoBuild";
import { GalleryBuild } from "@/components/builds/GalleryBuild";
import { Game2DBuild } from "@/components/builds/Game2DBuild";
import { ShopBuild } from "@/components/builds/ShopBuild";
import { MyspaceBuild } from "@/components/builds/MyspaceBuild";


const Game3DBuild = lazy(() => import("@/components/builds/Game3DBuild"));

const Placeholder = ({ label }: { label: string }) => (
  <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border">
    <span className="label text-muted-foreground">{label}</span>
  </div>
);

/** Renders whatever the holder built, based on the build kind + config. */
export function BuildRenderer({
  kind,
  config,
  height,
}: {
  kind: BuildKind;
  config: unknown;
  height: number;
}) {
  if (kind === "info") return <InfoBuild config={parseBuildConfig("info", config)} />;
  if (kind === "shop")
    return <ShopBuild config={parseBuildConfig("shop", config)} height={height} />;

  if (kind === "gallery")
    return <GalleryBuild config={parseBuildConfig("gallery", config)} height={height} />;
  if (kind === "myspace")
    return <MyspaceBuild config={parseBuildConfig("myspace", config)} height={height} />;
  if (kind === "game2d")
    return (
      <ClientOnly fallback={<Placeholder label="LOADING ARCADE…" />}>
        <Game2DBuild config={parseBuildConfig("game2d", config)} height={height} />
      </ClientOnly>
    );
  return (
    <ClientOnly fallback={<Placeholder label="LOADING 3D WORLD…" />}>
      <Suspense fallback={<Placeholder label="LOADING 3D WORLD…" />}>
        <Game3DBuild config={parseBuildConfig("game3d", config)} height={height} />
      </Suspense>
    </ClientOnly>
  );
}
