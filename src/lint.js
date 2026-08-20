/**
 * @fileoverview Content lint — diagnose grouping near-misses.
 *
 * The grouping rules are deterministic, but a handful of authored shapes are
 * genuinely ambiguous: the same markdown can mean two things, and whichever
 * reading the parser takes, an author who meant the other gets a silently
 * reshaped section. Parsing never guesses; THIS module is where the judgment
 * lives — it looks at a document the way a reviewer would and names the shapes
 * that usually indicate a misfire, without ever changing the parse.
 *
 * Severities:
 * - "warning" — the shape almost always means a misfire (measured across the
 *   intent corpus and real site content; see tests/lint.test.js).
 * - "hint" — the shape is ambiguous by construction. The message says what the
 *   parser did and how to spell the other meaning; correct content simply
 *   ignores it. Hints trade a known false-fire rate for catching the most
 *   common naive spellings — the corpus records both sides.
 *
 * Environment-free on purpose: pure functions over the document, no I/O, so
 * the CLI, the dev server, and an editor can all surface the same findings.
 */

import { processSequence } from "./processors/sequence.js";
import { splitBySlices, readStack } from "./processors/groups.js";

const stripTags = (s) => String(s ?? "").replace(/<[^>]+>/g, "");
const excerpt = (s) => {
    const t = stripTags(s).trim();
    return t.length > 40 ? t.slice(0, 39) + "…" : t;
};

/**
 * Lint a ProseMirror document for grouping near-misses.
 *
 * @param {Object} doc ProseMirror document
 * @param {Object} [options] The same options a `parseContent` call would use —
 *   findings must describe the parse the consumer actually gets.
 * @returns {Array<{rule: string, severity: "warning"|"hint", message: string}>}
 */
export function lintContent(doc, options = {}) {
    const sequence = processSequence(doc, options);
    const groups = splitBySlices(sequence, options);
    const stacks = groups.map((g) =>
        g[0]?.type === "heading" ? readStack(g, 0, options) : null
    );
    const findings = [];

    // ---- label-as-text: a short bare line above the first heading ----------
    // `**New**` above `# Title` turns the section into an untitled main with
    // the title demoted to items[0] — the most destructive naive spelling.
    // Real intro text is left alone: it runs longer and ends like a sentence.
    if (stacks[0] === null && stacks.length > 1) {
        const first = groups[0];
        const laterTitled = stacks.some((s) => s && s.title.length);
        if (first.length === 1 && first[0].type === "paragraph" && laterTitled) {
            const text = stripTags(first[0].text).trim();
            const words = text.split(/\s+/).filter(Boolean);
            if (words.length > 0 && words.length <= 6 && !/[.!?]$/.test(text)) {
                findings.push({
                    rule: "label-as-text",
                    severity: "warning",
                    message:
                        `"${excerpt(text)}" sits above the first heading, so the section became an ` +
                        `untitled body and the heading below it starts the items. If that line is ` +
                        `a label for the title, write it as a label line: #> ${text}`,
                });
            }
        }
    }

    // ---- per-group checks against the groups that follow -------------------
    for (let i = 0; i < stacks.length; i++) {
        const stack = stacks[i];
        if (!stack) continue;

        const laterTitleLevels = new Set(
            stacks
                .slice(i + 1)
                .filter(Boolean)
                .map((s) => s.title[0]?.level)
                .filter((l) => l != null)
        );

        const subLevels = stack.sub.map((el) => el.level);

        // entry-joined-headline: the headline absorbed two or more lines and
        // at least one sits at the same size as a later block's title. Every
        // measured real-world instance of this shape was a misfire (the first
        // stat, feature, testimonial, or job folded into the headline).
        if (
            stack.sub.length >= 2 &&
            subLevels.some((l) => laterTitleLevels.has(l))
        ) {
            const absorbed = stack.sub[stack.sub.length - 1];
            findings.push({
                rule: "entry-joined-headline",
                severity: "warning",
                message:
                    `The headline under "${excerpt(stack.title[0]?.text)}" absorbed ` +
                    `${stack.sub.length} lines, ending with "${excerpt(absorbed.text)}", while ` +
                    `later headings of the same size start items. If those lines are entries, ` +
                    `step them two sizes below the headline, or put a lead paragraph (or ---) ` +
                    `after it.`,
            });
            continue; // one finding per stack — the hint below would repeat it
        }

        // first-entry-or-subtitle: a single line one step under the title,
        // with same-size headings starting items later. Ambiguous by
        // construction — a platform hero reads exactly like a question list —
        // so this only states what happened and how to spell the other intent.
        if (stack.sub.length === 1 && laterTitleLevels.has(subLevels[0])) {
            findings.push({
                rule: "first-entry-or-subtitle",
                severity: "hint",
                message:
                    `"${excerpt(stack.sub[0].text)}" joined the headline as the subtitle, while ` +
                    `later headings of the same size start items. If it is the subtitle, ignore ` +
                    `this. If it was meant as the first entry, step the entries two sizes below ` +
                    `the headline or put a lead paragraph before the first one.`,
            });
        }

        // merged-title-run: three or more bodiless same-size headings read as
        // one multi-line title. Two lines is the classic split headline; three
        // or more usually means a bare list (names, logos, tags).
        if (stack.title.length >= 3) {
            findings.push({
                rule: "merged-title-run",
                severity: "hint",
                message:
                    `${stack.title.length} same-size headings merged into one multi-line title ` +
                    `starting "${excerpt(stack.title[0]?.text)}". If these are separate items, ` +
                    `give each one body content, separate them with ---, or write them as a list.`,
            });
        }
    }

    return findings;
}
