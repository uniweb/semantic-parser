import { processSequence } from "../../src/processors/sequence.js";

/**
 * Inline marks in the generated HTML string.
 *
 * Two defects these pin:
 *
 *  - The `code` mark was dropped entirely. The mark chain handled textStyle,
 *    highlight, span, bold, italic and link, so inline code arrived in the
 *    document as a marked text node and left as ordinary prose, with nothing
 *    for a foundation or a print adapter to distinguish.
 *
 *  - A link mark was applied per node, so a label made of several nodes
 *    produced one anchor per node instead of one anchor. Marked-up labels
 *    (`[read *this* now](/x)`) only became possible once content-reader
 *    started tokenizing labels, which is what exposed it.
 */

const doc = (content) => ({ type: "doc", content: [{ type: "paragraph", content }] });
const text = (t, marks) => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const link = (href, extra = {}) => ({ type: "link", attrs: { href, ...extra } });

const render = (content) => processSequence(doc(content))[0].text;

describe("code mark", () => {
  test("emits a <code> element", () => {
    expect(render([text("Run "), text("npm install", [{ type: "code" }]), text(" first.")])).toBe(
      "Run <code>npm install</code> first.",
    );
  });

  test("emits a bare <code>, leaving styling to the theme", () => {
    // No class attribute: how code looks is the theme's business.
    expect(render([text("x", [{ type: "code" }])])).toBe("<code>x</code>");
  });

  test("nests inside bold and italic", () => {
    const out = render([text("x", [{ type: "code" }, { type: "bold" }])]);

    expect(out).toBe("<strong><code>x</code></strong>");
  });
});

describe("link grouping", () => {
  test("a multi-node label produces ONE anchor", () => {
    const l = link("/x");
    const out = render([
      text("A "),
      text("read ", [l]),
      text("this", [l, { type: "italic" }]),
      text(" now", [l]),
      text(" end."),
    ]);

    expect(out).toBe('A <a href="/x" target="_self">read <em>this</em> now</a> end.');
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  test("keeps distinct links separate", () => {
    const out = render([
      text("one", [link("/a")]),
      text(" and "),
      text("two", [link("/b")]),
    ]);

    expect(out.match(/<a /g)).toHaveLength(2);
    expect(out).toContain('href="/a"');
    expect(out).toContain('href="/b"');
  });

  test("does not merge same-href links that differ in other attributes", () => {
    // Surrounding text keeps this a paragraph: a link-only paragraph is
    // promoted to a `link` element by design and has no `text`.
    const out = render([
      text("see "),
      text("one", [link("/a")]),
      text("two", [link("/a", { target: "_blank" })]),
      text(" end."),
    ]);

    expect(out.match(/<a /g)).toHaveLength(2);
  });

  test("does not merge links separated by other content", () => {
    const l = link("/x");
    const out = render([text("one", [l]), text(" gap "), text("two", [l])]);

    expect(out.match(/<a /g)).toHaveLength(2);
  });

  test("still marks a file link as a download", () => {
    const out = render([text("the "), text("report", [link("/files/r.pdf")]), text(" here.")]);

    expect(out).toBe('the <a href="/files/r.pdf" target="_self" download>report</a> here.');
  });
});

describe("whitespace", () => {
  // The link grouping refactor split per-node rendering out of the reduce; a
  // trim that belonged to the whole string briefly ran per node, silently
  // eating the spaces between them.
  test("preserves spaces between adjacent nodes", () => {
    expect(render([text("Some "), text("bold", [{ type: "bold" }]), text(" and more.")])).toBe(
      "Some <strong>bold</strong> and more.",
    );
  });

  test("preserves a newline carried as text", () => {
    expect(render([text("one"), text("\n"), text("two")])).toBe("one\ntwo");
  });

  test("still trims the outer edges", () => {
    expect(render([text("  padded  ")])).toBe("padded");
  });
});
