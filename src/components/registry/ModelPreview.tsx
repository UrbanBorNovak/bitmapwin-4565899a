import { Bounds, Center, OrbitControls, useGLTF } from "@react-three/drei";
import { SafeCanvas } from "@/components/game/SafeCanvas";

function Model({ inscription }: { inscription: string }) {
  const gltf = useGLTF(`https://ordinals.com/content/${inscription}`);
  return <primitive object={gltf.scene} />;
}

export default function ModelPreview({ inscription }: { inscription: string }) {
  return (
    <SafeCanvas camera={{ position: [3, 2, 3], fov: 40 }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 3]} intensity={1.4} />
      <Bounds fit clip observe margin={1.2}>
        <Center><Model inscription={inscription} /></Center>
      </Bounds>
      <OrbitControls makeDefault autoRotate autoRotateSpeed={1.5} />
    </SafeCanvas>
  );
}
