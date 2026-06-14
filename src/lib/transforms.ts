// src/lib/transforms.ts
// URDF orientation is given as rpy = extrinsic X-Y-Z fixed-axis rotation,
// which is identical to an intrinsic Z-Y'-X'' rotation. In three.js that is
// a THREE.Euler with order "ZYX" and components (roll, pitch, yaw).
import * as THREE from "three";

export function rpyToEuler(rpy: [number, number, number]): THREE.Euler {
  const [roll, pitch, yaw] = rpy;
  return new THREE.Euler(roll, pitch, yaw, "ZYX");
}

/** Inverse of rpyToEuler: a three.js Euler -> URDF rpy = [roll, pitch, yaw].
 *  Reorders to "ZYX" first so the components line up with URDF's fixed-axis
 *  X-Y-Z convention, preserving the orientation. */
export function eulerToRpy(euler: THREE.Euler): [number, number, number] {
  const e = euler.clone();
  if (e.order !== "ZYX") e.reorder("ZYX");
  return [e.x, e.y, e.z];
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
