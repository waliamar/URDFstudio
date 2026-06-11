import { describe, it, expect } from "vitest";
import { dirname, isAbsolutePath } from "./paths";

describe("dirname", () => {
  it("returns the directory for a POSIX path", () => {
    expect(dirname("/home/user/robot.urdf")).toBe("/home/user");
  });

  it("returns the directory for a Windows path", () => {
    expect(dirname("C:\\robots\\my_robot\\robot.urdf")).toBe("C:\\robots\\my_robot");
  });

  it("returns the directory for a mixed-separator path", () => {
    expect(dirname("C:\\robots/my_robot/robot.urdf")).toBe("C:\\robots/my_robot");
  });

  it("returns an empty string when there is no directory component", () => {
    expect(dirname("robot.urdf")).toBe("");
  });
});

describe("isAbsolutePath", () => {
  it("treats POSIX-rooted paths as absolute", () => {
    expect(isAbsolutePath("/home/user/mesh.stl")).toBe(true);
  });

  it("treats Windows drive paths as absolute", () => {
    expect(isAbsolutePath("C:\\meshes\\part.stl")).toBe(true);
    expect(isAbsolutePath("C:/meshes/part.stl")).toBe(true);
  });

  it("treats relative and package paths as non-absolute", () => {
    expect(isAbsolutePath("meshes/part.stl")).toBe(false);
    expect(isAbsolutePath("package://my_pkg/meshes/part.stl")).toBe(false);
    expect(isAbsolutePath("../meshes/part.stl")).toBe(false);
  });
});
