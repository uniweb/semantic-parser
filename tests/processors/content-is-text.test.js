import { processSequence } from "../../src/processors/sequence.js";

/**
 * A text node holds text — what an author or a member wrote, never markup.
 *
 * The strings this parser builds are injected as HTML by kit's renderers, so
 * every character of a text node is escaped on the way in, and every attribute
 * value. Before 2026-10-14 text went in as stored: `<img src=x onerror=…>` in a
 * paragraph was a live element with a running handler on a published page, and
 * an author's `if a<b then swap` showed as `if a`. Each case below was measured
 * that way first.
 */

const doc = (content) => ({ type: "doc", content: [{ type: "paragraph", content }] });
const text = (t, marks) => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const render = (content) => processSequence(doc(content))[0].text;

describe("text", () => {
    test("markup someone typed is text", () => {
        const out = render([text("typed: <img src=x onerror=alert(1)>")]);
        expect(out).toBe("typed: &lt;img src=x onerror=alert(1)&gt;");
        expect(out).not.toContain("<img");
    });

    test("an author's comparison survives", () => {
        expect(render([text("if a<b then swap")])).toBe("if a&lt;b then swap");
        expect(render([text("use x<y and y>z")])).toBe("use x&lt;y and y&gt;z");
    });

    test("an ampersand is escaped, so it is never read as a reference", () => {
        expect(render([text("R&D, and &lt; as typed")])).toBe("R&amp;D, and &amp;lt; as typed");
    });

    test("code holds its characters", () => {
        expect(render([text("Use "), text("<div>", [{ type: "code" }])])).toBe("Use <code>&lt;div&gt;</code>");
    });

    test("a hard break is the one tag the text gets", () => {
        expect(render([text("a"), { type: "hardBreak" }, text("b")])).toBe("a<br>b");
    });
});

describe("links", () => {
    const link = (href, extra = {}) => ({ type: "link", attrs: { href, ...extra } });

    test("a link that may not be followed is not drawn as one", () => {
        expect(render([text("see "), text("this", [link("javascript:alert(1)")]), text(" now")])).toBe("see this now");
        expect(render([text("a "), text("x", [link("data:text/html,<script>alert(1)</script>")])])).toBe("a x");
    });

    test("a quote in a URL cannot open an attribute", () => {
        const out = render([text("a "), text("x", [link('/a" onmouseover="alert(1)')])]);
        expect(out).toBe('a <a href="/a&quot; onmouseover=&quot;alert(1)" target="_self">x</a>');
    });

    test("a page reference and a target survive; an unknown target does not", () => {
        expect(render([text("a "), text("x", [link("page:93dc5359", { target: "_blank" })])])).toBe(
            'a <a href="page:93dc5359" target="_blank">x</a>',
        );
        expect(render([text("a "), text("x", [link("/a", { target: 'top" onclick="y' })])])).toBe(
            'a <a href="/a" target="_self">x</a>',
        );
    });

    test("a paragraph that is only a link is not a link element when the URL may not be followed", () => {
        const [only] = processSequence(doc([text("go", [link("javascript:alert(1)")])]));
        expect(only.type).toBe("paragraph");
        expect(only.text).toBe("go");
        expect(JSON.stringify(only)).not.toContain("javascript:");

        const [safe] = processSequence(doc([text("go", [link("/about")])]));
        expect(safe).toMatchObject({ type: "link", attrs: { href: "/about", label: "go" } });
    });

    test("a button is a link whose role is button", () => {
        // `[Get Started](/signup){button}` — the mark both producers save.
        // ⛔ Until 2026-10-14 nothing read the mark: the label reached the page
        // as plain text and the link was lost.
        const button = (href, extra = {}) => ({ type: "button", attrs: { href, title: null, variant: "primary", ...extra } });

        const [alone] = processSequence(doc([text("Get Started", [button("/signup")])]));
        expect(alone).toMatchObject({
            type: "link",
            attrs: { href: "/signup", label: "Get Started", role: "button", variant: "primary" },
        });

        expect(render([text("Click "), text("Go", [button("/x")]), text(" now.")])).toBe(
            'Click <a href="/x" target="_self">Go</a> now.',
        );

        const [cta] = processSequence(doc([text("Go", [button("/x", { role: "cta" })])]));
        expect(cta.attrs.role).toBe("cta");

        const [unsafe] = processSequence(doc([text("Go", [button("javascript:alert(1)")])]));
        expect(unsafe.type).toBe("paragraph");
        expect(JSON.stringify(unsafe)).not.toContain("javascript:");
    });

    test("a paragraph of only links, and the links a paragraph lists, drop the unsafe one", () => {
        const [p] = processSequence(doc([text("a", [link("/a")]), text(" "), text("b", [link("javascript:x")])]));
        expect(JSON.stringify(p)).not.toContain("javascript:");
        expect(p.text).toBe('<a href="/a" target="_self">a</a> b');
    });
});

