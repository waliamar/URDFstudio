import { describe, it, expect, beforeEach } from "vitest";
import { useRobotStore } from "./robotStore";
import type { Robot } from "../types/robot";

const pose = { xyz: [0, 0, 0] as [number, number, number], rpy: [0, 0, 0] as [number, number, number] };

function makeRobot(): Robot {
  return {
    name: "r",
    materials: [{ name: "red", color: [1, 0, 0, 1] }],
    links: [{ name: "base" }, { name: "arm" }, { name: "hand" }],
    joints: [
      { name: "j1", jointType: "revolute", parent: "base", child: "arm", origin: pose },
      { name: "j2", jointType: "fixed", parent: "arm", child: "hand", origin: pose },
    ],
  };
}

beforeEach(() => {
  useRobotStore.getState().setRobot(makeRobot());
});

const s = () => useRobotStore.getState();

describe("setRobot", () => {
  it("loads robot, resets dirty, clears history", () => {
    expect(s().robot?.name).toBe("r");
    expect(s().dirty).toBe(false);
    expect(useRobotStore.temporal.getState().pastStates).toHaveLength(0);
  });
});

describe("updateLink / updateJoint", () => {
  it("patches a link and sets dirty", () => {
    s().updateLink("arm", { name: "arm" });
    expect(s().dirty).toBe(true);
  });

  it("updates joint fields", () => {
    s().updateJoint("j1", { jointType: "prismatic" });
    expect(s().robot?.joints.find((j) => j.name === "j1")?.jointType).toBe("prismatic");
  });
});

describe("renameLink", () => {
  it("rewrites joint parent/child refs", () => {
    s().renameLink("arm", "elbow");
    const r = s().robot!;
    expect(r.links.some((l) => l.name === "elbow")).toBe(true);
    expect(r.joints.find((j) => j.name === "j1")?.child).toBe("elbow");
    expect(r.joints.find((j) => j.name === "j2")?.parent).toBe("elbow");
  });
});

describe("renameJoint", () => {
  it("renames the joint", () => {
    s().renameJoint("j1", "shoulder");
    expect(s().robot?.joints.some((j) => j.name === "shoulder")).toBe(true);
  });
});

describe("deleteLink cascade", () => {
  it("removes joints referencing the deleted link", () => {
    s().deleteLink("arm");
    const r = s().robot!;
    expect(r.links.some((l) => l.name === "arm")).toBe(false);
    // both j1 (child=arm) and j2 (parent=arm) gone
    expect(r.joints).toHaveLength(0);
  });

  it("jointsReferencing reports affected joints", () => {
    expect(s().jointsReferencing("arm").sort()).toEqual(["j1", "j2"]);
    expect(s().jointsReferencing("base")).toEqual(["j1"]);
  });
});

describe("add / delete joint", () => {
  it("adds a joint", () => {
    s().addJoint({ name: "j3", jointType: "fixed", parent: "base", child: "hand", origin: pose });
    expect(s().robot?.joints).toHaveLength(3);
  });
  it("deletes a joint", () => {
    s().deleteJoint("j1");
    expect(s().robot?.joints.some((j) => j.name === "j1")).toBe(false);
  });
});

describe("upsertMaterial", () => {
  it("adds a new material", () => {
    s().upsertMaterial({ name: "blue", color: [0, 0, 1, 1] });
    expect(s().robot?.materials.some((m) => m.name === "blue")).toBe(true);
  });
  it("updates an existing material in place", () => {
    s().upsertMaterial({ name: "red", color: [0.5, 0, 0, 1] });
    const mats = s().robot!.materials.filter((m) => m.name === "red");
    expect(mats).toHaveLength(1);
    expect(mats[0].color).toEqual([0.5, 0, 0, 1]);
  });
});

describe("interaction coalescing", () => {
  const sample = {
    name: "r",
    links: [{ name: "a" }],
    joints: [],
    materials: [],
  };

  it("collapses many updates between begin/endInteraction into one undo entry", () => {
    const s = useRobotStore.getState();
    s.setRobot(structuredClone(sample)); // clears history
    const temporal = useRobotStore.temporal.getState();
    expect(temporal.pastStates.length).toBe(0);

    s.beginInteraction();
    s.updateLink("a", { name: "a" }); // no-op-shaped but new object
    useRobotStore.getState().updateLink("a", { name: "a" });
    useRobotStore.getState().updateLink("a", { name: "a" });
    useRobotStore.getState().endInteraction();

    expect(useRobotStore.temporal.getState().pastStates.length).toBe(1);
  });

  it("adds no history entry if nothing changed during the interaction", () => {
    const s = useRobotStore.getState();
    s.setRobot(structuredClone(sample));
    s.beginInteraction();
    s.endInteraction();
    expect(useRobotStore.temporal.getState().pastStates.length).toBe(0);
  });
});

describe("undo / redo via temporal", () => {
  it("undoes and redoes a mutation", () => {
    s().updateJoint("j1", { jointType: "prismatic" });
    expect(s().robot?.joints[0].jointType).toBe("prismatic");

    useRobotStore.temporal.getState().undo();
    expect(s().robot?.joints[0].jointType).toBe("revolute");

    useRobotStore.temporal.getState().redo();
    expect(s().robot?.joints[0].jointType).toBe("prismatic");
  });

  it("setRobot clears history so undo cannot revert load", () => {
    s().updateJoint("j1", { jointType: "prismatic" });
    s().setRobot(makeRobot());
    expect(useRobotStore.temporal.getState().pastStates).toHaveLength(0);
    useRobotStore.temporal.getState().undo();
    expect(s().robot?.joints[0].jointType).toBe("revolute");
  });
});
