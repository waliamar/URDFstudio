// src/lib/gizmo.ts
// Maps a dragged scene object's LOCAL transform onto a URDF origin. The link's
// local transform (relative to its parent group) equals the joint origin that
// places it, so this is a direct read-back.
import * as THREE from "three";
import { eulerToRpy } from "./transforms";

export interface Origin {
  xyz: [number, number, number];
  rpy: [number, number, number];
}

export function originFromLocal(position: THREE.Vector3, rotation: THREE.Euler): Origin {
  return {
    xyz: [position.x, position.y, position.z],
    rpy: eulerToRpy(rotation),
  };
}
