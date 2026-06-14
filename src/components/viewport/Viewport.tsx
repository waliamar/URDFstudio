// src/components/viewport/Viewport.tsx
import { useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useSelectionStore } from "../../state/selectionStore";
import { RobotModel } from "./RobotModel";
import { TransformGizmo } from "./TransformGizmo";
import { useViewportControls } from "./useViewportControls";

/** OrbitControls remapped to a Unity Scene-view subset, plus the corner axis
 *  gizmo. Lives inside <Canvas> so it can use the r3f hooks. */
function ViewportControls() {
  const controls = useRef<OrbitControlsImpl>(null);
  useViewportControls(controls);
  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.DOLLY,
        }}
      />
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport
          axisColors={["#e0566a", "#7bd47b", "#5a8bf0"]}
          labelColor="#15171a"
        />
      </GizmoHelper>
    </>
  );
}

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

      <TransformGizmo />
      <ViewportControls />
    </Canvas>
  );
}
