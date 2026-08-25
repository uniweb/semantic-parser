/**
 * `lintContent` scored against the intent corpus.
 *
 * The lint's job is to name the shapes that usually mean a misfire without
 * ever touching the parse. Scoring it against the same corpus that scores the
 * grouping rules keeps both honest: every gap row should draw a finding where
 * a finding is possible, every correct row should stay silent — and the one
 * deliberate exception is recorded here as a cost, not hidden.
 *
 * `subtitle-and-peer-cards` is that exception: correct content that draws the
 * `first-entry-or-subtitle` HINT, because a platform hero and a question list
 * are byte-identical shapes. The hint's wording carries both readings; the
 * false-fire is the price of catching the most common naive spellings
 * (faq-adjacent, stats-adjacent, features-h2-no-lead). If this trade ever
 * changes, change it here consciously.
 */
import { lintContent } from "../src/index.js";
import { rows } from "./intent-corpus/corpus.js";

const EXPECTED = {
    "hero-full": [],
    "hero-minimal": [],
    "faq-adjacent": ["first-entry-or-subtitle"],
    "faq-with-lead": [],
    "stats-adjacent": ["first-entry-or-subtitle"],
    "features-lead": [],
    "features-h2-no-lead": ["first-entry-or-subtitle"],
    "cards-no-main": [],
    "bodiless-cards": ["merged-title-run"],
    "roster-two-level": ["entry-joined-headline"],
    "faq-categories": ["entry-joined-headline"],
    "resume-adjacent": ["entry-joined-headline"],
    "subtitle-then-items": ["entry-joined-headline"],
    "subtitle-and-peer-cards": ["first-entry-or-subtitle"], // documented false-fire
    "paragraph-eyebrow": ["label-as-text"],
    "stacked-pretitle": [],
    "descending-pretitle-stack": [],
    "pricing-tiers": [],
    "single-item": [], // truly ambiguous with hero-minimal; nothing to key on
    "docs-outline": [],
    "three-line-header": [],
    "event-cover": [],
    "stepped-items-under-subtitle": [],
    "label-on-item": [],
    "label-untitled": [],
};

describe("lintContent — scored against the intent corpus", () => {
    for (const row of rows) {
        test(`${row.name} → [${EXPECTED[row.name]?.join(", ") ?? "?"}]`, () => {
            expect(EXPECTED[row.name], `no expectation recorded for ${row.name}`).toBeDefined();
            const findings = lintContent(row.doc);
            expect(findings.map((f) => f.rule)).toEqual(EXPECTED[row.name]);
        });
    }

    test("every corpus row has a lint expectation", () => {
        expect(Object.keys(EXPECTED).sort()).toEqual(rows.map((r) => r.name).sort());
    });

    test("warnings and hints carry the offending text and a spelling to reach for", () => {
        const roster = rows.find((r) => r.name === "roster-two-level");
        const [finding] = lintContent(roster.doc);
        expect(finding.severity).toBe("warning");
        expect(finding.message).toContain("Our Team");
        expect(finding.message).toContain("two sizes below");

        const eyebrow = rows.find((r) => r.name === "paragraph-eyebrow");
        const [labelFinding] = lintContent(eyebrow.doc);
        expect(labelFinding.severity).toBe("warning");
        expect(labelFinding.message).toContain("#> NEW");
    });

    test("intro text above the first heading stays silent — only short label-like lines fire", () => {
        const doc = {
            type: "doc",
            content: [
                {
                    type: "paragraph",
                    content: [{ type: "text", text: "Three teams, one launch date. Here's how it went." }],
                },
                { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Week one" }] },
                { type: "paragraph", content: [{ type: "text", text: "We scoped the work." }] },
            ],
        };
        expect(lintContent(doc)).toEqual([]);
    });

    test("findings never mutate the parse — lint is observation only", () => {
        const roster = rows.find((r) => r.name === "roster-two-level");
        const before = JSON.stringify(roster.doc);
        lintContent(roster.doc);
        expect(JSON.stringify(roster.doc)).toBe(before);
    });
});
