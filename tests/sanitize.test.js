import { readFileSync } from "node:fs";
import {
    sanitizeMathML,
    sanitizeSVG,
    inspectMathML,
    inspectSVG,
    isSafeLink,
    isImageData,
    isImageSource,
    isLinkTarget,
    isStyleName,
    isCssColor,
    allowlists,
    escapeText,
    escapeAttribute,
} from "../src/sanitize.js";

/**
 * The allowlist rebuild for the two kinds of markup content may carry.
 *
 * Two halves. The first pins that real output passes untouched: every MathML
 * string in the fixture was compiled by temml (through content-reader) from
 * the math in the templates plus a set of constructs they do not use, so an
 * allowlist that drops something a LaTeX author writes fails here before any
 * page loses a formula. The second pins what may not pass: each case is a way
 * markup has been used to run script or load a resource.
 */

const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/temml-mathml.json", import.meta.url), "utf8"),
);

// Character references are a spelling: `&#x27;` and `'` are the same value in a
// double-quoted attribute, and the rebuild writes the plain character.
const references = (s) =>
    s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number(d)));

describe("sanitizeMathML — temml's own output passes untouched", () => {
    test("the fixture holds real compiler output", () => {
        expect(fixture.length).toBeGreaterThan(40);
        // All but temml's error output, which wraps the source in a span.
        expect(fixture.filter((m) => m.includes("<math")).length).toBeGreaterThan(40);
        expect(fixture.some((m) => m.includes("temml-error"))).toBe(true);
    });

    test.each(fixture.map((m, i) => [i, m]))("fixture %i", (_, mathml) => {
        expect(references(sanitizeMathML(mathml))).toBe(references(mathml));
    });
});

describe("sanitizeMathML — what may not pass", () => {
    const math = (inner) => `<math xmlns="http://www.w3.org/1998/Math/MathML">${inner}</math>`;

    test("an event handler goes, the element stays", () => {
        expect(sanitizeMathML(math('<mi onclick="alert(1)">x</mi>'))).toBe(math("<mi>x</mi>"));
    });

    test("an HTML element inside MathML goes, and so does what it would run", () => {
        const out = sanitizeMathML(math('<mtext><img src=x onerror="alert(1)"></mtext>'));
        expect(out).toBe(math("<mtext></mtext>"));
    });

    test("a link on a MathML element goes", () => {
        expect(sanitizeMathML(math('<mrow href="javascript:alert(1)"><mi>x</mi></mrow>'))).toBe(
            math("<mrow><mi>x</mi></mrow>"),
        );
    });

    test("annotation-xml, which can carry HTML, goes with its content", () => {
        const out = sanitizeMathML(
            math('<semantics><mi>x</mi><annotation-xml encoding="text/html"><script>alert(1)</script><b>y</b></annotation-xml></semantics>'),
        );
        expect(out).toBe(math("<semantics><mi>x</mi></semantics>"));
    });

    test("a script goes with its content; a comment goes; CDATA is text", () => {
        expect(sanitizeMathML("<script>alert(1)</script>")).toBe("");
        expect(sanitizeMathML(math("<!-- x --><mi>a</mi><![CDATA[<b>&amp;]]>"))).toBe(
            math("<mi>a</mi>&lt;b&gt;&amp;amp;"),
        );
    });

    test("a tag the reader cannot parse becomes text, never a tag", () => {
        expect(sanitizeMathML("<svg/onload=alert(1)>")).toBe("&lt;svg/onload=alert(1)&gt;");
    });

    test("a style keeps its declarations and loses any URL", () => {
        expect(sanitizeMathML(math('<mi style="color:red;background:url(http://x.test/a)">x</mi>'))).toBe(
            math('<mi style="color:red;">x</mi>'),
        );
        expect(sanitizeMathML(math('<mi style="background:url(javascript:alert(1))">x</mi>'))).toBe(
            math("<mi>x</mi>"),
        );
    });

    test("text is escaped on the way out, whatever the input spelled", () => {
        expect(sanitizeMathML(math("<mo>&lt;</mo><mo><</mo>"))).toBe(math("<mo>&lt;</mo><mo>&lt;</mo>"));
    });
});

