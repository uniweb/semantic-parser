/**
 * Inline icons in prose — `Click the ![](lu-save) button`.
 *
 * An icon sitting IN a sentence is the third inline atom this parser handles,
 * after inline math and inline insets. All three share one mechanism: the
 * paragraph's `text` is an HTML string, so an atom that needs a React component
 * rides as a positional MARKER which the renderer swaps out, and the payload
 * travels beside it in `children`.
 *
 * Icons were the one atom that got the payload and not the marker. The text kept
 * a GAP where the icon had been, `children` and `content.icons` both carried the
 * entry, and no renderer could put it back — so the icon silently vanished from
 * the rendered page while every check that looks at words stayed green. That is
 * the failure this file pins.
 *
 * The ordinal is the contract: the marker's `data-index` counts icons within the
 * same content array, in document order, which is the order
 * `processInlineElements()` appends them to `children`. A consumer resolves one
 * with `children.filter(c => c.type === 'icon')[index]`. Referencing by ordinal
 * rather than serialising attrs keeps an inline `svg` blob out of the text
 * stream and leaves `children` the single source of truth.
 */
import { processSequence } from "../../src/processors/sequence.js";

const icon = (name, attrs = {}) => ({
    type: "image",
    attrs: { role: "icon", library: "lu", name, ...attrs },
});
const text = (t) => ({ type: "text", text: t });

const paragraphOf = (...content) =>
    processSequence({
        type: "doc",
        content: [{ type: "paragraph", attrs: {}, content }],
    }).find((el) => el.type === "paragraph");

const iconsOf = (el) => (el.children || []).filter((c) => c.type === "icon");

describe("inline icons in a paragraph", () => {
    it("emits a positional marker where the icon sat", () => {
        const p = paragraphOf(text("Click the "), icon("save"), text(" button."));

        expect(p.text).toBe(
            'Click the <uniweb-icon data-index="0"></uniweb-icon> button.',
        );
    });

    it("carries the icon payload in children, not in the marker", () => {
        const p = paragraphOf(text("Click "), icon("save", { color: "#f00" }));
        const [only] = iconsOf(p);

        expect(only.attrs).toMatchObject({
            library: "lu",
            name: "save",
            color: "#f00",
        });
        // The marker stays a bare ordinal — no attrs duplicated into the text.
        expect(p.text).toContain('<uniweb-icon data-index="0"></uniweb-icon>');
    });

    it("numbers several icons in document order, matching children", () => {
        const p = paragraphOf(
            text("Press "),
            icon("home"),
            text(" then "),
            icon("save"),
            text(" to finish."),
        );

        expect(p.text).toBe(
            'Press <uniweb-icon data-index="0"></uniweb-icon> then ' +
                '<uniweb-icon data-index="1"></uniweb-icon> to finish.',
        );

        // The ordinal must index the icons of `children` — this is the lookup a
        // renderer performs, so an order mismatch here renders the wrong glyph.
        expect(iconsOf(p).map((c) => c.attrs.name)).toEqual(["home", "save"]);
    });

    it("keeps the surrounding marks intact", () => {
        const p = paragraphOf(
            { type: "text", text: "Bold", marks: [{ type: "bold" }] },
            text(" "),
            icon("save"),
        );

        expect(p.text).toBe(
            '<strong>Bold</strong> <uniweb-icon data-index="0"></uniweb-icon>',
        );
    });

    it("marks an icon in a heading too, without disturbing the text", () => {
        const [heading] = processSequence({
            type: "doc",
            content: [
                {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [icon("zap"), text(" Fast by default")],
                },
            ],
        });

        expect(heading.type).toBe("heading");
        expect(heading.text).toBe(
            '<uniweb-icon data-index="0"></uniweb-icon> Fast by default',
        );
        expect(iconsOf(heading)).toHaveLength(1);
    });

    it("leaves a paragraph with no icons byte-for-byte unchanged", () => {
        const p = paragraphOf(text("Just prose, no atoms."));

        expect(p.text).toBe("Just prose, no atoms.");
        expect(p.text).not.toContain("uniweb-icon");
    });
});
