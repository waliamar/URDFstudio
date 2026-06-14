import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { neutralizeColladaUpAxis } from "./collada";

describe("neutralizeColladaUpAxis", () => {
  it("clears the -90° X rotation ColladaLoader injects for Z_UP assets", () => {
    // Simulate what three's ColladaLoader does to a Z_UP scene root.
    const scene = new THREE.Object3D();
    scene.rotation.set(-Math.PI / 2, 0, 0);

    neutralizeColladaUpAxis(scene);

    expect(scene.rotation.x).toBe(0);
    expect(scene.rotation.y).toBe(0);
    expect(scene.rotation.z).toBe(0);
  });

  it("leaves an already-identity (Y_UP) scene root untouched", () => {
    const scene = new THREE.Object3D();
    neutralizeColladaUpAxis(scene);

    expect(scene.rotation.x).toBe(0);
    expect(scene.rotation.y).toBe(0);
    expect(scene.rotation.z).toBe(0);
  });

  it("does not disturb child node transforms (legitimate mesh authoring)", () => {
    const scene = new THREE.Object3D();
    scene.rotation.set(-Math.PI / 2, 0, 0);
    const child = new THREE.Object3D();
    child.position.set(1, 2, 3);
    child.rotation.set(0.1, 0.2, 0.3);
    scene.add(child);

    neutralizeColladaUpAxis(scene);

    expect(child.position.toArray()).toEqual([1, 2, 3]);
    expect(child.rotation.x).toBeCloseTo(0.1);
    expect(child.rotation.y).toBeCloseTo(0.2);
    expect(child.rotation.z).toBeCloseTo(0.3);
  });
});
