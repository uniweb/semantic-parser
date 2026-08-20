/**
 * Regenerate the recorded scorecard from the CURRENT parser:
 *
 *   node tests/intent-corpus/generate.js > tests/intent-corpus/recorded.js
 *
 * Run this after any deliberate grouping-rule change, then review the diff
 * row by row before committing it (see README.md).
 */
import { parseContent } from "../../src/index.js";
import { brief } from "./brief.js";
import { rows } from "./corpus.js";

const lines = [];
lines.push("/**");
lines.push(" * GENERATED — the parser's current output for every corpus row, through the");
lines.push(" * brief.js lens. Regenerate with:");
lines.push(" *");
lines.push(" *   node tests/intent-corpus/generate.js > tests/intent-corpus/recorded.js");
lines.push(" *");
lines.push(" * Never hand-edit: a rule change must show up here as a reviewed diff.");
lines.push(" */");
lines.push("export const recorded = {");
for (const row of rows) {
    const value = JSON.stringify(brief(parseContent(row.doc)), null, 4)
        .split("\n")
        .map((l, i) => (i === 0 ? l : "    " + l))
        .join("\n");
    lines.push(`    "${row.name}": ${value},`);
}
lines.push("};");

process.stdout.write(lines.join("\n") + "\n");
