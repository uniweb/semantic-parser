/**
 * What `links` holds: the links that stand on their own line. A link inside a sentence belongs to
 * the sentence.
 *
 * From 2026-01-17 until 2026-10-31 every link in every paragraph was copied in too, so a section
 * drawing `links` drew a sentence's link a second time, and `links[0]` could be one from the prose.
 * `_contracts/links-stand-on-their-own-line.test.js` holds this from real markdown.
 */
import { parseContent } from "../../src/index.js";

// The documents content-reader makes of the markdown each test names.
const text = (t) => ({ type: "text", text: t });
const linked = (label, href) => ({
    type: "text",
    text: label,
    marks: [{ type: "link", attrs: { href, title: null } }],
});
const paragraph = (...content) => ({ type: "paragraph", content });
const listItem = (...content) => ({ type: "listItem", content });
const list = (...items) => ({ type: "bulletList", content: items });
const parse = (...content) => parseContent({ type: "doc", content });
const labels = (links) => (links || []).map((l) => l.label);

describe("links", () => {
    it("leaves a sentence's link in the sentence", () => {
        const out = parse(paragraph(text("Read "), linked("the guide", "/guide"), text(" first.")));
        expect(out.links).toEqual([]);
        expect(out.paragraphs[0]).toContain('<a href="/guide"');
    });

    it("leaves every link of a sentence, and takes the one on its own line", () => {
        const out = parse(
            paragraph(text("See "), linked("one", "/1"), text(" and "), linked("two", "/2"), text(".")),
            paragraph(linked("Go", "/go"))
        );
        expect(labels(out.links)).toEqual(["Go"]);
    });

    it("holds a link on its own line, as a link and not a paragraph", () => {
        const out = parse(paragraph(linked("Go", "/go")));
        expect(labels(out.links)).toEqual(["Go"]);
        expect(out.paragraphs).toEqual([]);
    });

    it("holds each link of a line of nothing but links", () => {
        const out = parse(paragraph(linked("One", "/a"), text(" "), linked("Two", "/b")));
        expect(labels(out.links)).toEqual(["One", "Two"]);
        expect(out.paragraphs).toEqual([]);
    });

    it("gives each bullet of links its own, for a menu", () => {
        const out = parse(list(listItem(paragraph(linked("Home", "/"))), listItem(paragraph(linked("About", "/about")))));
        expect(out.links).toEqual([]);
        expect(out.lists[0].map((item) => labels(item.links))).toEqual([["Home"], ["About"]]);
    });

    it("gives a nested bullet its own, for a menu with levels", () => {
        const out = parse(
            list(listItem(paragraph(linked("Docs", "/docs")), list(listItem(paragraph(linked("Guide", "/guide"))))))
        );
        const [docs] = out.lists[0];
        expect(labels(docs.links)).toEqual(["Docs"]);
        expect(labels(docs.lists[0][0].links)).toEqual(["Guide"]);
    });

    it("leaves a link in a bullet's sentence in the sentence", () => {
        const out = parse(list(listItem(paragraph(text("See "), linked("the docs", "/docs"), text(" for more.")))));
        const [item] = out.lists[0];
        expect(item.links).toEqual([]);
        expect(item.paragraphs[0]).toContain('<a href="/docs"');
    });

    it("does the same in an item", () => {
        const out = parse(
            { type: "heading", attrs: { level: 2 }, content: [text("Title")] },
            paragraph(text("Lead.")),
            { type: "heading", attrs: { level: 3 }, content: [text("One")] },
            paragraph(text("See "), linked("this", "/x"), text(".")),
            paragraph(linked("Go", "/go"))
        );
        expect(labels(out.items[0].links)).toEqual(["Go"]);
    });
});
