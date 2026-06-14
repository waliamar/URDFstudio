import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { rpyToEuler, radToDeg, degToRad, eulerToRpy } from "./transforms";

describe("rpyToEuler", () => {
  it("rotates +X to +Y for rpy [0,0,pi/2]", () => {
    const euler = rpyToEuler([0, 0, Math.PI / 2]);
    const v = new THREE.Vector3(1, 0, 0).applyEuler(euler);
    expect(v.x).toBeCloseTo(0, 6);
    expect(v.y).toBeCloseTo(1, 6);
    expect(v.z).toBeCloseTo(0, 6);
  });

  it("uses ZYX order (extrinsic XYZ fixed-axis)", () => {
    const euler = rpyToEuler([0.1, 0.2, 0.3]);
    expect(euler.order).toBe("ZYX");
    expect(euler.x).toBeCloseTo(0.1);
    expect(euler.y).toBeCloseTo(0.2);
    expect(euler.z).toBeCloseTo(0.3);
  });

  it("identity for zero rpy", () => {
    const v = new THREE.Vector3(1, 2, 3).applyEuler(rpyToEuler([0, 0, 0]));
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(2);
    expect(v.z).toBeCloseTo(3);
  });
});

describe("deg/rad helpers", () => {
  it("converts both ways", () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180);
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
});

describe("eulerToRpy", () => {
  const cases: [number, number, number][] = [
    [0, 0, 0],
    [0.1, -0.2, 0.3],
    [Math.PI / 4, Math.PI / 3, -Math.PI / 6],
    [2.0, -1.8, 2.5], // angles past ±π/2
  ];

  it("round-trips with rpyToEuler", () => {
    for (const rpy of cases) {
      const back = eulerToRpy(rpyToEuler(rpy));
      back.forEach((v, i) => expect(v).toBeCloseTo(rpy[i], 6));
    }
  });

  it("converts an arbitrary-order euler while preserving orientation", () => {
    const e = new THREE.Euler(0.3, -0.7, 1.1, "XYZ");
    const rpy = eulerToRpy(e);
    const q1 = new THREE.Quaternion().setFromEuler(e);
    const q2 = new THREE.Quaternion().setFromEuler(rpyToEuler(rpy));
    expect(q1.angleTo(q2)).toBeCloseTo(0, 6);
  });
});
