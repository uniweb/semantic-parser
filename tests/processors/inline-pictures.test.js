/**
 * Inline pictures in prose — `As the figure ![Cells](./cells.jpg) shows`.
 *
 * A picture beside text stays in its paragraph (content-reader hoists only a
 * standalone one), so it is an inline atom like an icon: the paragraph's `text`
 * is an HTML string, the picture needs a component, and it rides as a
 * positional MARKER whose payload travels in `children`.
 *
 * Until 2026-10-18 it got the payload and not the marker — the icon's failure
 * of 2026-08-12, one node type over. The text kept a gap, `children` and
 * `content.images` carried the picture, and no renderer could put it back.
 *
 * The ordinal is the contract, as for icons: `data-index` counts the pictures
 * of the same content array in document order, which is the order
 * `processInlineElements()` appends them to `children` as `image` entries. A
 * consumer resolves one with `children.filter(c => c.type === 'image')[index]`.
 * An icon, a video and a file are not pictures, and do not take an ordinal.
 */
import { processSequence } from "../../src/processors/sequence.js";
import { parseContent } from "../../src/index.js";

const picture = (src, attrs = {}) => ({ type: "image", attrs: { src, alt: "", ...attrs } });
const icon = (name) => ({ type: "image", attrs: { role: "icon", library: "lu", name } });
const text = (t) => ({ type: "text", text: t });
const marker = (i) => `<uniweb-image data-index="${i}"></uniweb-image>`;

const paragraphOf = (...content) =>
    processSequence({
        type: "doc",
        content: [{ type: "paragraph", attrs: {}, content }],
    }).find((el) => el.type === "paragraph");

const picturesOf = (el) => (el.children || []).filter((c) => c.type === "image");

describe("inline pictures in a paragraph", () => {
    it("emits a positional marker where the picture sat", () => {
        const p = paragraphOf(text("As the figure "), picture("/cells.jpg", { alt: "Cells" }), text(" shows."));

        expect(p.text).toBe(`As the figure ${marker(0)} shows.`);
        expect(picturesOf(p)[0].attrs).toMatchObject({ url: "/cells.jpg", alt: "Cells" });
    });

    it("numbers pictures apart from icons, videos and files — each ordinal lands on its picture", () => {
        const p = paragraphOf(
            picture("/a.jpg"),
            text(" "),
            icon("house"),
            text(" "),
            picture("/v.mp4", { role: "video" }),
            text(" "),
            picture("/report.pdf", { role: "pdf" }),
            text(" "),
            picture("/b.jpg"),
        );

        expect(p.text).toBe(
            `${marker(0)} <uniweb-icon data-index="0"></uniweb-icon>   ${marker(1)}`,
        );
        // The lookup a renderer performs: an order mismatch draws the wrong picture.
        expect(picturesOf(p).map((c) => c.attrs.url)).toEqual(["/a.jpg", "/b.jpg"]);
    });

    it("marks a picture that is a paragraph's only content", () => {
        const p = paragraphOf(picture("/only.jpg"));

        expect(p.text).toBe(marker(0));
        expect(picturesOf(p)).toHaveLength(1);
    });

    it("carries the resolved address in children, never in the marker", () => {
        const doc = {
            type: "doc",
            content: [{
                type: "paragraph",
                content: [text("See "), picture("/stored/a1.jpg", { assetId: "a1", assetExt: "jpg" })],
            }],
        };
        const parsed = parseContent(doc, { assets: { url: "https://assets.example.test/{id}.{ext}" } });
        const p = parsed.sequence[0];

        expect(p.text).toBe(`See ${marker(0)}`);
        expect(picturesOf(p)[0].attrs.url).toBe("https://assets.example.test/a1.jpg");
        // The flat paragraphs carry the same marker — a string of HTML, where an
        // unknown empty element draws nothing.
        expect(parsed.paragraphs).toEqual([`See ${marker(0)}`]);
    });

    it("leaves a paragraph with no picture byte-for-byte unchanged", () => {
        const p = paragraphOf(text("Just prose, no atoms."));

        expect(p.text).toBe("Just prose, no atoms.");
    });
});