describe("sanitizeSVG", () => {
    const lucide =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';

    test("an icon passes untouched", () => {
        expect(sanitizeSVG(lucide)).toBe(lucide);
    });

    test("gradients, references and camelCase names survive", () => {
        const svg =
            '<svg viewBox="0 0 10 10"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><use href="#g"/></svg>';
        expect(sanitizeSVG(svg)).toBe(svg);
    });

    test("a script goes with its content, and a handler goes", () => {
        expect(sanitizeSVG('<svg onload="alert(1)"><script>alert(2)</script><path d="M0 0"/></svg>')).toBe(
            '<svg><path d="M0 0"/></svg>',
        );
    });

    test("foreignObject and animations go with their content", () => {
        expect(
            sanitizeSVG('<svg><foreignObject><div>x</div></foreignObject><animate attributeName="href" values="javascript:alert(1)"/></svg>'),
        ).toBe("<svg></svg>");
    });

    test("a link element goes; its text stays as text", () => {
        expect(sanitizeSVG('<svg><a href="javascript:alert(1)"><text>go</text></a></svg>')).toBe(
            "<svg><text>go</text></svg>",
        );
    });

    test("a reference may only point inside the document", () => {
        expect(sanitizeSVG('<use href="http://x.test/s.svg#a"/>')).toBe("<use/>");
        expect(sanitizeSVG('<use xlink:href="#a"/>')).toBe('<use xlink:href="#a"/>');
        expect(sanitizeSVG('<rect fill="url(http://x.test/p)"/>')).toBe("<rect/>");
    });

    test("an image may load a raster, never a script or another SVG", () => {
        expect(sanitizeSVG('<image href="javascript:alert(1)"/>')).toBe("<image/>");
        expect(sanitizeSVG('<image href="data:image/svg+xml;base64,PHN2Zz4="/>')).toBe("<image/>");
        expect(sanitizeSVG('<image href="data:image/png;base64,iVBORw0KGgo="/>')).toBe(
            '<image href="data:image/png;base64,iVBORw0KGgo="/>',
        );
        expect(sanitizeSVG('<image href="/media/a.png"/>')).toBe('<image href="/media/a.png"/>');
    });

    test("a style element goes with its content", () => {
        expect(sanitizeSVG("<svg><style>*{background:url(x)}</style><g/></svg>")).toBe("<svg><g/></svg>");
    });
});

describe("isSafeLink", () => {
    test.each(["/about", "about", "#top", "?q=1", "https://x.test", "http://x.test", "mailto:a@x.test", "tel:+1", "page:93dc5359", "//x.test/a"])(
        "%s may be followed",
        (url) => expect(isSafeLink(url)).toBe(true),
    );

    test.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "data:text/html,<b>", "vbscript:x", "file:///etc/passwd", "topic:intro"])(
        "%j may not",
        (url) => expect(isSafeLink(url)).toBe(false),
    );
});

