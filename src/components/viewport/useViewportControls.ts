// src/components/viewport/useViewportControls.ts
import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useSelectionStore } from "../../state/selectionStore";

/** Unity Scene-view navigation: plain LMB stays free for selection; Alt+LMB
 *  orbits; MMB pans; RMB/scroll zoom; F frames the selected link. */
export function useViewportControls(
  controls: React.RefObject<OrbitControlsImpl | null>,
) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const c = controls.current;
    if (c) c.enableRotate = false; // orbit only while Alt is held

    const frameSelected = () => {
      const sel = useSelectionStore.getState().selected;
      const cc = controls.current;
      if (!sel || !cc) return;
      const obj = scene.getObjectByName(`link:${sel.name}`);
      if (!obj) return;
      const pos = new THREE.Vector3();
      obj.getWorldPosition(pos);
      const offset = camera.position.clone().sub(cc.target);
      cc.target.copy(pos);
      camera.position.copy(pos.clone().add(offset));
      cc.update();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault(); // don't focus the browser menu bar
        const cc = controls.current;
        if (cc) cc.enableRotate = true;
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!typing && (e.key === "f" || e.key === "F")) frameSelected();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        const cc = controls.current;
        if (cc) cc.enableRotate = false;
      }
    };
    const onBlur = () => {
      const cc = controls.current;
      if (cc) cc.enableRotate = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [scene, camera, controls]);
}
