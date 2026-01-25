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
      attrs: {
        src: "test.jpg",
        alt: "Test",
        role: "background",
      },
    });
  });

  describe("link detection", () => {
    test("detects single link paragraph", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click here",
                marks: [{ type: "link", attrs: { href: "/about" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.href).toBe("/about");
      expect(result[0].attrs.label).toBe("Click here");
      expect(result[0].attrs.iconBefore).toBeNull();
      expect(result[0].attrs.iconAfter).toBeNull();
    });

    test("single link with icon before", () => {
      // Common pattern: [Icon] Link Text
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>home</svg>", size: 16 },
              },
              {
                type: "text",
                text: "Home",
                marks: [{ type: "link", attrs: { href: "/" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.href).toBe("/");
      expect(result[0].attrs.label).toBe("Home");
      expect(result[0].attrs.iconBefore).toMatchObject({ svg: "<svg>home</svg>", size: 16 });
      expect(result[0].attrs.iconAfter).toBeNull();
      // Children also available for advanced rendering
      expect(result[0].attrs.children.some(c => c.type === "icon")).toBe(true);
    });

    test("single link with icon after", () => {
      // Pattern: Link Text [External Icon]
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "External Link",
                marks: [{ type: "link", attrs: { href: "https://example.com" } }],
              },
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>external</svg>" },
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.iconBefore).toBeNull();
      expect(result[0].attrs.iconAfter).toMatchObject({ svg: "<svg>external</svg>" });
    });

    test("single link with icons before and after", () => {
      // Pattern: [Icon] Link Text [Icon]
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>star</svg>" },
              },
              {
                type: "text",
                text: "Featured",
                marks: [{ type: "link", attrs: { href: "/featured" } }],
              },
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>arrow</svg>" },
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.iconBefore).toMatchObject({ svg: "<svg>star</svg>" });
      expect(result[0].attrs.iconAfter).toMatchObject({ svg: "<svg>arrow</svg>" });
    });

    test("detects multiple links paragraph and splits them", () => {
      // Common pattern: links on consecutive lines (no blank line)
      // become one paragraph in markdown, but should split into separate links
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Home",
                marks: [{ type: "link", attrs: { href: "/" } }],
              },
              {
                type: "text",
                text: "About",
                marks: [{ type: "link", attrs: { href: "/about" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("link");
      expect(result[0].attrs.label).toBe("Home");
      expect(result[0].attrs.href).toBe("/");
      expect(result[1].type).toBe("link");
      expect(result[1].attrs.label).toBe("About");
      expect(result[1].attrs.href).toBe("/about");
    });

    test("multiple links with icons - icons not associated with links", () => {
      // Icons in multi-link paragraphs are not associated with specific links
      // They go to body.icons separately when processed through groups
      const doc = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>home</svg>" },
              },
              {
                type: "text",
                text: "Home",
                marks: [{ type: "link", attrs: { href: "/" } }],
              },
              {
                type: "UniwebIcon",
                attrs: { svg: "<svg>about</svg>" },
              },
              {
                type: "text",
                text: "About",
                marks: [{ type: "link", attrs: { href: "/about" } }],
              },
            ],
          },
        ],
      };

      const result = processSequence(doc);
      expect(result).toHaveLength(2);
      // Links extracted without icon association
      expect(result[0].attrs.label).toBe("Home");
      expect(result[0].attrs.href).toBe("/");
      expect(result[1].attrs.label).toBe("About");
      expect(result[1].attrs.href).toBe("/about");
    });
  });

  describe("clickable icons", () => {
    test("icon with href becomes clickable icon", () => {
      // Icons can have href/target for icon-only links (e.g., social media buttons)
      const doc = {
        type: "doc",
        content: [
          {
            type: "UniwebIcon",
            attrs: {
              svg: "<svg>twitter</svg>",
              href: "https://twitter.com/example",
              target: "_blank",
            },
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("icon");
      expect(result[0].attrs.svg).toBe("<svg>twitter</svg>");
      expect(result[0].attrs.href).toBe("https://twitter.com/example");
      expect(result[0].attrs.target).toBe("_blank");
    });

    test("icon without href has no link attributes", () => {
      const doc = {
        type: "doc",
        content: [
          {
            type: "UniwebIcon",
            attrs: { svg: "<svg>decorative</svg>", size: 24 },
          },
        ],
      };

      const result = processSequence(doc);
      expect(result[0].type).toBe("icon");
      expect(result[0].attrs.svg).toBe("<svg>decorative</svg>");
      expect(result[0].attrs.href).toBeUndefined();
      expect(result[0].attrs.target).toBeUndefined();
    });
  });
});
