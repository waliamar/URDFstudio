import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { originFromLocal } from "./gizmo";
import { rpyToEuler } from "./transforms";

describe("originFromLocal", () => {
  it("reads a local position + rotation into a URDF origin", () => {
    const pos = new THREE.Vector3(0.1, -0.2, 0.3);
    const rot = rpyToEuler([0.2, 0.4, -0.1]);
    const origin = originFromLocal(pos, rot);
    expect(origin.xyz[0]).toBeCloseTo(0.1, 6);
    expect(origin.xyz[1]).toBeCloseTo(-0.2, 6);
    expect(origin.xyz[2]).toBeCloseTo(0.3, 6);
    origin.rpy.forEach((v, i) => expect(v).toBeCloseTo([0.2, 0.4, -0.1][i], 6));
  });
});
