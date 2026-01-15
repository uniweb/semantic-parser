import { getRoleFromNode, isValidRole } from "../../src/utils/role.js";

describe("role utilities", () => {
  test("extracts role from node attributes", () => {
    const node = {
      type: "image",
      attrs: { role: "background" },
    };
    expect(getRoleFromNode(node)).toBe("background");
  });

  test("extracts role from marks", () => {
    const node = {
      type: "text",
      marks: [{ type: "role", attrs: { value: "button-primary" } }],
    };
    expect(getRoleFromNode(node)).toBe("button-primary");
  });

  test("provides default role based on type", () => {
    const node = { type: "image" };
    expect(getRoleFromNode(node)).toBe("content");
  });

  test("validates roles", () => {
    expect(isValidRole("image", "background")).toBe(true);
    expect(isValidRole("image", "invalid-role")).toBe(false);
    expect(isValidRole("link", "button-primary")).toBe(true);
    expect(isValidRole("unknown-type", "any-role")).toBe(false);
  });
});
