import { processSequence } from "../../src/processors/sequence.js";

describe("processSequence", () => {
  test("processes basic document structure", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Content" }],
        },
      ],
    };

    const result = processSequence(doc);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      type: "heading",
      level: 1,
      text: "Title",
      children: [],
      attrs: { level: 1 }
    });
    expect(result[1]).toEqual({
      type: "paragraph",
      text: "Content",
      children: [],
      attrs: undefined,
    });
  });

  test("handles text marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Normal " },
            {
              type: "text",
              marks: [{ type: "bold" }],
              text: "bold",
            },
          ],
        },
      ],
    };

    const result = processSequence(doc);
    expect(result[0].text).toBe("Normal <strong>bold</strong>");
  });

  test("processes nested lists", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Item 1" }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = processSequence(doc);
    expect(result[0].type).toBe("list");
    expect(result[0].style).toBe("bullet");
  });

  test("preserves image attributes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            src: "test.jpg",
            alt: "Test",
            role: "background",
          },
        },
      ],
    };

    const result = processSequence(doc);
    expect(result[0]).toEqual({
      type: "image",
      src: "test.jpg",
      alt: "Test",
      role: "background",
    });
  });
});