describe("named styles and spans", () => {
    const span = (attrs) => ({ type: "span", attrs });

    test("a named style is an attribute of its span", () => {
        expect(render([text("x", [span({ accent: true })])])).toBe('<span accent="true">x</span>');
    });

    test("an event handler, a URL attribute or a pasted colour is not a name", () => {
        expect(render([text("x", [span({ onmouseover: "alert(1)" })])])).toBe("<span>x</span>");
        expect(render([text("x", [span({ href: "javascript:alert(1)", style: "x" })])])).toBe("<span>x</span>");
        expect(render([text("x", [span({ "rgb(255, 0, 0)": true })])])).toBe("<span>x</span>");
        // HTML lowercases an attribute name, so a handler in any case is one.
        expect(render([text("x", [span({ onMouseOver: "alert(1)", ONCLICK: "y" })])])).toBe("<span>x</span>");
    });

    test("a theme's own style name is kept, whatever its case", () => {
        // theme.yml's `inline:` names any key; `span[bigRed]` matches the
        // attribute a browser lowercases, so the name reaches the page as written.
        expect(render([text("x", [span({ bigRed: true, my_style: true })])])).toBe(
            '<span bigRed="true" my_style="true">x</span>',
        );
    });

    test("class and id are escaped", () => {
        expect(render([text("x", [span({ class: 'a" onclick="b', id: "i<d" })])])).toBe(
            '<span class="a&quot; onclick=&quot;b" id="i&lt;d">x</span>',
        );
    });

    test("a colour is a colour, or nothing", () => {
        expect(render([text("x", [span({ color: "rgb(1, 2, 3)" })])])).toBe('<span style="color: rgb(1, 2, 3)">x</span>');
        expect(render([text("x", [span({ color: "red; background:url(x)" })])])).toBe("<span>x</span>");
        expect(render([text("x", [{ type: "textStyle", attrs: { color: 'a) ; x"' } }])])).toBe("x");
        expect(render([text("x", [{ type: "textStyle", attrs: { color: "accent" } }])])).toBe(
            '<span style="color: var(--accent)">x</span>',
        );
    });
});

describe("markup a node carries", () => {
    test("inline math is rebuilt from the MathML allowlist", () => {
        const out = render([
            text("e "),
            { type: "math_inline", attrs: { latex: 'x"', mathml: '<math><mi onclick="a">x</mi><img src=x onerror="alert(1)"></math>' } },
        ]);
        expect(out).toBe('e <span data-type="math" data-latex="x&quot;" data-display="false"><math><mi>x</mi></math></span>');
    });

    test("display math is rebuilt the same way", () => {
        const [el] = processSequence({
            type: "doc",
            content: [{ type: "math_display", attrs: { latex: "x", mathml: "<math><mi>x</mi><script>alert(1)</script></math>" } }],
        });
        expect(el.mathml).toBe("<math><mi>x</mi></math>");
    });

    test("an inset's reference id is escaped", () => {
        expect(render([{ type: "inset_placeholder", attrs: { refId: 'r" onclick="x' } }])).toBe(
            '<uniweb-inset data-ref-id="r&quot; onclick=&quot;x"></uniweb-inset>',
        );
    });

    test("an icon's SVG is rebuilt from the SVG allowlist", () => {
        const [el] = processSequence({
            type: "doc",
            content: [{ type: "Icon", attrs: { svg: '<svg onload="alert(1)"><script>x</script><path d="M0 0"/></svg>' } }],
        });
        expect(el.attrs.svg).toBe('<svg><path d="M0 0"/></svg>');
    });
});
