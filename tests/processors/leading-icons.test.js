/**
 * An icon before any text is the element's own icon, not part of its prose.
 *
 * The flat fields (`title`, `paragraphs`, a list item's) hold the text a component draws beside
 * that icon, which it finds in `icons`. So they keep no marker for it, and a line holding only
 * icons leaves no paragraph. The `sequence` keeps every marker, where kit's `Render` draws each
 * icon in place. An icon inside the prose is marked in both [Diego, 2026-10-24].
 *
 * ⛔ From 2026-08-12 to 2026-10-24 the flat fields kept the leading markers, and a component
 * drawing `paragraphs[0]` as text showed `<uniweb-icon data-index="0"></uniweb-icon>`.
 */
import { parseContent } from "../../src/index.js";

// The documents content-reader makes of the markdown each test names.
const icon = (name) => ({ type: "image", attrs: { role: "icon", library: "lu", name } });
const text = (t) => ({ type: "text", text: t });
const paragraph = (...content) => ({ type: "paragraph", content });
const heading = (level, ...content) => ({ type: "heading", attrs: { level }, content });
const list = (...items) => ({
    type: "bulletList",
    content: items.map((content) => ({ type: "listItem", content: [paragraph(...content)] })),
});
const parse = (...content) => parseContent({ type: "doc", content });
const MARKER = (i) => `<uniweb-icon data-index="${i}"></uniweb-icon>`;

describe("an icon before any text", () => {
    it("on a line of its own leaves no paragraph, and stays in icons", () => {
        // `## Cloud`, `![](lu-cloud)`, `Access your projects.`
        const out = parse(heading(2, text("Cloud")), paragraph(icon("cloud")), paragraph(text("Access your projects.")));
        expect(out.title).toBe("Cloud");
        expect(out.paragraphs).toEqual(["Access your projects."]);
        expect(out.icons.map((i) => i.name)).toEqual(["cloud"]);
        // The sequence keeps it, where Render draws the icon.
        expect(out.sequence.filter((e) => e.type === "paragraph").map((e) => e.text)).toEqual([
            MARKER(0),
            "Access your projects.",
        ]);
    });

    it("leading a list item leaves the item its words", () => {
        // `- ![](lu-apple) macOS`, `- ![](lu-grid2-x2) Windows`
        const out = parse(list([icon("apple"), text(" macOS")], [icon("grid2-x2"), text(" Windows")]));
        expect(out.lists[0].map((item) => item.paragraphs)).toEqual([["macOS"], ["Windows"]]);
        expect(out.lists[0].map((item) => item.icons.map((i) => i.name))).toEqual([["apple"], ["grid2-x2"]]);
    });

    it("leading a heading leaves the title its words", () => {
        // `## ![](lu-zap) Fast by default`
        expect(parse(heading(2, icon("zap"), text(" Fast by default"))).title).toBe("Fast by default");
    });

    it("keeps the marker of an icon inside the prose, its ordinal counting the leading one", () => {
        // `![](lu-home) Press ![](lu-save) to finish.`
        const out = parse(paragraph(icon("home"), text(" Press "), icon("save"), text(" to finish.")));
        expect(out.paragraphs).toEqual([`Press ${MARKER(1)} to finish.`]);
        expect(out.icons.map((i) => i.name)).toEqual(["home", "save"]);
    });
});
