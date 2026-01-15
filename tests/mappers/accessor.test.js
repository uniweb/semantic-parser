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
      const title = accessor.getByPath(parsed, "groups.main.header.title");
      expect(title).toBe("Main Title");
    });

    test("extracts array with index", () => {
      const firstPara = accessor.getByPath(parsed, "groups.main.body.paragraphs[0]");
      expect(firstPara).toBe("First paragraph");
    });

    test("returns default for missing path", () => {
      const value = accessor.getByPath(parsed, "groups.main.missing", {
        defaultValue: "default"
      });
      expect(value).toBe("default");
    });

    test("applies transformation", () => {
      const upper = accessor.getByPath(parsed, "groups.main.header.title", {
        transform: s => s.toUpperCase()
      });
      expect(upper).toBe("MAIN TITLE");
    });

    test("throws on required missing field", () => {
      expect(() => {
        accessor.getByPath(parsed, "groups.main.missing", { required: true });
      }).toThrow();
    });

    test("transforms with array path", () => {
      const joined = accessor.getByPath(parsed, "groups.main.body.paragraphs", {
        transform: arr => arr.join(" ")
      });
      expect(joined).toBe("First paragraph Second paragraph");
    });
  });

  describe("extractBySchema", () => {
    test("extracts using shorthand schema", () => {
      const schema = {
        title: "groups.main.header.title"
      };
      const result = accessor.extractBySchema(parsed, schema);
      expect(result.title).toBe("Main Title");
    });

    test("extracts using full config schema", () => {
      const schema = {
        title: "groups.main.header.title",
        missingField: {
          path: "groups.main.header.nonexistent",
          defaultValue: "Default value"
        },
        description: {
          path: "groups.main.body.paragraphs",
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
      expect(accessor.hasPath(parsed, "groups.main.header.title")).toBe(true);
    });

    test("returns false for missing path", () => {
      expect(accessor.hasPath(parsed, "groups.main.missing")).toBe(false);
    });

    test("returns false for path with null value", () => {
      const testParsed = {
        groups: { main: { value: null } }
      };
      expect(accessor.hasPath(testParsed, "groups.main.value")).toBe(false);
    });
  });

  describe("getFirstExisting", () => {
    test("returns first existing path", () => {
      const result = accessor.getFirstExisting(parsed, [
        "groups.main.missing",
        "groups.main.header.title",
        "groups.main.header.subtitle"
      ]);
      expect(result).toBe("Main Title");
    });

    test("returns default if none exist", () => {
      const result = accessor.getFirstExisting(parsed, [
        "groups.main.missing1",
        "groups.main.missing2"
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
      const titles = accessor.mapArray(itemParsed, "groups.items", "header.title");
      expect(titles).toEqual(["Item 1", "Item 2"]);
    });

    test("maps array with schema", () => {
      const itemParsed = parseContent(multiItemDoc);
      const items = accessor.mapArray(itemParsed, "groups.items", {
        title: "header.title",
        text: {
          path: "body.paragraphs[0]",
          defaultValue: "No content"
        }
      });
      expect(items).toEqual([
        { title: "Item 1", text: "Item 1 content" },
        { title: "Item 2", text: "Item 2 content" }
      ]);
    });

    test("returns empty array for non-array path", () => {
      const result = accessor.mapArray(parsed, "groups.main.header.title", "x");
      expect(result).toEqual([]);
    });
  });
});
