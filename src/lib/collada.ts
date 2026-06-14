// src/lib/collada.ts
// Helpers for fitting loaded Collada (.dae) assets into URDF Studio's frame.
import type * as THREE from "three";

/**
 * Cancel the up-axis rotation three.js' ColladaLoader bakes onto a scene root.
 *
 * For an asset declaring `<up_axis>Z_UP</up_axis>`, ColladaLoader sets
 * `scene.rotation = (-PI/2, 0, 0)` to reach three.js' Y-up convention, while
 * leaving the vertex data in Z-up. URDF Studio already converts Z-up -> Y-up
 * once, globally (see Viewport), and URDF link/visual/joint origins plus the DAE
 * vertices all live in the same URDF Z-up frame. So the loader's extra rotation
 * is spurious and rotates each link's mesh out of alignment.
 *
 * The scene root's rotation is only ever set by that up-axis logic (legitimate
 * node transforms live on children), so zeroing it is correct for both Z_UP
 * (removes the bogus -90deg) and Y_UP (already identity).
 */
export function neutralizeColladaUpAxis(object: THREE.Object3D): void {
  object.rotation.set(0, 0, 0);
}
