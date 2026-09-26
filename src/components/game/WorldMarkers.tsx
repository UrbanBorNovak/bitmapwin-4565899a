/**
 * ON-CHAIN WORLD MARKERS — BITMAP name labels drawn with the inscribed
 * pixel font, and the destination arrow from the inscribed arrow texture.
 * Both load straight from their inscriptions; when the chain is unreachable
 * the label falls back to plain canvas type and the arrow to a cone.
 */
import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { inscriptionContentUrl } from "@/lib/build-sdk";
import { ONCHAIN_ENGINE } from "@/lib/onchain-engine";
import { loadPixelFont, renderPixelText, type PixelFont } from "@/lib/pixel-font";

const noRaycast = () => {};

let arrowTexturePromise: Promise<THREE.Texture | null> | null = null;
function loadArrowTexture(): Promise<THREE.Texture | null> {
  if (!arrowTexturePromise) {
    arrowTexturePromise = new Promise((resolve) => {
      new THREE.TextureLoader().load(
        inscriptionContentUrl(ONCHAIN_ENGINE["arrowTexture"]!.id),
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          resolve(texture);
        },
        undefined,
        () => resolve(null),
      );
    });
  }
  return arrowTexturePromise;
}

/**
 * Floating "{height}.BITMAP" label in the on-chain pixel font.
 * Billboards toward the camera and keeps a steady height over the plot.
 */
export const BitmapPixelLabel = memo(function BitmapPixelLabel({
  text,
  position,
  color = "#f2f2f2",
  size = 1,
}: {
  text: string;
  position: [number, number, number];
  color?: string;
  size?: number;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: THREE.Texture | null = null;
    loadPixelFont().then((font: PixelFont | null) => {
      if (cancelled) return;
      const canvas = font
        ? renderPixelText(font, text, { color, scale: 1 })
        : fallbackText(text, color);
      if (!canvas || cancelled) return;
      created = new THREE.CanvasTexture(canvas);
      created.colorSpace = THREE.SRGBColorSpace;
      created.magFilter = THREE.NearestFilter;
      setTexture(created);
    });
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [text, color]);

  if (!texture) return null;
  const image = texture.image as { width: number; height: number };
  const aspect = image.width / image.height;
  const height = 0.11 * size;
  return (
    <sprite
      ref={spriteRef}
      position={position}
      scale={[height * aspect, height, 1]}
      raycast={noRaycast}
      renderOrder={30}
    >
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
});

/** Plain canvas type used only while the inscribed font is unreachable. */
function fallbackText(text: string, color: string): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.font = "28px monospace";
  const width = Math.ceil(context.measureText(text).width);
  canvas.width = width + 8;
  canvas.height = 36;
  context.font = "28px monospace";
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(text, 4, 19);
  return canvas;
}

/**
 * The inscribed arrow, hovering and bobbing over the BITMAP you travelled
 * to — the world's "you are here" marker. Falls back to a small cone.
 */
export const DestinationArrow = memo(function DestinationArrow({
  position,
  color = "#f7931a",
}: {
  position: [number, number, number];
  color?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadArrowTexture().then((loaded) => {
      if (!cancelled) setTexture(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useFrame(({ clock, camera }) => {
    const group = groupRef.current;
    if (!group) return;
    group.position.y = position[1] + 0.55 + Math.sin(clock.elapsedTime * 2.2) * 0.06;
    // Face the camera around the vertical axis only, so the arrow stays upright.
    group.rotation.y = Math.atan2(
      camera.position.x - group.position.x,
      camera.position.z - group.position.z,
    );
  });

  return (
    <group ref={groupRef} position={position} raycast={noRaycast}>
      {texture ? (
        <mesh raycast={noRaycast} renderOrder={29}>
          <planeGeometry args={[0.28, 0.28]} />
          <meshBasicMaterial
            map={texture}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ) : (
        <mesh raycast={noRaycast} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.12, 0.3, 4]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
});
