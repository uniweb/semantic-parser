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
} from "../fixtures/groups.js";
import { processSequence } from "../../src/processors/sequence.js";

describe("processGroups", () => {
    test("handles divider-based groups", () => {
        const sequence = processSequence(dividerGroups);
        const result = processGroups(sequence);

        // expect(result.metadata.dividerMode).toBe(true);
        expect(result.main).toBeTruthy();
        expect(result.items).toHaveLength(2);
        // expect(result.metadata.groups).toBe(3);
    });

    test("handles heading-based groups", () => {
        const sequence = processSequence(headingGroups);
        const result = processGroups(sequence);

        expect(result.metadata.dividerMode).toBe(false);
        expect(result.main).toBeTruthy();
        expect(result.main.header.title).toBe("Features");
        expect(result.items).toHaveLength(2);
        expect(result.items[0].header.title).toBe("Feature One");
    });

    test("correctly processes nested headings", () => {
        const sequence = processSequence(nestedHeadings);
        const result = processGroups(sequence);

        expect(result.main).toBeTruthy();
        expect(result.main.header.pretitle).toBe("WELCOME");
        expect(result.main.header.title).toBe("Main Title");
        expect(result.main.header.subtitle).toBe("Subtitle");
        expect(result.main.header.subtitle2).toBe("Subsubtitle");
    });

    test("handles multiple H1s by not creating main content", () => {
        const sequence = processSequence(multipleH1s);
        const result = processGroups(sequence);

        expect(result.main).toBeNull();
        expect(result.items).toHaveLength(2);
        expect(result.items[0].header.title).toBe("First H1");
        expect(result.items[1].header.title).toBe("Second H1");
    });

    test("handles Resume Pattern (H1 -> H2 Item -> H2 Item)", () => {
        // Case: H2s should NOT merge into H1, because they are peers (siblings)
        const sequence = processSequence(academicExperience);
        const result = processGroups(sequence);

        expect(result.main).toBeTruthy();
        expect(result.main.header.title).toBe("Academic Experience");
        // Should NOT have "Ph.D. in CS" as subtitle
        expect(result.main.header.subtitle).not.toBe("Ph.D. in CS");

        // The H2s should become separate items
        expect(result.items).toHaveLength(2);
        expect(result.items[0].header.title).toBe("Ph.D. in CS");
        expect(result.items[0].header.subtitle).toBe("2014-2018"); // H3 becomes subtitle of item
        expect(result.items[1].header.title).toBe("Masters in Data");
    });

    test("handles 'Leaf vs Branch' heuristic (H1 -> H2 Subtitle -> H2 Item)", () => {
        // Case: First H2 is a "Leaf" (no kids), Second H2 is a "Branch" (has H3 kids)
        // Expected: First H2 merges into Main. Second H2 starts new Item.
        const sequence = processSequence(subtitleAndItems);
        const result = processGroups(sequence);

        expect(result.main).toBeTruthy();
        expect(result.main.header.title).toBe("Work History");
        expect(result.main.header.subtitle).toBe("A summary of my roles."); // MERGED

        expect(result.items).toHaveLength(2);
        expect(result.items[0].header.title).toBe("Google"); // SPLIT
        expect(result.items[0].header.subtitle).toBe("2020-Present");
    });

    test("handles complex hierarchy (Pretitle + H1 + Subtitle + Items)", () => {
        const sequence = processSequence(complexHierarchy);
        const result = processGroups(sequence);

        expect(result.main).toBeTruthy();

        // Check Pretitle merging
        expect(result.main.header.pretitle).toBe("INTRO");
        expect(result.main.header.title).toBe("About Me");

        // Check Subtitle merging (Leaf H2)
        expect(result.main.header.subtitle).toBe("Short Bio");

        // Check Items (Branch H2)
        expect(result.items).toHaveLength(1);
        expect(result.items[0].header.title).toBe("My Hobbies");
        expect(result.items[0].header.subtitle).toBe("Reading");
    });

    test("handles simple lists with no main container", () => {
        // Case: Just H2 -> H2. No H1 to act as parent.
        const sequence = processSequence(simpleList);
        const result = processGroups(sequence);

        // Should not try to force the first item to be "Main"
        // because both items are Level 2 (Peers).
        expect(result.main).toBeNull();
        expect(result.items).toHaveLength(2);
        expect(result.items[0].header.title).toBe("Apple");
        expect(result.items[1].header.title).toBe("Banana");
    });

    test("handles skipped levels (H1 -> H3 -> H3)", () => {
        const sequence = processSequence(skippedLevels);
        const result = processGroups(sequence);

        expect(result.main).toBeTruthy();
        expect(result.items).toHaveLength(2); // Should treat H3s as items
        expect(result.items[0].header.title).toBe("JavaScript");
    });
});
