// In-world jumbotron playing a BITMAP's bitmap.stream channel.
// The cross-origin player can't become a WebGL texture, so it is a real iframe
// pinned into the 3D scene; it only loads while the camera is close by.
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SafeHtml } from "@/components/game/SafeHtml";

const NEAR = 6; // in cells: start the stream when this close
const tmp = new THREE.Vector3();

export function StreamJumbotron({ height, position, cell }: { height: number; position: [number, number, number]; cell: number }) {
  const group = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);
  const w = cell * 0.8;
  const h = w * 9 / 16;
  const lift = cell * 0.12;

  useFrame(({ camera }) => {
    if (!group.current) return;
    group.current.getWorldPosition(tmp);
    const close = camera.position.distanceTo(tmp) < cell * NEAR;
    if (close !== near) setNear(close);
  });

  return (
    <group ref={group} position={position}>
      {/* twin pylons and a dark bezel, facing south like the BSS boards */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 + cell * 0.01), (lift + h) / 2, -cell * 0.004]}>
          <boxGeometry args={[cell * 0.012, lift + h, cell * 0.012]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, lift + h / 2, -cell * 0.004]}>
        <boxGeometry args={[w + cell * 0.02, h + cell * 0.02, cell * 0.006]} />
        <meshStandardMaterial color="#0b0b0b" emissive="#f7931a" emissiveIntensity={0.08} />
      </mesh>
      {/* distanceFactor 400 makes drei's transform 1 CSS px = 1 local unit, so 640px spans exactly w */}
      <SafeHtml transform distanceFactor={400} position={[0, lift + h / 2, cell * 0.001]} scale={w / 640} zIndexRange={[10, 0]}>
        <div style={{ width: 640, height: 360, background: "#000" }}>
          {near ? (
            <iframe
              src={`https://${height}.bitmap.stream/player-embed`}
              title={`${height}.bitmap live channel`}
              width={640}
              height={360}
              style={{ border: 0, display: "block" }}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <div style={{ color: "#7fe7ff", font: "12px monospace", padding: 16 }}>● {height}.BITMAP · WALK CLOSER TO TUNE IN</div>
          )}
        </div>
      </SafeHtml>
    </group>
  );
}
