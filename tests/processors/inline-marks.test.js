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

describe("strike mark", () => {
  // ⛔ Until 2026-10-19 nothing applied it: `~~gone~~` reached the page as
  // "gone", with nothing for a stylesheet or a print adapter to tell apart.
  test("emits an <s> element", () => {
    expect(render([text("was "), text("gone", [{ type: "strike" }]), text(" now")])).toBe(
      "was <s>gone</s> now",
    );
  });

  test("wraps the other marks", () => {
    expect(render([text("x", [{ type: "strike" }, { type: "bold" }])])).toBe("<s><strong>x</strong></s>");
  });

  test("CONTROL — text with no strike mark gets no <s>", () => {
    expect(render([text("plain "), text("bold", [{ type: "bold" }])])).not.toContain("<s>");
  });
});

describe("a link's role", () => {
  // ⛔ Until 2026-10-19 the anchor dropped it, so a button — a link whose role
  // is `button` (`[Go](/x){button}`) — reached the page as a plain link.
  const button = (href) => ({ type: "button", attrs: { href } });

  test("a button mark's anchor says it is a button", () => {
    expect(render([text("then "), text("Sign up", [button("/join")]), text(" today.")])).toBe(
      'then <a href="/join" target="_self" data-role="button">Sign up</a> today.',
    );
  });

  test("an authored role rides the same way", () => {
    expect(render([text("see "), text("docs", [link("/d", { role: "nav" })]), text(".")])).toContain(
      '<a href="/d" target="_self" data-role="nav">docs</a>',
    );
  });

  test("a role that is not a style name is left out, never written into the tag", () => {
    const out = render([text("see "), text("x", [link("/d", { role: 'nav" onclick="alert(1)' })]), text(".")]);

    expect(out).toBe('see <a href="/d" target="_self">x</a>.');
  });

  test("a block whose every run carries one button draws one anchor that keeps the role", () => {
    // `isStyledLink` — the block whose runs all carry the same link, drawn as one
    // anchor. It returns a paragraph, for a heading too: the element this tests is
    // no longer a heading (pre-existing — `isStyledLink` has always done so).
    const b = button("/go");
    const heading = {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 2 }, content: [text("Go", [b, { type: "bold" }]), text(" now", [b])] }],
    };

    expect(processSequence(heading)[0].text).toBe(
      '<a href="/go" target="_self" data-role="button"><strong>Go</strong> now</a>',
    );
  });

  test("CONTROL — a link with no role gets no data-role", () => {
    expect(render([text("see "), text("docs", [link("/d")]), text(".")])).toBe(
      'see <a href="/d" target="_self">docs</a>.',
    );
  });
});
