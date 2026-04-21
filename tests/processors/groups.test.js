import { processGroups } from "../../src/processors/groups.js";
import {
    dividerGroups,
    headingGroups,
    nestedHeadings,
    multipleH1s,
    academicExperience,
    subtitleAndItems,
    complexHierarchy,
    simpleList,
    skippedLevels,
    taggedJsonBlocks,
    taggedYamlBlocks,
    untaggedCodeBlocks,
    mixedCodeBlocks,
    bodyBeforeHeadings,
    consecutiveH1s,
    consecutiveH1sWithSubtitle,
    pretitleWithConsecutiveH1s,
    consecutiveH3Items,
    skippedLevelConsecutive,
    skippedLevelH2toH4,
} from "../fixtures/groups.js";
import { processSequence } from "../../src/processors/sequence.js";

describe("processGroups", () => {
    test("handles divider-based groups", () => {
        const sequence = processSequence(dividerGroups);
        const result = processGroups(sequence);

        // First group becomes main (flat at root)
        expect(result.title).toBeTruthy();
        expect(result.items).toHaveLength(2);
    });

    test("handles heading-based groups", () => {
        const sequence = processSequence(headingGroups);
        const result = processGroups(sequence);

        // Main content is now flat at root level
        expect(result.title).toBe("Features");
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Feature One");
    });

    test("correctly processes nested headings", () => {
        const sequence = processSequence(nestedHeadings);
        const result = processGroups(sequence);

        // Flat structure at root
        expect(result.pretitle).toBe("WELCOME");
        expect(result.title).toBe("Main Title");
        expect(result.subtitle).toBe("Subtitle");
        expect(result.headings[0]).toBe("Subsubtitle");
    });

    test("handles multiple H1s by not creating main content", () => {
        const sequence = processSequence(multipleH1s);
        const result = processGroups(sequence);

        // No main means empty root title, all content in items
        expect(result.title).toBe("");
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("First H1");
        expect(result.items[1].title).toBe("Second H1");
    });

    test("handles Resume Pattern (H1 -> H2 Item -> H2 Item)", () => {
        // Case: H2s should NOT merge into H1, because they are peers (siblings)
        const sequence = processSequence(academicExperience);
        const result = processGroups(sequence);

        expect(result.title).toBe("Academic Experience");
        // Should NOT have "Ph.D. in CS" as subtitle
        expect(result.subtitle).not.toBe("Ph.D. in CS");

        // The H2s should become separate items
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Ph.D. in CS");
        expect(result.items[0].subtitle).toBe("2014-2018"); // H3 becomes subtitle of item
        expect(result.items[1].title).toBe("Masters in Data");
    });

    test("handles 'Leaf vs Branch' heuristic (H1 -> H2 Subtitle -> H2 Item)", () => {
        // Case: First H2 is a "Leaf" (no kids), Second H2 is a "Branch" (has H3 kids)
        // Expected: First H2 merges into Main. Second H2 starts new Item.
        const sequence = processSequence(subtitleAndItems);
        const result = processGroups(sequence);

        expect(result.title).toBe("Work History");
        expect(result.subtitle).toBe("A summary of my roles."); // MERGED

        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Google"); // SPLIT
        expect(result.items[0].subtitle).toBe("2020-Present");
    });

    test("handles complex hierarchy (Pretitle + H1 + Subtitle + Items)", () => {
        const sequence = processSequence(complexHierarchy);
        const result = processGroups(sequence);

        // Check Pretitle merging
        expect(result.pretitle).toBe("INTRO");
        expect(result.title).toBe("About Me");

        // Check Subtitle merging (Leaf H2)
        expect(result.subtitle).toBe("Short Bio");

        // Check Items (Branch H2)
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe("My Hobbies");
        expect(result.items[0].subtitle).toBe("Reading");
    });

    test("handles simple lists with no main container", () => {
        // Case: Just H2 -> H2. No H1 to act as parent.
        const sequence = processSequence(simpleList);
        const result = processGroups(sequence);

        // Should not try to force the first item to be "Main"
        // because both items are Level 2 (Peers).
        expect(result.title).toBe("");
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Apple");
        expect(result.items[1].title).toBe("Banana");
    });

    test("handles divider-separated skipped levels (H1 --- H3 H3)", () => {
        const sequence = processSequence(skippedLevels);
        const result = processGroups(sequence);

        expect(result.title).toBe("Skills");
        // Divider separates H1 from H3s; consecutive same-level H3s
        // merge into a single item title array
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toEqual(["JavaScript", "Python"]);
    });

    test("routes tagged JSON code blocks to data object", () => {
        const sequence = processSequence(taggedJsonBlocks);
        const result = processGroups(sequence);

        expect(result.title).toBe("Navigation");
        expect(result.data).toBeDefined();
        expect(result.data["nav-links"]).toEqual([
            { label: "Home", href: "/" },
            { label: "About", href: "/about" },
        ]);
        expect(result.data["settings"]).toEqual({
            theme: "dark",
            showLogo: true,
        });
    });

    test("routes tagged YAML code blocks to data object", () => {
        const sequence = processSequence(taggedYamlBlocks);
        const result = processGroups(sequence);

        expect(result.title).toBe("Config");
        expect(result.data["site-config"]).toEqual({
            title: "My Site",
            theme: "dark",
            features: ["seo", "analytics"],
        });
    });

    test("untagged code blocks are not parsed as data", () => {
        const sequence = processSequence(untaggedCodeBlocks);
        const result = processGroups(sequence);

        expect(result.title).toBe("Example");
        // Untagged blocks don't go to data
        expect(result.data).toEqual({});
        // They stay in sequence for display
        expect(result.sequence).toBeUndefined(); // sequence is at parser level, not groups
    });

    test("handles mixed tagged and untagged code blocks", () => {
        const sequence = processSequence(mixedCodeBlocks);
        const result = processGroups(sequence);

        expect(result.title).toBe("Component");
        // Tagged goes to data (parsed)
        expect(result.data["team-member"]).toEqual({
            name: "Sarah",
            role: "Engineer",
        });
        // Untagged does NOT go to data
        expect(Object.keys(result.data)).toHaveLength(1);
    });

    test("promotes body content before first heading to main content", () => {
        const sequence = processSequence(bodyBeforeHeadings);
        const result = processGroups(sequence);

        // Tagline paragraph should be main content, not an empty-titled first item
        expect(result.title).toBe("");
        expect(result.paragraphs.length).toBeGreaterThan(0);
        expect(result.paragraphs[0]).toContain("Tagline");

        // H3s become items
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Column 1");
        expect(result.items[1].title).toBe("Column 2");
    });

    test("merges consecutive same-level headings into title array", () => {
        const sequence = processSequence(consecutiveH1s);
        const result = processGroups(sequence);

        expect(result.title).toEqual(["Build the future", "with confidence"]);
        expect(result.paragraphs[0]).toContain("The platform for modern teams.");
        expect(result.items).toHaveLength(0);
    });

    test("merges consecutive H1s with H2 subtitle", () => {
        const sequence = processSequence(consecutiveH1sWithSubtitle);
        const result = processGroups(sequence);

        expect(result.title).toEqual(["Build the future", "with confidence"]);
        expect(result.subtitle).toBe("The platform for modern teams");
    });

    test("handles pretitle with consecutive H1s", () => {
        const sequence = processSequence(pretitleWithConsecutiveH1s);
        const result = processGroups(sequence);

        expect(result.pretitle).toBe("Our Mission");
        expect(result.title).toEqual(["Build the future", "with confidence"]);
    });

    test("merges consecutive same-level H3s in items", () => {
        const sequence = processSequence(consecutiveH3Items);
        const result = processGroups(sequence);

        expect(result.title).toBe("Features");
        expect(result.items).toHaveLength(2);
        // First item: two consecutive H3s merged into title array
        expect(result.items[0].title).toEqual(["Fast", "Blazing fast"]);
        expect(result.items[0].paragraphs[0]).toContain("Speed is our priority.");
        // Second item: single H3
        expect(result.items[1].title).toBe("Secure");
    });

    test("does not group headings that skip levels (H1 -> H3)", () => {
        const sequence = processSequence(skippedLevelConsecutive);
        const result = processGroups(sequence);

        expect(result.title).toBe("Features");
        expect(result.subtitle).toBe(""); // H3 NOT grouped as subtitle
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Speed");
        expect(result.items[0].paragraphs[0]).toContain("blazingly fast");
        expect(result.items[1].title).toBe("Security");
        expect(result.items[1].paragraphs[0]).toContain("Enterprise-grade");
    });

    test("does not group headings that skip levels (H2 -> H4)", () => {
        const sequence = processSequence(skippedLevelH2toH4);
        const result = processGroups(sequence);

        expect(result.title).toBe("Overview");
        expect(result.subtitle).toBe("");
        expect(result.items).toHaveLength(2);
        expect(result.items[0].title).toBe("Detail A");
        expect(result.items[1].title).toBe("Detail B");
    });

    describe("form (FormBlock routing)", () => {
        test("routes form data to data[schemaId] when schemaId is present", () => {
            const sequence = [
                { type: "heading", level: 1, text: "Hero", children: [], attrs: { level: 1 } },
                {
                    type: "form",
                    schemaId: "stats",
                    data: [{ number: "42", text: "Users" }],
                    attrs: {},
                },
            ];
            const result = processGroups(sequence);
            expect(result.data.stats).toEqual([{ number: "42", text: "Users" }]);
            expect(result.data.form).toBeUndefined();
        });

        test("falls back to data.form when schemaId is missing (legacy content)", () => {
            const sequence = [
                { type: "heading", level: 1, text: "Hero", children: [], attrs: { level: 1 } },
                {
                    type: "form",
                    schemaId: null,
                    data: { for: "scholar" },
                    attrs: {},
                },
            ];
            const result = processGroups(sequence);
            expect(result.data.form).toEqual({ for: "scholar" });
        });

        test("multiple FormBlocks with different schemaIds land at distinct keys", () => {
            const sequence = [
                { type: "heading", level: 1, text: "Hero", children: [], attrs: { level: 1 } },
                { type: "form", schemaId: "stats", data: [{ number: "10" }], attrs: {} },
                { type: "form", schemaId: "side-content", data: { for: "news" }, attrs: {} },
            ];
            const result = processGroups(sequence);
            expect(result.data.stats).toEqual([{ number: "10" }]);
            expect(result.data["side-content"]).toEqual({ for: "news" });
        });
    });

    test("child_block does not appear in images, icons, or links", () => {
        const sequence = [
            { type: "heading", level: 1, text: "Title", children: [], attrs: { level: 1 } },
            { type: "paragraph", text: "Some content", children: [], attrs: undefined },
            { type: "child_block", refId: "inline_0" },
            { type: "image", attrs: { src: "photo.jpg", role: "image" } },
        ];
        const result = processGroups(sequence);

        expect(result.title).toBe("Title");
        expect(result.images).toHaveLength(1);
        expect(result.images[0].src).toBe("photo.jpg");
        // child_block should NOT be in images, icons, links, or paragraphs
        expect(result.icons).toHaveLength(0);
        expect(result.links).toHaveLength(0);
    });
});
