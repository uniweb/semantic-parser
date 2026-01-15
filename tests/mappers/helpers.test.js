import * as helpers from "../../src/mappers/helpers.js";

describe("Mapper Helpers", () => {
  describe("first", () => {
    test("returns first item from array", () => {
      expect(helpers.first([1, 2, 3])).toBe(1);
    });

    test("returns default for empty array", () => {
      expect(helpers.first([], "default")).toBe("default");
    });

    test("returns default for null", () => {
      expect(helpers.first(null, "default")).toBe("default");
    });
  });

  describe("last", () => {
    test("returns last item from array", () => {
      expect(helpers.last([1, 2, 3])).toBe(3);
    });

    test("returns default for empty array", () => {
      expect(helpers.last([], "default")).toBe("default");
    });
  });

  describe("transformArray", () => {
    test("transforms array elements", () => {
      const result = helpers.transformArray([1, 2, 3], x => x * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    test("returns empty array for non-array", () => {
      expect(helpers.transformArray(null, x => x)).toEqual([]);
    });
  });

  describe("filterArray", () => {
    test("filters array", () => {
      const result = helpers.filterArray([1, 2, 3, 4], x => x > 2);
      expect(result).toEqual([3, 4]);
    });

    test("filters and transforms", () => {
      const result = helpers.filterArray([1, 2, 3, 4], x => x > 2, x => x * 2);
      expect(result).toEqual([6, 8]);
    });
  });

  describe("joinText", () => {
    test("joins array with default separator", () => {
      expect(helpers.joinText(["hello", "world"])).toBe("hello world");
    });

    test("joins with custom separator", () => {
      expect(helpers.joinText(["a", "b", "c"], ", ")).toBe("a, b, c");
    });

    test("filters out falsy values", () => {
      expect(helpers.joinText(["a", null, "b", "", "c"])).toBe("a b c");
    });
  });

  describe("exists", () => {
    test("returns true for existing values", () => {
      expect(helpers.exists("text")).toBe(true);
      expect(helpers.exists(0)).toBe(true);
      expect(helpers.exists(false)).toBe(true);
    });

    test("returns false for null/undefined/empty", () => {
      expect(helpers.exists(null)).toBe(false);
      expect(helpers.exists(undefined)).toBe(false);
      expect(helpers.exists("")).toBe(false);
    });
  });

  describe("withDefault", () => {
    test("returns value if exists", () => {
      expect(helpers.withDefault("value", "default")).toBe("value");
    });

    test("returns default if value doesn't exist", () => {
      expect(helpers.withDefault(null, "default")).toBe("default");
      expect(helpers.withDefault("", "default")).toBe("default");
    });
  });

  describe("validateRequired", () => {
    test("validates all required fields present", () => {
      const data = { name: "John", age: 30 };
      const result = helpers.validateRequired(data, ["name", "age"]);
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    test("identifies missing fields", () => {
      const data = { name: "John" };
      const result = helpers.validateRequired(data, ["name", "age", "email"]);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["age", "email"]);
    });
  });

  describe("pick", () => {
    test("picks specified keys", () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(helpers.pick(obj, ["a", "c"])).toEqual({ a: 1, c: 3 });
    });

    test("handles null object", () => {
      expect(helpers.pick(null, ["a"])).toEqual({});
    });
  });

  describe("omit", () => {
    test("omits specified keys", () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(helpers.omit(obj, ["b"])).toEqual({ a: 1, c: 3 });
    });
  });

  describe("get", () => {
    test("gets nested value", () => {
      const obj = { a: { b: { c: "value" } } };
      expect(helpers.get(obj, "a.b.c")).toBe("value");
    });

    test("returns default for missing path", () => {
      const obj = { a: { b: {} } };
      expect(helpers.get(obj, "a.b.c", "default")).toBe("default");
    });

    test("handles null in path", () => {
      const obj = { a: null };
      expect(helpers.get(obj, "a.b.c", "default")).toBe("default");
    });
  });

  describe("compact", () => {
    test("removes null/undefined/empty strings", () => {
      const arr = [1, null, "text", undefined, "", 0, false];
      expect(helpers.compact(arr)).toEqual([1, "text", 0, false]);
    });
  });

  describe("safe", () => {
    test("returns value when function succeeds", () => {
      const fn = helpers.safe(x => x.toUpperCase());
      expect(fn("hello")).toBe("HELLO");
    });

    test("returns default when function throws", () => {
      const fn = helpers.safe(x => x.toUpperCase(), "DEFAULT");
      expect(fn(null)).toBe("DEFAULT");
    });
  });

  describe("joinParagraphs", () => {
    test("joins array of paragraphs with default separator", () => {
      expect(helpers.joinParagraphs(["First paragraph", "Second paragraph"])).toBe("First paragraph Second paragraph");
    });

    test("joins with custom separator", () => {
      expect(helpers.joinParagraphs(["Para 1", "Para 2"], "\n\n")).toBe("Para 1\n\nPara 2");
    });

    test("filters out falsy values", () => {
      expect(helpers.joinParagraphs(["Text", null, "", "More text"])).toBe("Text More text");
    });

    test("returns string as-is if not an array", () => {
      expect(helpers.joinParagraphs("Already a string")).toBe("Already a string");
    });

    test("returns empty string for null", () => {
      expect(helpers.joinParagraphs(null)).toBe("");
    });
  });

  describe("excerptFromParagraphs", () => {
    test("creates excerpt from array of paragraphs", () => {
      const paragraphs = ["First paragraph with some text", "Second paragraph with more"];
      const excerpt = helpers.excerptFromParagraphs(paragraphs, { maxLength: 30 });
      expect(excerpt.length).toBeLessThanOrEqual(33); // 30 + "..."
    });

    test("creates excerpt from single string", () => {
      const text = "This is a long piece of text that should be truncated";
      const excerpt = helpers.excerptFromParagraphs(text, { maxLength: 20 });
      expect(excerpt.length).toBeLessThanOrEqual(23); // 20 + "..."
    });
  });

  describe("countWords", () => {
    test("counts words in a string", () => {
      expect(helpers.countWords("Hello world")).toBe(2);
    });

    test("counts words in array of paragraphs", () => {
      expect(helpers.countWords(["First paragraph", "Second paragraph"])).toBe(4);
    });

    test("strips markup before counting", () => {
      expect(helpers.countWords("<strong>Bold</strong> and <em>italic</em> text")).toBe(4);
    });

    test("handles multiple spaces", () => {
      expect(helpers.countWords("Word   with    spaces")).toBe(3);
    });
  });
});
