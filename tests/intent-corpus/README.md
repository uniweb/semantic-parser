# Intent corpus — the grouping scorecard

Markdown as authors *actually write it* — no dividers, no insider tricks, no prior
knowledge of the grouping rules — each row annotated with the shape the author
meant. The suite (`scorecard.test.js`) asserts the parser's **current** output
for every row, recorded in `recorded.js`.

**Green does not mean every row matches its intent.** Green means *the scorecard
is as recorded*. Rows where `intended` differs from the recording are the
documented open gaps — misparses we know about and have chosen not to paper over
with a cleverer guess. Rows where they agree are regression guards protecting
shapes the rules get right today.

## Why this exists

The grouping rules are heuristics over an under-determined source: the same
heading sequence legitimately carries different intents (`# Title / ## X` is a
subtitle in a hero and the first item in an FAQ). Nothing derived is ever
stored — parsing runs just-in-time — so any rule change silently re-reads every
document that already exists. This corpus turns a rule change from an argument
into a measurement: it must show exactly which real-world shapes it fixes and
which it breaks.

## Changing a grouping rule

1. Make the change in `src/`.
2. Regenerate the recording:

   ```bash
   node tests/intent-corpus/generate.js > tests/intent-corpus/recorded.js
   ```

3. **Review the diff row by row.** A gap closing (recording now equals
   `intended`) is the win you were after. A previously matching row that moved
   is a regression on content that parses correctly today — justify it or fix
   it. Commit the recording diff together with the rule change.

## Adding a row

Add an entry to `corpus.js`: the markdown a naive author would write (`source`,
documentation only), the equivalent ProseMirror document (`doc`, what actually
runs), a one-line `intent`, and the `intended` shape in the lens format below.
Then regenerate the recording. Set `intended: null` for stability-only rows
whose grouped shape is incidental (content consumed through `sequence`).

Keep rows *naive*: if the markdown needs a divider or a rule-aware trick to
express the intent, that difficulty is the finding — record the natural
spelling and let the row stand as a gap.

## The lens

`brief.js` reduces a parse to the fields the grouping rules are responsible
for: `pretitle`, `title`, `subtitle` (string or array, as emitted),
`paragraphs`, `headings`, and `items` (same shape, recursively). Everything
else — links, images, icons, data blocks, `sequence` — is deliberately outside
the lens; other suites cover it. Empty fields are omitted so fixtures read
clean and diffs stay small.
