// src/components/viewport/Viewport.tsx
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useSelectionStore } from "../../state/selectionStore";
import { RobotModel } from "./RobotModel";

export function Viewport() {
  const clear = useSelectionStore((s) => s.clear);

  return (
    <Canvas
      camera={{ position: [1.2, 1.2, 1.2], fov: 50, near: 0.01, far: 100 }}
      onPointerMissed={() => clear()}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={1.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />

      <Grid
        infiniteGrid
        cellSize={0.1}
        sectionSize={1}
        fadeDistance={20}
        cellColor="#404040"
        sectionColor="#606060"
      />

      {/* Map URDF Z-up into three.js Y-up. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <RobotModel />
      </group>

      <OrbitControls makeDefault enableDamping />
    </Canvas>
  );
}
