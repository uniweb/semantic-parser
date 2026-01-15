import * as types from "../../src/mappers/types.js";

describe("Type System", () => {
  describe("stripMarkup", () => {
    test("removes HTML tags", () => {
      const text = "Hello <strong>world</strong> with <em>formatting</em>";
      expect(types.stripMarkup(text)).toBe("Hello world with formatting");
    });

    test("handles links", () => {
      const text = 'Visit <a href="http://example.com">our site</a>';
      expect(types.stripMarkup(text)).toBe("Visit our site");
    });

    test("decodes HTML entities", () => {
      const text = "Hello &amp; goodbye &lt;tag&gt; &nbsp;";
      expect(types.stripMarkup(text)).toBe("Hello & goodbye <tag>");
    });

    test("preserves line breaks when requested", () => {
      const text = "Line 1<br>Line 2<br/>Line 3";
      const result = types.stripMarkup(text, { preserveLineBreaks: true });
      expect(result).toBe("Line 1\nLine 2\nLine 3");
    });
  });

  describe("truncateText", () => {
    test("truncates at word boundary", () => {
      const text = "This is a long text that needs to be truncated";
      const result = types.truncateText(text, { maxLength: 20 });
      expect(result.length).toBeLessThanOrEqual(23); // 20 + "..."
      expect(result).toContain("...");
    });

    test("preserves full text if under limit", () => {
      const text = "Short text";
      const result = types.truncateText(text, { maxLength: 20 });
      expect(result).toBe("Short text");
    });

    test("truncates at character boundary", () => {
      const text = "This is a test";
      const result = types.truncateText(text, {
        maxLength: 10,
        boundary: 'character'
      });
      expect(result).toBe("This is a ...");
    });

    test("strips markup when requested", () => {
      const text = "Hello <strong>world</strong> and more text";
      const result = types.truncateText(text, {
        maxLength: 20,
        stripMarkup: true
      });
      expect(result).not.toContain("<strong>");
    });
  });

  describe("createExcerpt", () => {
    test("creates excerpt from text", () => {
      const text = "This is a long paragraph that should be truncated to a reasonable excerpt length.";
      const result = types.createExcerpt(text, { maxLength: 30 });
      expect(result.length).toBeLessThanOrEqual(33); // 30 + "..."
    });

    test("creates excerpt from array of paragraphs", () => {
      const paragraphs = [
        "First paragraph here.",
        "Second paragraph here."
      ];
      const result = types.createExcerpt(paragraphs, { maxLength: 30 });
      expect(result).toContain("First paragraph");
    });

    test("prefers first sentence when short enough", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const result = types.createExcerpt(text, {
        maxLength: 50,
        preferFirstSentence: true
      });
      expect(result).toBe("First sentence.");
    });
  });

  describe("sanitizeHtml", () => {
    test("removes dangerous tags", () => {
      const html = "Hello <script>alert('xss')</script> world";
      const result = types.sanitizeHtml(html);
      expect(result).toBe("Hello  world");
      expect(result).not.toContain("script");
    });

    test("preserves safe tags", () => {
      const html = "Hello <strong>bold</strong> and <em>italic</em>";
      const result = types.sanitizeHtml(html);
      expect(result).toBe("Hello <strong>bold</strong> and <em>italic</em>");
    });

    test("sanitizes link attributes", () => {
      const html = '<a href="http://example.com" onclick="alert()">Link</a>';
      const result = types.sanitizeHtml(html);
      expect(result).toContain('href="http://example.com"');
      expect(result).not.toContain("onclick");
    });
  });

  describe("Type Handlers", () => {
    describe("plaintext", () => {
      test("strips markup", () => {
        const value = "Hello <strong>world</strong>";
        const result = types.applyType(value, 'plaintext');
        expect(result).toBe("Hello world");
      });

      test("truncates when maxLength specified", () => {
        const value = "This is a very long text that should be truncated";
        const result = types.applyType(value, 'plaintext', { maxLength: 20 });
        expect(result.length).toBeLessThanOrEqual(23);
      });

      test("applies custom transform", () => {
        const value = "hello world";
        const result = types.applyType(value, 'plaintext', {
          transform: (text) => text.toUpperCase()
        });
        expect(result).toBe("HELLO WORLD");
      });
    });

    describe("richtext", () => {
      test("preserves safe HTML", () => {
        const value = "Hello <strong>world</strong>";
        const result = types.applyType(value, 'richtext');
        expect(result).toBe("Hello <strong>world</strong>");
      });

      test("removes dangerous tags", () => {
        const value = "Hello <script>bad</script> world";
        const result = types.applyType(value, 'richtext');
        expect(result).not.toContain("script");
      });
    });

    describe("excerpt", () => {
      test("creates excerpt from text", () => {
        const value = "This is a long text that should be turned into an excerpt.";
        const result = types.applyType(value, 'excerpt', { maxLength: 20 });
        expect(result.length).toBeLessThanOrEqual(23);
      });

      test("creates excerpt from array", () => {
        const value = ["First paragraph.", "Second paragraph."];
        const result = types.applyType(value, 'excerpt', { maxLength: 30 });
        expect(result).toContain("First");
      });
    });

    describe("number", () => {
      test("parses number", () => {
        expect(types.applyType("123", 'number')).toBe(123);
        expect(types.applyType("12.34", 'number')).toBe(12.34);
      });

      test("returns default for invalid number", () => {
        const result = types.applyType("not a number", 'number', {
          defaultValue: 0
        });
        expect(result).toBe(0);
      });

      test("formats number with options", () => {
        const result = types.applyType(1234.567, 'number', {
          format: { decimals: 2, thousands: ',', decimal: '.' }
        });
        expect(result).toBe("1,234.57");
      });
    });

    describe("image", () => {
      test("handles string URL", () => {
        const result = types.applyType("/image.jpg", 'image');
        expect(result.url).toBe("/image.jpg");
        expect(result.alt).toBe("");
      });

      test("handles object with full data", () => {
        const value = {
          url: "/image.jpg",
          alt: "Test image",
          caption: "A test"
        };
        const result = types.applyType(value, 'image');
        expect(result.url).toBe("/image.jpg");
        expect(result.alt).toBe("Test image");
        expect(result.caption).toBe("A test");
      });

      test("uses default value when null", () => {
        const result = types.applyType(null, 'image', {
          defaultValue: "/placeholder.jpg"
        });
        expect(result).toBe("/placeholder.jpg");
      });
    });

    describe("link", () => {
      test("handles string URL", () => {
        const result = types.applyType("http://example.com", 'link');
        expect(result.href).toBe("http://example.com");
        expect(result.target).toBe("_blank");
      });

      test("handles object with full data", () => {
        const value = {
          href: "/page",
          label: "Link text"
        };
        const result = types.applyType(value, 'link');
        expect(result.href).toBe("/page");
        expect(result.label).toBe("Link text");
        expect(result.target).toBe("_self");
      });
    });
  });

  describe("Validation", () => {
    describe("plaintext validation", () => {
      test("detects markup in build mode", () => {
        const errors = types.validateType(
          "Hello <strong>world</strong>",
          'plaintext',
          { fieldName: 'title' },
          'build'
        );
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].type).toBe('markup_detected');
      });

      test("does not warn about markup in visual-editor mode", () => {
        const errors = types.validateType(
          "Hello <strong>world</strong>",
          'plaintext',
          { fieldName: 'title' },
          'visual-editor'
        );
        const markupErrors = errors.filter(e => e.type === 'markup_detected');
        expect(markupErrors.length).toBe(0);
      });

      test("validates required fields", () => {
        const errors = types.validateType(
          "",
          'plaintext',
          { fieldName: 'title', required: true },
          'visual-editor'
        );
        expect(errors.some(e => e.type === 'required')).toBe(true);
      });

      test("validates maxLength", () => {
        const errors = types.validateType(
          "This is a very long text that exceeds the maximum length",
          'plaintext',
          { fieldName: 'title', maxLength: 20 },
          'build'
        );
        expect(errors.some(e => e.type === 'max_length')).toBe(true);
      });
    });
  });
});
