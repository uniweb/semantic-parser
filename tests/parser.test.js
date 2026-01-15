import { parseContent } from "../src/index.js";
import {
    simpleDocument,
    withPretitle,
    withFormattedText,
    withImage,
} from "./fixtures/basic.js";

describe("parseContent", () => {
    test("handles simple document structure", () => {
        const result = parseContent(simpleDocument);

        // Check sequence
        expect(result.sequence).toHaveLength(2);
        expect(result.sequence[0].type).toBe("heading");
        expect(result.sequence[1].type).toBe("paragraph");

        // Check groups
        expect(result.groups.main).toBeTruthy();
        expect(result.groups.main.header.title).toBe("Main Title");

        // Check byType
        expect(result.byType.headings).toHaveLength(1);
        expect(result.byType.paragraphs).toHaveLength(1);
    });

    // test("correctly identifies pretitle", () => {
    //   const result = parseContent(withPretitle);

    //   expect(result.groups.main.header.pretitle).toBeTruthy();
    //   expect(result.groups.main.header.pretitle).toBe("PRETITLE");
    //   expect(result.groups.main.header.title).toBe("Main Title");
    // });

    // test("preserves text formatting", () => {
    //   const result = parseContent(withFormattedText);

    //   const paragraph = result.sequence[0];
    //   expect(paragraph.content).toBe("Normal <strong>bold</strong> and <em>italic</em> text.");
    // });

    // test("handles images with roles", () => {
    //   const result = parseContent(withImage);

    //   expect(result.byType.images.background).toHaveLength(1);
    //   expect(result.byType.metadata.hasMedia).toBe(true);
    // });
});
