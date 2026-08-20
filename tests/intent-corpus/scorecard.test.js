/**
 * Pins the parser's current output for every intent-corpus row.
 *
 * Green means "the scorecard is as recorded", NOT "every row matches its
 * intent" — rows where corpus.js's `intended` differs from the recording are
 * the documented open gaps. Any grouping-rule change that moves a row, in
 * either direction, fails here until the recording is regenerated and the
 * diff reviewed (see README.md).
 */
import { parseContent } from "../../src/index.js";
import { brief } from "./brief.js";
import { rows } from "./corpus.js";
import { recorded } from "./recorded.js";

describe("intent corpus — recorded scorecard", () => {
    for (const row of rows) {
        test(row.name, () => {
            expect(brief(parseContent(row.doc))).toEqual(recorded[row.name]);
        });
    }

    test("every row is recorded, and nothing is recorded twice", () => {
        expect(Object.keys(recorded).sort()).toEqual(
            rows.map((r) => r.name).sort()
        );
    });

    afterAll(() => {
        const gaps = rows
            .filter(
                (r) =>
                    r.intended &&
                    JSON.stringify(brief(parseContent(r.doc))) !==
                        JSON.stringify(r.intended)
            )
            .map((r) => r.name);
        console.info(
            `[intent-corpus] open gaps (${gaps.length}/${rows.length}): ${gaps.join(", ")}`
        );
    });
});
