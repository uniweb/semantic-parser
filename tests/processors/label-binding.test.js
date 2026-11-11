/**
 * Which block a `#>` label line names.
 *
 * A label names the block it opens. Before a title it is that title's
 * pretitle. After a title it names the same block when body, the end, or a
 * line of that headline follows it, and it is the next block's when it sits
 * straight above a heading that starts one. The same test decides where a
 * headline ends (`continuesHeadline`), so the label's binding and the block
 * boundary cannot disagree.
 *
 * ⛔ Until 2026-11-10 a label anywhere after a title named the title's block.
 * An entry's label written straight under a bodiless title became the
 * section's pretitle, and only the first entry lost its own.
 */

import { processGroups } from "../../src/processors/groups.js";
import { processSequence } from "../../src/processors/sequence.js";

const h = (level, text) => ({
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
});
/** A `#>` label line: a heading carrying role "pretitle". Its level means nothing. */
const label = (text, level = 1) => ({
    type: "heading",
    attrs: { level, role: "pretitle" },
    content: [{ type: "text", text }],
});
const p = (text) => ({ type: "paragraph", content: [{ type: "text", text }] });

const group = (content, options) => processGroups(processSequence({ type: "doc", content }), options);

describe("a label straight above an entry's heading is the entry's", () => {
    test("the first entry keeps its label under a bodiless title, as every later one does", () => {
        const result = group([
            h(1, "Team"),
            label("Professor"),
            h(3, "Ada Lovelace"),
            p("She wrote the first programs."),
            label("Student"),
            h(3, "Alan Turing"),
            p("He broke the codes."),
        ]);

        expect(result.title).toBe("Team");
        expect(result.pretitle).toBe("");
        expect(result.items.map((item) => item.pretitle)).toEqual(["Professor", "Student"]);
        expect(result.items.map((item) => item.title)).toEqual(["Ada Lovelace", "Alan Turing"]);
    });

    test("under a title and its subtitle", () => {
        const result = group([h(1, "Team"), h(2, "Our people"), label("Professor"), h(4, "Ada Lovelace"), p("Bio.")]);

        expect(result).toMatchObject({ title: "Team", subtitle: "Our people", pretitle: "" });
        expect(result.items[0]).toMatchObject({ pretitle: "Professor", title: "Ada Lovelace" });
    });

    test("several label lines go together, as a pretitle of several lines", () => {
        const result = group([h(1, "Team"), label("Faculty"), label("Professor"), h(3, "Ada Lovelace"), p("Bio.")]);

        expect(result.pretitle).toBe("");
        expect(result.items[0].pretitle).toEqual(["Faculty", "Professor"]);
    });

    test("with a positional pretitle under it, both lines are the entry's", () => {
        const result = group([h(1, "Team"), label("Faculty"), h(4, "Professor"), h(3, "Ada Lovelace"), p("Bio.")]);

        expect(result.pretitle).toBe("");
        expect(result.items[0]).toMatchObject({ pretitle: ["Faculty", "Professor"], title: "Ada Lovelace" });
    });

    test("in a tagged concept block, between two bodiless entries, it is the second one's", () => {
        const result = group([h(3, "Free"), label("Most popular"), h(3, "Pro"), p("Everything in Free.")], {
            alwaysItems: true,
        });

        expect(result.items.map((item) => item.title)).toEqual(["Free", "Pro"]);
        expect(result.items.map((item) => item.pretitle)).toEqual(["", "Most popular"]);
    });
});

describe("a label after a title names that title's block otherwise", () => {
    test("above body: an eyebrow written under its title", () => {
        const result = group([h(1, "Build the system."), label("Now shipping"), p("One content, many sites.")]);

        expect(result).toMatchObject({ pretitle: "Now shipping", title: "Build the system." });
        expect(result.items).toHaveLength(0);
    });

    test("at the end of the content", () => {
        expect(group([h(1, "Build the system."), label("Now shipping")]).pretitle).toBe("Now shipping");
    });

    test("above the headline's next line: the subtitle stays the subtitle", () => {
        const result = group([h(1, "Build the system."), label("Now shipping"), h(2, "Not every page."), p("Lead.")]);

        expect(result).toMatchObject({ pretitle: "Now shipping", title: "Build the system.", subtitle: "Not every page." });
        expect(result.items).toHaveLength(0);
    });

    test("a label never splits a headline: two bodiless lines of one size stay one title", () => {
        const result = group([h(3, "Fast"), label("New"), h(3, "and safe"), p("Body.")]);

        expect(result).toMatchObject({ pretitle: "New", title: ["Fast", "and safe"] });
    });
});
