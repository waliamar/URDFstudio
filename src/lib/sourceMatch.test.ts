import { describe, expect, it } from "vitest";
import { findElementLocation } from "./sourceMatch";

const f = (text: string) => ({ text });

describe("findElementLocation", () => {
  it("matches a literal name on its defining line", () => {
    const files = [f(`<robot>\n  <link name="base_link"/>\n  <link name="arm"/>\n</robot>`)];
    expect(findElementLocation(files, "link", "arm")).toEqual({ fileIndex: 0, lineIndex: 2 });
  });

  it("matches a ${prefix}-templated source name against the expanded name", () => {
    const files = [f(`<robot>\n  <link name="\${prefix}base_link"/>\n</robot>`)];
    expect(findElementLocation(files, "link", "ur16e_base_link")).toEqual({ fileIndex: 0, lineIndex: 1 });
  });

  it("matches a $(arg ...)-templated source name", () => {
    const files = [f(`<joint name="$(arg tf_prefix)shoulder" type="revolute">`)];
    expect(findElementLocation(files, "joint", "robot_shoulder")).toEqual({ fileIndex: 0, lineIndex: 0 });
  });

  it("does not cross-match a link when a joint is selected", () => {
    const files = [f(`<link name="wheel"/>\n<joint name="wheel" type="fixed"/>`)];
    expect(findElementLocation(files, "joint", "wheel")).toEqual({ fileIndex: 0, lineIndex: 1 });
  });

  it("prefers an exact match over a normalized one", () => {
    const files = [
      f(`<link name="\${prefix}arm"/>\n<link name="arm"/>`),
    ];
    expect(findElementLocation(files, "link", "arm")).toEqual({ fileIndex: 0, lineIndex: 1 });
  });

  it("finds the match in a later file", () => {
    const files = [f(`<robot>\n</robot>`), f(`<link name="head"/>`)];
    expect(findElementLocation(files, "link", "head")).toEqual({ fileIndex: 1, lineIndex: 0 });
  });

  it("returns null when the name only exists as a full substitution", () => {
    const files = [f(`<link name="\${link_name}"/>`)];
    expect(findElementLocation(files, "link", "base_link")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    const files = [f(`<link name="base_link"/>`)];
    expect(findElementLocation(files, "joint", "base_link")).toBeNull();
  });

  it("ignores a same-named xacro:macro and finds the real element", () => {
    const files = [f(`<xacro:macro name="arm">\n  <link name="arm"/>\n</xacro:macro>`)];
    expect(findElementLocation(files, "link", "arm")).toEqual({ fileIndex: 0, lineIndex: 1 });
  });
});
