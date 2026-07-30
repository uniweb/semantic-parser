/**
 * `alwaysItems` — the grouping a tagged concept block always uses, and the
 * default path it must never disturb.
 *
 * Two halves, and the second is the one that matters more.
 *
 * The FIRST half pins what the option does: every heading group becomes an
 * item, which takes two suppressions rather than one. Title promotion is the
 * obvious half; the same-level heading merge happens a frame earlier, during
 * group FORMATION, and no amount of suppressing promotion downstream can split
 * a group that was never split. Getting only the first produces a fix that
 * looks complete and leaves bodiless headings collapsed into one merged title.
 *
 * The SECOND half pins the DEFAULT path, unchanged. This parser runs JIT — at
 * render time and at editor time — and nothing derived is ever stored, so there
 * is no saved items array holding the old reading of anything. A grouping rule
 * that leaked out of this option would re-interpret every document that already
 * exists, silently. The editor keeps its own conformance vectors over the same
 * default path for the same reason; these are this side's copy of that bound.
 */

import { processGroups } from "../../src/processors/groups.js";
import { processSequence } from "../../src/processors/sequence.js";

/** A heading node at `level` carrying `text`. */
const h = (level, text) => ({
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
});

/** A paragraph node carrying `text`. */
const p = (text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
});

/** Group a doc's content, with or without the suppressions. */
const group = (content, options) =>
    processGroups(processSequence({ type: "doc", content }), options);

const ITEMS = { alwaysItems: true };

describe("alwaysItems — every group is an item", () => {
    test("a lone heading+body pair becomes ONE item, not a titled main block", () => {
        // The single-question FAQ. On the default path this pair IS the main
        // content and yields no items at all.
        const doc = [h(1, "Q1"), p("A1")];

        expect(group(doc).items).toHaveLength(0);

        const result = group(doc, ITEMS);
        expect(result.title).toBe("");
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe("Q1");
        expect(result.items[0].paragraphs).toEqual(["A1"]);
    });

    test("bodiless headings stay SEPARATE items — the merge is suppressed too", () => {
        // The suppression that lives in group formation. Without it these two
        // headings merge into one group carrying a title ARRAY, and forcing
        // title promotion off cannot recover them: there is only one group to
        // hand back.
        const doc = [h(1, "Q1"), h(1, "Q2")];

        expect(group(doc).title).toEqual(["Q1", "Q2"]);
        expect(group(doc).items).toHaveLength(0);

        const result = group(doc, ITEMS);
        expect(result.items).toHaveLength(2);
        expect(result.items.map((i) => i.title)).toEqual(["Q1", "Q2"]);
        expect(Array.isArray(result.items[0].title)).toBe(false);
    });

    test("three bodiless headings are three items", () => {
        const doc = [h(1, "Q1"), h(1, "Q2"), h(1, "Q3")];

        expect(group(doc).items).toHaveLength(0);
        expect(group(doc, ITEMS).items.map((i) => i.title)).toEqual(["Q1", "Q2", "Q3"]);
    });

    test("the ordinary multi-pair case is unchanged by the option", () => {
        // The path that already worked. `identifyMainContent` declines to
        // promote because the two groups sit at the same heading level, so the
        // option has nothing left to suppress — it must not perturb this.
        const doc = [h(1, "Q1"), p("A1"), h(1, "Q2"), p("A2")];

        for (const opts of [undefined, ITEMS]) {
            const result = group(doc, opts);
            expect(result.title).toBe("");
            expect(result.items).toHaveLength(2);
            expect(result.items.map((i) => i.title)).toEqual(["Q1", "Q2"]);
        }
    });

    test("a leading intro becomes a titleless FIRST item", () => {
        // A behaviour change, stated rather than discovered: on the default
        // path body content before the first heading is promoted to main.
        const doc = [p("Intro."), h(1, "Q1"), p("A1")];

        expect(group(doc).paragraphs).toEqual(["Intro."]);

        const result = group(doc, ITEMS);
        expect(result.paragraphs).toEqual([]);
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("");
        expect(result.items[0].paragraphs).toEqual(["Intro."]);
        expect(result.items[1].title).toBe("Q1");
    });

    test("a body with NO headings is one titleless item — that is a callout", () => {
        // ```md:warning has no headings in it. It needs no second parse mode:
        // the whole body forms one group, which the suppression hands back as
        // a single item. The degenerate case of the rule, not an exception.
        const doc = [p("Back up your database first."), p("It is not reversible.")];

        expect(group(doc).items).toHaveLength(0);

        const result = group(doc, ITEMS);
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe("");
        expect(result.items[0].paragraphs).toEqual([
            "Back up your database first.",
            "It is not reversible.",
        ]);
    });

    test("a heading gives a callout a title, at no cost", () => {
        const doc = [h(1, "Heads up"), p("Back up first.")];
        const result = group(doc, ITEMS);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe("Heads up");
    });

    test("subtitles still group — only SAME-level merging is suppressed", () => {
        // Case 1 (exactly one level deeper) and Case 2 (pretitle promotion) are
        // untouched: an item with a subtitle is a good item. Suppressing them
        // too would flatten every heading into its own bodiless item.
        const doc = [h(1, "Q1"), h(2, "clarified"), p("A1"), h(1, "Q2"), p("A2")];
        const result = group(doc, ITEMS);

        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Q1");
        expect(result.items[0].subtitle).toBe("clarified");
        expect(result.items[1].title).toBe("Q2");
    });

    test("empty content yields no items under either setting", () => {
        expect(group([], ITEMS).items).toEqual([]);
        expect(group([]).items).toEqual([]);
    });
});