describe("an image's address, and the image itself as data", () => {
    // What `@uniweb/schemas/starter` builds for a placeholder: SVG, encoded whole.
    const placeholder = `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-hidden="true"><rect width="1600" height="900" fill="currentColor" opacity="0.06"/><g fill="currentColor" opacity="0.22"><circle cx="680" cy="321" r="52"/><path d="M494 640 L718 400 Z"/></g></svg>',
    )}`;
    const base64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

    test("SVG within the allowlist is an image, percent-encoded or base64, with or without parameters", () => {
        expect(isImageData(placeholder)).toBe(true);
        expect(isImageData(`data:image/svg+xml;base64,${base64('<svg viewBox="0 0 1 1"><rect width="1" height="1"/></svg>')}`)).toBe(true);
        expect(isImageData('data:image/svg+xml;charset=utf-8,<svg><text>100% — é</text></svg>')).toBe(true);
        expect(isImageData(`DATA:IMAGE/SVG+XML;charset=utf-8;base64,${base64("<svg/>")}`)).toBe(true);
    });

    test("SVG outside it is not — however it is encoded", () => {
        expect(isImageData('data:image/svg+xml,<svg onload="alert(1)"/>')).toBe(false);
        expect(isImageData(`data:image/svg+xml,${encodeURIComponent("<svg><script>alert(1)</script></svg>")}`)).toBe(false);
        expect(isImageData(`data:image/svg+xml;base64,${base64("<svg><foreignObject><div/></foreignObject></svg>")}`)).toBe(false);
        expect(isImageData("data:image/svg+xml,<svg><style>*{fill:red}</style></svg>")).toBe(false);
        expect(isImageData('data:image/svg+xml,<svg><image href="data:image/svg+xml,%3Csvg/%3E"/></svg>')).toBe(false);
        expect(isImageData("data:image/svg+xml;base64,not base64!")).toBe(false);
    });

    test("SVG is an image only as a rebuild writes it", () => {
        const quoted = "<svg viewBox='0 0 1 1'><rect width='1' height='1'/></svg>";
        expect(isImageData(`data:image/svg+xml,${encodeURIComponent(quoted)}`)).toBe(false);
        expect(isImageData(`data:image/svg+xml,${encodeURIComponent(sanitizeSVG(quoted))}`)).toBe(true);
        expect(inspectSVG(quoted).map((o) => o.reason)).toEqual(["spelling"]);
    });

    test("a raster image is one in base64; another media type is not", () => {
        expect(isImageData("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
        expect(isImageData(" data:image/jpeg;base64,/9j/4AAQ ")).toBe(true);
        expect(isImageData("data:image/png,iVBORw0KGgo")).toBe(false);
        expect(isImageData("data:image/bmp;base64,Qk0=")).toBe(false);
        expect(isImageData("data:text/html,<script>alert(1)</script>")).toBe(false);
        expect(isImageData("/a.png")).toBe(false);
    });

    test("an image's address is a link a page may follow, or the image as data", () => {
        for (const url of ["/media/a.png", "https://x.test/a.jpg", placeholder, "data:image/webp;base64,UklGRg=="]) {
            expect(isImageSource(url)).toBe(true);
        }
        for (const url of ["javascript:alert(1)", "data:text/html,<b>", 'data:image/svg+xml,<svg onload="x"/>', "vbscript:x"]) {
            expect(isImageSource(url)).toBe(false);
        }
    });

    test("inspectSVG names what a rebuild leaves out, and nothing for an icon", () => {
        expect(inspectSVG('<svg onload="alert(1)"><script>x</script><path d="M0 0"/></svg>')).toEqual([
            { reason: "attribute", element: "svg", attribute: "onload" },
            { reason: "element", element: "script" },
        ]);
        expect(inspectSVG('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 10v9"/></svg>')).toEqual([]);
        expect(inspectSVG("")).toEqual([]);
    });
});

describe("inspectMathML — what a rebuild would leave out, reported", () => {
    const math = (inner) => `<math xmlns="http://www.w3.org/1998/Math/MathML">${inner}</math>`;

    // temml writes a quote as `&quot;` or `&#x27;`, which a rebuild writes as the character: a
    // spelling, and the only thing between temml's output and the form content-reader stores.
    test.each(fixture.map((m, i) => [i, m]))("temml's fixture %i is within the allowlist once rebuilt", (_, mathml) => {
        expect(inspectMathML(mathml).filter((o) => o.reason !== "spelling")).toEqual([]);
        expect(inspectMathML(sanitizeMathML(mathml))).toEqual([]);
    });

    test("each thing a rebuild drops is named", () => {
        expect(inspectMathML(math('<mi onclick="alert(1)">x</mi>'))).toEqual([
            { reason: "attribute", element: "mi", attribute: "onclick" },
        ]);
        expect(inspectMathML(math('<mtext><img src=x onerror="alert(1)"></mtext>'))).toEqual([
            { reason: "element", element: "img" },
        ]);
        expect(inspectMathML(math('<mrow href="javascript:alert(1)"><mi>x</mi></mrow>'))).toEqual([
            { reason: "attribute", element: "mrow", attribute: "href" },
        ]);
        expect(inspectMathML(math('<mi style="color:red;background:url(http://x.test/a)">x</mi>'))).toEqual([
            { reason: "style", element: "mi", attribute: "style", value: "background:url(http://x.test/a)" },
        ]);
        expect(inspectMathML(math("<!-- x --><mi>a</mi>"))).toEqual([{ reason: "markup", value: "<!-- x -->" }]);
    });

    test("an element dropped with its content is named once", () => {
        expect(
            inspectMathML(math('<annotation-xml encoding="text/html"><script>alert(1)</script></annotation-xml>')),
        ).toEqual([{ reason: "element", element: "annotation-xml" }]);
    });

    test("markup is within it only as a rebuild writes it", () => {
        expect(inspectMathML(math("<mo>&lt;</mo><mi>x</mi>"))).toEqual([]);
        expect(inspectMathML(math('<mtext>say "hi"</mtext><mspace width="1em"/>'))).toEqual([]);
        expect(inspectMathML("")).toEqual([]);
        // Each of these is a spelling a rebuild writes differently, reported at its first difference.
        expect(inspectMathML(math("<mo><</mo>"))).toEqual([{ reason: "spelling", value: "<</mo></math>" }]);
        expect(inspectMathML(math("<mi><![CDATA[x]]></mi>"))).toEqual([{ reason: "spelling", value: "<![CDATA[x]]></mi></math>" }]);
        expect(inspectMathML(math("<mtext>&quot;hi&quot;</mtext>"))).toEqual([{ reason: "spelling", value: "&quot;hi&quot;</mtext></math>" }]);
        expect(inspectMathML(math("<mi mathvariant='bold'>x</mi>")).map((o) => o.reason)).toEqual(["spelling"]);
        expect(inspectMathML(math("<MI>x</MI>")).map((o) => o.reason)).toEqual(["spelling"]);
        expect(inspectMathML(math('<mspace width="1em" />')).map((o) => o.reason)).toEqual(["spelling"]);
        expect(inspectMathML(math("<mi>a &amp b</mi>")).map((o) => o.reason)).toEqual(["spelling"]);
    });

    test("what a rebuild writes is within it", () => {
        for (const mathml of [...fixture, math("<mo><</mo>"), math("<mi MathVariant='bold'>x</mi>"), math("<mi><![CDATA[a<b]]></mi>")]) {
            expect(inspectMathML(sanitizeMathML(mathml))).toEqual([]);
        }
    });
});

describe("values content may hold", () => {
    test("a link target is one of the four keywords", () => {
        for (const t of ["_self", "_blank", "_parent", "_top"]) expect(isLinkTarget(t)).toBe(true);
        for (const t of ["frame1", "_BLANK", "", null, 'x" onclick="y']) expect(isLinkTarget(t)).toBe(false);
    });

    test.each(["accent", "callout", "bigRed", "my_style", "data-x", "aria-label", "x1"])("%s is a style name", (name) => {
        expect(isStyleName(name)).toBe(true);
    });

    test.each(["onclick", "ONCLICK", "onMouseOver", "online", "href", "Style", "src", "xmlns", ".cls", "1x", "", "a b", "x:y", "rgb(255, 0, 0)"])(
        "%j is not",
        (name) => expect(isStyleName(name)).toBe(false),
    );

    test("a colour is a colour", () => {
        for (const c of ["red", "#fff", "rgb(255, 0, 0)", "var(--accent)", "hsl(0 50% 50%)"]) expect(isCssColor(c)).toBe(true);
        for (const c of ["red; background:url(x)", "url(x)", "expression(alert(1))", 'red"', 7]) expect(isCssColor(c)).toBe(false);
    });

    test("the rules as data are the lists the functions use", () => {
        const rules = allowlists();
        expect(JSON.parse(JSON.stringify(rules))).toEqual(rules);
        for (const scheme of rules.link.schemes) expect(isSafeLink(`${scheme}:x`)).toBe(true);
        for (const target of rules.link.targets) expect(isLinkTarget(target)).toBe(true);
        for (const name of rules.styleName.not) expect(isStyleName(name)).toBe(false);
        expect(new RegExp(rules.styleName.pattern).test("accent")).toBe(true);
        for (const element of rules.mathml.elements) {
            expect(sanitizeMathML(`<${element}></${element}>`)).toBe(`<${element}></${element}>`);
        }
        for (const element of rules.mathml.droppedWithContent) expect(sanitizeMathML(`<${element}>x</${element}>`)).toBe("");
    });
});

describe("escaping", () => {
    test("text escapes the three characters that open markup", () => {
        expect(escapeText('a<b & c>d "e"')).toBe('a&lt;b &amp; c&gt;d "e"');
    });

    test("an attribute value also escapes the double quote", () => {
        expect(escapeAttribute('x" onmouseover="y')).toBe("x&quot; onmouseover=&quot;y");
    });
});
