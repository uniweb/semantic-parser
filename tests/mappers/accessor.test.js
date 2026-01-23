import { parseContent } from "../../src/index.js";
import * as accessor from "../../src/mappers/accessor.js";

describe("Mapper Accessor", () => {
  const mockDoc = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Main Title" }]
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "First paragraph" }]
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Second paragraph" }]
      }
    ]
  };

  let parsed;

  beforeEach(() => {
    parsed = parseContent(mockDoc);
  });

  describe("getByPath", () => {
    test("extracts simple path", () => {
      const title = accessor.getByPath(parsed, "title");
      expect(title).toBe("Main Title");
    });

    test("extracts array with index", () => {
      const firstPara = accessor.getByPath(parsed, "paragraphs[0]");
      expect(firstPara).toBe("First paragraph");
    });

    test("returns default for missing path", () => {
      const value = accessor.getByPath(parsed, "missingField", {
        defaultValue: "default"
      });
      expect(value).toBe("default");
    });

    test("applies transformation", () => {
      const upper = accessor.getByPath(parsed, "title", {
        transform: s => s.toUpperCase()
      });
      expect(upper).toBe("MAIN TITLE");
    });

    test("throws on required missing field", () => {
      expect(() => {
        accessor.getByPath(parsed, "missingField", { required: true });
      }).toThrow();
    });

    test("transforms with array path", () => {
      const joined = accessor.getByPath(parsed, "paragraphs", {
        transform: arr => arr.join(" ")
      });
      expect(joined).toBe("First paragraph Second paragraph");
    });
  });

  describe("extractBySchema", () => {
    test("extracts using shorthand schema", () => {
      const schema = {
        title: "title"
      };
      const result = accessor.extractBySchema(parsed, schema);
      expect(result.title).toBe("Main Title");
    });

    test("extracts using full config schema", () => {
      const schema = {
        title: "title",
        missingField: {
          path: "nonexistent",
          defaultValue: "Default value"
        },
        description: {
          path: "paragraphs",
          transform: p => p.join(" ")
        }
      };
      const result = accessor.extractBySchema(parsed, schema);
      expect(result.title).toBe("Main Title");
      expect(result.missingField).toBe("Default value");
      expect(result.description).toBe("First paragraph Second paragraph");
    });
  });

  describe("hasPath", () => {
    test("returns true for existing path", () => {
      expect(accessor.hasPath(parsed, "title")).toBe(true);
    });

    test("returns false for missing path", () => {
      expect(accessor.hasPath(parsed, "missingField")).toBe(false);
    });

    test("returns false for path with null value", () => {
      const testParsed = {
        value: null
      };
      expect(accessor.hasPath(testParsed, "value")).toBe(false);
    });
  });

  describe("getFirstExisting", () => {
    test("returns first existing path", () => {
      const result = accessor.getFirstExisting(parsed, [
        "missingField",
        "title",
        "subtitle"
      ]);
      expect(result).toBe("Main Title");
    });

    test("returns default if none exist", () => {
      const result = accessor.getFirstExisting(parsed, [
        "missing1",
        "missing2"
      ], "default");
      expect(result).toBe("default");
    });
  });

  describe("mapArray", () => {
    const multiItemDoc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Main" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Main content" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Item 1" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Item 1 content" }]
        },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Item 2" }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Item 2 content" }]
        }
      ]
    };

    test("maps array with simple path", () => {
      const itemParsed = parseContent(multiItemDoc);
      const titles = accessor.mapArray(itemParsed, "items", "title");
      expect(titles).toEqual(["Item 1", "Item 2"]);
    });

    test("maps array with schema", () => {
      const itemParsed = parseContent(multiItemDoc);
      const items = accessor.mapArray(itemParsed, "items", {
        title: "title",
        text: {
          path: "paragraphs[0]",
          defaultValue: "No content"
        }
      });
      expect(items).toEqual([
        { title: "Item 1", text: "Item 1 content" },
        { title: "Item 2", text: "Item 2 content" }
      ]);
    });

    test("returns empty array for non-array path", () => {
      const result = accessor.mapArray(parsed, "title", "x");
      expect(result).toEqual([]);
    });
  });
});
