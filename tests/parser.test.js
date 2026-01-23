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

        // Check flat content structure
        expect(result.title).toBe("Main Title");
        expect(result.paragraphs).toHaveLength(1);
        expect(result.items).toEqual([]);
    });

    // test("correctly identifies pretitle", () => {
    //   const result = parseContent(withPretitle);

    //   expect(result.pretitle).toBe("PRETITLE");
    //   expect(result.title).toBe("Main Title");
    // });

    // test("preserves text formatting", () => {
    //   const result = parseContent(withFormattedText);

    //   const paragraph = result.sequence[0];
    //   expect(paragraph.content).toBe("Normal <strong>bold</strong> and <em>italic</em> text.");
    // });
});
