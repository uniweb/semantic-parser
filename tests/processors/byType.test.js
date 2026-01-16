import { processByType } from "../../src/processors/byType.js";
import { processSequence } from "../../src/processors/sequence.js";
import { mixedContent } from "../fixtures/complex.js";

describe("processByType", () => {
  test("organizes content by type with context", () => {
    const sequence = processSequence(mixedContent);
    const result = processByType(sequence);

    // Check headings collection
    expect(result.headings).toHaveLength(2);
    expect(result.headings[0].level).toBe(3);
    expect(result.headings[1].level).toBe(1);

    // Check images with roles
    expect(result.images.background).toHaveLength(1);
    expect(result.images.background[0].role).toBe("background");

    // Check metadata
    expect(result.metadata.hasMedia).toBe(true);
    expect(result.metadata.totalElements).toBe(sequence.length);
  });

  test("provides working helper methods", () => {
    const sequence = processSequence(mixedContent);
    const result = processByType(sequence);

    // Test getHeadingsByLevel
    const h1s = result.getHeadingsByLevel(1);
    expect(h1s).toHaveLength(1);
    expect(h1s[0].text).toBe("Platform");

    // Test getElementsByHeadingContext
    const elementsUnderH1 = result.getElementsByHeadingContext(
      (heading) => heading.level === 1
    );
    expect(elementsUnderH1.length).toBeGreaterThan(0);
  });

  test("correctly determines dominant type", () => {
    const sequence = [
      { type: "heading", content: "H1" },
      { type: "paragraph", content: "P1" },
      { type: "paragraph", content: "P2" },
      { type: "paragraph", content: "P3" },
    ];

    const result = processByType(sequence);
    expect(result.metadata.dominantType).toBe("paragraph");
  });

  test("handles unknown element types", () => {
    const sequence = [
      { type: "heading", content: "Title" },
      { type: "custom-block", content: "Custom content" },
    ];

    const result = processByType(sequence);
    expect(result.headings).toHaveLength(1);
    // Unknown types should not break the processor
    expect(result.metadata.totalElements).toBe(2);
  });
});