describe("the DEFAULT path is unchanged — the retroactive-reinterpretation guard", () => {
    // Every row of the behaviour measured before this option existed. A change
    // here is not a test to update: it means a suppression leaked into the
    // default path and every already-authored section body just changed shape.
    const CASES = [
        {
            name: "3 heading+body pairs",
            doc: [h(1, "Q1"), p("A1"), h(1, "Q2"), p("A2"), h(1, "Q3"), p("A3")],
            title: "",
            items: 3,
        },
        {
            name: "2 heading+body pairs",
            doc: [h(1, "Q1"), p("A1"), h(1, "Q2"), p("A2")],
            title: "",
            items: 2,
        },
        {
            name: "2 pairs at H2",
            doc: [h(2, "Q1"), p("A1"), h(2, "Q2"), p("A2")],
            title: "",
            items: 2,
        },
        {
            name: "intro paragraph then 2 pairs",
            doc: [p("Intro"), h(1, "Q1"), p("A1"), h(1, "Q2"), p("A2")],
            title: "",
            items: 2,
        },
        {
            name: "1 pair — promoted to main, no items",
            doc: [h(1, "Q1"), p("A1")],
            title: "Q1",
            items: 0,
        },
        {
            name: "2 bodiless headings — merged title array, no items",
            doc: [h(1, "Q1"), h(1, "Q2")],
            title: ["Q1", "Q2"],
            items: 0,
        },
        {
            name: "3 bodiless headings — merged title array, no items",
            doc: [h(1, "Q1"), h(1, "Q2"), h(1, "Q3")],
            title: ["Q1", "Q2", "Q3"],
            items: 0,
        },
    ];

    test.each(CASES)("$name", ({ doc, title, items }) => {
        const result = group(doc);
        expect(result.title).toEqual(title);
        expect(result.items).toHaveLength(items);
    });
});

describe("concept_block — the derived payload", () => {
    const conceptDoc = (tag, content) => ({
        type: "doc",
        content: [{ type: "concept_block", attrs: { tag }, content }],
    });

    test("lands under its tag as { items, sequence }", () => {
        const doc = conceptDoc("faq", [h(1, "Q1"), p("A1"), h(1, "Q2"), p("A2")]);
        const result = processGroups(processSequence(doc));

        expect(Object.keys(result.data)).toEqual(["faq"]);
        expect(result.data.faq.items.map((i) => i.title)).toEqual(["Q1", "Q2"]);
        expect(result.data.faq.sequence.map((e) => e.type)).toEqual([
            "heading", "paragraph", "heading", "paragraph",
        ]);
    });

    test("sequence survives exactly where items collapses", () => {
        // Why the payload carries both. Anything rendering a concept it does
        // not recognize has to read `sequence`: `items` is a bucketed
        // flattening that discards ordering, and here it is empty while the
        // content plainly exists.
        const doc = conceptDoc("faq", [h(1, "Q1"), h(1, "Q2")]);
        const { data } = processGroups(processSequence(doc));

        // With the suppressions the items DO survive here — that is the fix.
        expect(data.faq.items).toHaveLength(2);
        // And the raw ordering is available regardless of how grouping read it.
        expect(data.faq.sequence).toHaveLength(2);
    });

    test("the block's shape is fixed by its fence, not by the outer document", () => {
        // The scoping that keeps the suppressions from leaking. A single pair
        // inside a concept block is one ITEM even though the surrounding doc is
        // parsed on the default path, where a single pair would be promoted.
        const doc = conceptDoc("faq", [h(1, "Only question"), p("Only answer")]);
        const { data } = processGroups(processSequence(doc));

        expect(data.faq.items).toHaveLength(1);
        expect(data.faq.items[0].title).toBe("Only question");
    });

    test("a headingless block is one titleless item — the callout shape", () => {
        const doc = conceptDoc("warning", [p("Back up first.")]);
        const { data } = processGroups(processSequence(doc));

        expect(data.warning.items).toHaveLength(1);
        expect(data.warning.items[0].title).toBe("");
        expect(data.warning.items[0].paragraphs).toEqual(["Back up first."]);
    });

    test("the tag is opaque — no name is special", () => {
        // If this needs updating because some tag behaves differently, a
        // concept registry has grown where there must not be one.
        for (const tag of ["faq", "warning", "steps", "made-up"]) {
            const doc = conceptDoc(tag, [h(1, "T"), p("B")]);
            const { data } = processGroups(processSequence(doc));
            expect(data[tag].items).toHaveLength(1);
        }
    });

    test("shares the data namespace with tagged data blocks", () => {
        const doc = {
            type: "doc",
            content: [
                { type: "dataBlock", attrs: { tag: "nav", language: "yaml", data: [{ label: "Home" }] } },
                { type: "concept_block", attrs: { tag: "faq" }, content: [h(1, "Q"), p("A")] },
            ],
        };
        const { data } = processGroups(processSequence(doc));

        expect(data.nav).toEqual([{ label: "Home" }]);
        expect(data.faq.items).toHaveLength(1);
    });
});
