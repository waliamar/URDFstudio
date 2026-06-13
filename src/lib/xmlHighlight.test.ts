import { describe, expect, it } from "vitest";
import { tokenizeXml } from "./xmlHighlight";

describe("tokenizeXml", () => {
  it("tokenizes an opening tag with an attribute", () => {
    expect(tokenizeXml(`<link name="base">`)).toEqual([
      { type: "punct", value: "<" },
      { type: "tag", value: "link" },
      { type: "text", value: " " },
      { type: "attr", value: "name" },
      { type: "punct", value: "=" },
      { type: "string", value: `"base"` },
      { type: "punct", value: ">" },
    ]);
  });

  it("tokenizes a closing tag", () => {
    expect(tokenizeXml(`</robot>`)).toEqual([
      { type: "punct", value: "</" },
      { type: "tag", value: "robot" },
      { type: "punct", value: ">" },
    ]);
  });

  it("tokenizes a self-closing tag with a multi-value attribute", () => {
    expect(tokenizeXml(`<axis xyz="0 0 1"/>`)).toEqual([
      { type: "punct", value: "<" },
      { type: "tag", value: "axis" },
      { type: "text", value: " " },
      { type: "attr", value: "xyz" },
      { type: "punct", value: "=" },
      { type: "string", value: `"0 0 1"` },
      { type: "punct", value: "/>" },
    ]);
  });

  it("tokenizes a leading-indented comment", () => {
    expect(tokenizeXml(`  <!-- note -->`)).toEqual([
      { type: "text", value: "  " },
      { type: "comment", value: "<!-- note -->" },
    ]);
  });

  it("keeps a xacro substitution inside the attribute string", () => {
    const toks = tokenizeXml(`<link name="\${prefix}base"/>`);
    expect(toks).toContainEqual({ type: "string", value: `"\${prefix}base"` });
  });

  it("namespaced element tag is one tag token", () => {
    const toks = tokenizeXml(`<xacro:macro name="wheel">`);
    expect(toks[0]).toEqual({ type: "punct", value: "<" });
    expect(toks[1]).toEqual({ type: "tag", value: "xacro:macro" });
  });

  it("returns no tokens for an empty line", () => {
    expect(tokenizeXml("")).toEqual([]);
  });

  // Invariant: concatenating token values reproduces the input exactly.
  it.each([
    `<link name="base">`,
    `</robot>`,
    `<axis xyz="0 0 1"/>`,
    `  <!-- note -->`,
    `    <origin xyz="0 0 0.1" rpy="0 0 0"/>`,
    `plain text content 123`,
  ])("reconstructs the line %j losslessly", (line) => {
    expect(tokenizeXml(line).map((t) => t.value).join("")).toBe(line);
  });
});
