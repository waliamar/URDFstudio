import { describe, it, expect } from "vitest";
import { buildTree } from "./kinematics";
import type { Robot } from "../types/robot";

const pose = { xyz: [0, 0, 0] as [number, number, number], rpy: [0, 0, 0] as [number, number, number] };

function robot(partial: Partial<Robot>): Robot {
  return { name: "r", links: [], joints: [], materials: [], ...partial };
}

describe("buildTree", () => {
  it("builds a single chain with one root", () => {
    const r = robot({
      links: [{ name: "a" }, { name: "b" }, { name: "c" }],
      joints: [
        { name: "j1", jointType: "fixed", parent: "a", child: "b", origin: pose },
        { name: "j2", jointType: "fixed", parent: "b", child: "c", origin: pose },
      ],
    });
    const { roots } = buildTree(r);
    expect(roots).toHaveLength(1);
    expect(roots[0].link.name).toBe("a");
    expect(roots[0].children[0].joint.name).toBe("j1");
    expect(roots[0].children[0].node.link.name).toBe("b");
    expect(roots[0].children[0].node.children[0].node.link.name).toBe("c");
  });

  it("makes an orphan link an extra root", () => {
    const r = robot({
      links: [{ name: "a" }, { name: "b" }, { name: "orphan" }],
      joints: [{ name: "j1", jointType: "fixed", parent: "a", child: "b", origin: pose }],
    });
    const { roots } = buildTree(r);
    const rootNames = roots.map((n) => n.link.name).sort();
    expect(rootNames).toEqual(["a", "orphan"]);
  });

  it("skips joints with dangling parent or child refs", () => {
    const r = robot({
      links: [{ name: "a" }, { name: "b" }],
      joints: [
        { name: "good", jointType: "fixed", parent: "a", child: "b", origin: pose },
        { name: "bad", jointType: "fixed", parent: "a", child: "ghost", origin: pose },
      ],
    });
    const { roots } = buildTree(r);
    expect(roots).toHaveLength(1);
    expect(roots[0].children).toHaveLength(1);
    expect(roots[0].children[0].joint.name).toBe("good");
  });

  it("breaks cycles without infinite recursion", () => {
    const r = robot({
      links: [{ name: "a" }, { name: "b" }],
      joints: [
        { name: "j1", jointType: "fixed", parent: "a", child: "b", origin: pose },
        { name: "j2", jointType: "fixed", parent: "b", child: "a", origin: pose },
      ],
    });
    const { roots } = buildTree(r);
    // No node visited twice; at least one root produced.
    expect(roots.length).toBeGreaterThanOrEqual(1);
  });

  it("handles multiple roots (forest)", () => {
    const r = robot({
      links: [{ name: "a" }, { name: "b" }, { name: "x" }, { name: "y" }],
      joints: [
        { name: "j1", jointType: "fixed", parent: "a", child: "b", origin: pose },
        { name: "j2", jointType: "fixed", parent: "x", child: "y", origin: pose },
      ],
    });
    const { roots } = buildTree(r);
    expect(roots.map((n) => n.link.name).sort()).toEqual(["a", "x"]);
  });
});
