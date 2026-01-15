import { jest } from '@jest/globals';
import { parseContent } from "../../src/index.js";
import * as accessor from "../../src/mappers/accessor.js";

describe("Type System Integration", () => {
  const mockDoc = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "NEW" }]
      },
      {
        type: "heading",
        attrs: { level: 1 },
        content: [
          { type: "text", text: "Welcome to " },
          {
            type: "text",
            marks: [{ type: "bold" }],
            text: "Our Platform"
          }
        ]
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Get started today" }]
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "This is a long introductory paragraph with " },
          { type: "text", marks: [{ type: "em" }], text: "formatting" },
          { type: "text", text: " that explains our platform in detail. It has multiple sentences and should be truncated when creating an excerpt." }
        ]
      }
    ]
  };

  let parsed;

  beforeEach(() => {
    parsed = parseContent(mockDoc);
  });

  describe("Visual Editor Mode (Default)", () => {
    test("strips markup automatically for plaintext fields", () => {
      const schema = {
        title: {
          path: "groups.main.header.title",
          type: "plaintext"
        }
      };

      const result = accessor.extractBySchema(parsed, schema);

      // Should strip <strong> tags
      expect(result.title).toBe("Welcome to Our Platform");
      expect(result.title).not.toContain("<strong>");
    });

    test("truncates text automatically with maxLength", () => {
      const schema = {
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 20
        }
      };

      const result = accessor.extractBySchema(parsed, schema);

      expect(result.title.length).toBeLessThanOrEqual(23); // 20 + "..."
    });

    test("creates excerpts from paragraphs", () => {
      const schema = {
        excerpt: {
          path: "groups.main.body.paragraphs",
          type: "excerpt",
          maxLength: 50
        }
      };

      const result = accessor.extractBySchema(parsed, schema);

      expect(result.excerpt.length).toBeLessThanOrEqual(53);
      expect(result.excerpt).not.toContain("<em>");
    });

    test("preserves richtext formatting", () => {
      const schema = {
        description: {
          path: "groups.main.body.paragraphs[0]",
          type: "richtext"
        }
      };

      const result = accessor.extractBySchema(parsed, schema);

      // Should keep the text content (richtext type sanitizes but preserves safe HTML)
      expect(result.description).toContain("introductory paragraph");
      expect(result.description.length).toBeGreaterThan(0);
      // Rich text type should not strip everything like plaintext would
      expect(result.description).toBeTruthy();
    });

    test("handles empty strings with treatEmptyAsDefault", () => {
      const testParsed = {
        groups: {
          main: {
            header: { subtitle: "" }
          }
        }
      };

      const schema = {
        subtitle: {
          path: "groups.main.header.subtitle",
          type: "plaintext",
          defaultValue: "No subtitle",
          treatEmptyAsDefault: true
        }
      };

      const result = accessor.extractBySchema(testParsed, schema);

      expect(result.subtitle).toBe("No subtitle");
    });

    test("combines multiple types in one schema", () => {
      const schema = {
        kicker: {
          path: "groups.main.header.pretitle",
          type: "plaintext",
          transform: (text) => text.toUpperCase()
        },
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 30
        },
        subtitle: {
          path: "groups.main.header.subtitle",
          type: "plaintext"
        },
        excerpt: {
          path: "groups.main.body.paragraphs",
          type: "excerpt",
          maxLength: 100
        }
      };

      const result = accessor.extractBySchema(parsed, schema);

      expect(result.kicker).toBe("NEW");
      expect(result.title).toBe("Welcome to Our Platform");
      expect(result.subtitle).toBe("Get started today");
      expect(result.excerpt.length).toBeLessThanOrEqual(103);
    });
  });

  describe("Build Mode", () => {
    test("logs warnings for content issues", () => {
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      const schema = {
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 10  // Intentionally too short
        }
      };

      accessor.extractBySchema(parsed, schema, { mode: 'build' });

      expect(consoleWarn).toHaveBeenCalled();
      const warnings = consoleWarn.mock.calls.flat().join(' ');
      expect(warnings).toContain('title');

      consoleWarn.mockRestore();
    });

    test("still applies transformations in build mode", () => {
      const schema = {
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 20
        }
      };

      const result = accessor.extractBySchema(parsed, schema, { mode: 'build' });

      // Should still truncate even in build mode
      expect(result.title.length).toBeLessThanOrEqual(23);
    });
  });

  describe("validateSchema", () => {
    test("returns validation results without extracting", () => {
      const schema = {
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 10
        },
        missingField: {
          path: "groups.main.missing",
          type: "plaintext",
          required: true
        }
      };

      const validation = accessor.validateSchema(parsed, schema, { mode: 'build' });

      expect(validation.title).toBeDefined();
      expect(validation.title.some(e => e.type === 'max_length')).toBe(true);
      expect(validation.missingField).toBeDefined();
      expect(validation.missingField.some(e => e.type === 'required')).toBe(true);
    });

    test("provides field-level hints for UI", () => {
      const schema = {
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 15
        }
      };

      const hints = accessor.validateSchema(parsed, schema, { mode: 'visual-editor' });

      if (hints.title) {
        const lengthHint = hints.title.find(h => h.type === 'max_length');
        expect(lengthHint).toBeDefined();
        expect(lengthHint.autoFix).toBe(true);
        expect(lengthHint.severity).toBe('info');
      }
    });
  });

  describe("Real-world component schemas", () => {
    test("Hero component schema", () => {
      const heroSchema = {
        brand: {
          path: "groups.main.header.pretitle",
          type: "plaintext",
          maxLength: 20
        },
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 60
        },
        subtitle: {
          path: "groups.main.header.subtitle",
          type: "plaintext",
          maxLength: 100
        },
        description: {
          path: "groups.main.body.paragraphs",
          type: "excerpt",
          maxLength: 200
        }
      };

      const result = accessor.extractBySchema(parsed, heroSchema);

      expect(result.brand).toBe("NEW");
      expect(result.title).not.toContain("<strong>");
      expect(result.subtitle).toBe("Get started today");
      expect(result.description).not.toContain("<em>");
    });

    test("Card component schema", () => {
      const cardSchema = {
        title: {
          path: "groups.main.header.title",
          type: "plaintext",
          maxLength: 50
        },
        text: {
          path: "groups.main.body.paragraphs",
          type: "excerpt",
          maxLength: 120
        }
      };

      const result = accessor.extractBySchema(parsed, cardSchema);

      expect(result.title).toBeTruthy();
      expect(result.text).toBeTruthy();
      expect(result.text.length).toBeLessThanOrEqual(123);
    });
  });
});
