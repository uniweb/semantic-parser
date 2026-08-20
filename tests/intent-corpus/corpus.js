/**
 * The rows: naive author markdown + the shape the author meant.
 *
 * `source` is documentation — the markdown as an author would type it.
 * `doc` is the equivalent ProseMirror document, which is what actually runs
 * (the grouping rules only see headings, paragraphs and levels, where the
 * markdown → ProseMirror mapping is mechanical).
 *
 * `intended` is the brief the author meant (see brief.js for the lens);
 * `null` marks a stability-only row whose grouped shape is incidental.
 * The recorded CURRENT output lives in recorded.js — where the two differ,
 * the row is a documented gap, not a test failure.
 */

const h = (level, text) => ({
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
});
// A `#>` label line — a heading carrying role: "pretitle" on the wire.
const label = (text) => ({
    type: "heading",
    attrs: { level: 1, role: "pretitle" },
    content: [{ type: "text", text }],
});
const p = (text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
});
const boldP = (text) => ({
    type: "paragraph",
    content: [{ type: "text", text, marks: [{ type: "bold" }] }],
});
const doc = (...content) => ({ type: "doc", content });

export const rows = [
    {
        name: "hero-full",
        intent: "Eyebrow above the headline, a subtitle, one lead paragraph.",
        source: `### NEW
# Build the future
## Ship every week

Lead paragraph.`,
        doc: doc(
            h(3, "NEW"),
            h(1, "Build the future"),
            h(2, "Ship every week"),
            p("Lead paragraph.")
        ),
        intended: {
            pretitle: "NEW",
            title: "Build the future",
            subtitle: "Ship every week",
            paragraphs: ["Lead paragraph."],
        },
    },

    {
        name: "hero-minimal",
        intent: "Title, subtitle, lead — the plainest hero.",
        source: `# Build the future
## Ship every week

Lead paragraph.`,
        doc: doc(
            h(1, "Build the future"),
            h(2, "Ship every week"),
            p("Lead paragraph.")
        ),
        intended: {
            title: "Build the future",
            subtitle: "Ship every week",
            paragraphs: ["Lead paragraph."],
        },
    },

    {
        name: "faq-adjacent",
        intent:
            "A titled FAQ: every question is an item. The first question sits directly under the title, as authors naturally write it.",
        source: `# FAQ
## How do I install?
a1
## Can I self-host?
a2
## Is it free?
a3`,
        doc: doc(
            h(1, "FAQ"),
            h(2, "How do I install?"),
            p("a1"),
            h(2, "Can I self-host?"),
            p("a2"),
            h(2, "Is it free?"),
            p("a3")
        ),
        intended: {
            title: "FAQ",
            items: [
                { title: "How do I install?", paragraphs: ["a1"] },
                { title: "Can I self-host?", paragraphs: ["a2"] },
                { title: "Is it free?", paragraphs: ["a3"] },
            ],
        },
        note: "Same source shape as hero-minimal + more items — the central collision. The first question currently lands in the subtitle slot.",
    },

    {
        name: "faq-with-lead",
        intent: "A lead paragraph between the title and the first question.",
        source: `# FAQ
Common questions.
## How do I install?
a1
## Can I self-host?
a2`,
        doc: doc(
            h(1, "FAQ"),
            p("Common questions."),
            h(2, "How do I install?"),
            p("a1"),
            h(2, "Can I self-host?"),
            p("a2")
        ),
        intended: {
            title: "FAQ",
            paragraphs: ["Common questions."],
            items: [
                { title: "How do I install?", paragraphs: ["a1"] },
                { title: "Can I self-host?", paragraphs: ["a2"] },
            ],
        },
    },

    {
        name: "stats-adjacent",
        intent: "Title plus number/label pairs as items.",
        source: `# By the numbers
## 15,000+
students
## 200+
programs
## 99%
satisfaction`,
        doc: doc(
            h(1, "By the numbers"),
            h(2, "15,000+"),
            p("students"),
            h(2, "200+"),
            p("programs"),
            h(2, "99%"),
            p("satisfaction")
        ),
        intended: {
            title: "By the numbers",
            items: [
                { title: "15,000+", paragraphs: ["students"] },
                { title: "200+", paragraphs: ["programs"] },
                { title: "99%", paragraphs: ["satisfaction"] },
            ],
        },
    },

    {
        name: "features-lead",
        intent: "Title, lead, then feature cards at a deeper level.",
        source: `# Everything you need
lead
### Fast
f
### Secure
s`,
        doc: doc(
            h(1, "Everything you need"),
            p("lead"),
            h(3, "Fast"),
            p("f"),
            h(3, "Secure"),
            p("s")
        ),
        intended: {
            title: "Everything you need",
            paragraphs: ["lead"],
            items: [
                { title: "Fast", paragraphs: ["f"] },
                { title: "Secure", paragraphs: ["s"] },
            ],
        },
    },

    {
        name: "features-h2-no-lead",
        intent:
            "Same features section, but the author used ## for cards and wrote no lead.",
        source: `# Features
## Fast
f
## Secure
s`,
        doc: doc(h(1, "Features"), h(2, "Fast"), p("f"), h(2, "Secure"), p("s")),
        intended: {
            title: "Features",
            items: [
                { title: "Fast", paragraphs: ["f"] },
                { title: "Secure", paragraphs: ["s"] },
            ],
        },
    },

    {
        name: "cards-no-main",
        intent: "Peer cards with no main content at all.",
        source: `## Alpha
a
## Beta
b`,
        doc: doc(h(2, "Alpha"), p("a"), h(2, "Beta"), p("b")),
        intended: {
            items: [
                { title: "Alpha", paragraphs: ["a"] },
                { title: "Beta", paragraphs: ["b"] },
            ],
        },
    },

    {
        name: "bodiless-cards",
        intent:
            "Bare names as items — a logo wall, a tag list. No body under any heading.",
        source: `## Acme
## Globex
## Initech`,
        doc: doc(h(2, "Acme"), h(2, "Globex"), h(2, "Initech")),
        intended: {
            items: [{ title: "Acme" }, { title: "Globex" }, { title: "Initech" }],
        },
        note: "Collides with the multi-line-title merge, which is itself intended content (a headline split across lines). Undecidable from levels alone.",
    },

    {
        name: "roster-two-level",
        intent:
            "Two-level structure in one file: category headings with people under them. Intended shape keeps every person symmetric and loses no text; whether categories nest or sit as bodiless items is an open design question — this records the flat reading.",
        source: `# Our Team
## Engineering
### Alice
bio a
### Bob
bio b
## Design
### Carol
bio c`,
        doc: doc(
            h(1, "Our Team"),
            h(2, "Engineering"),
            h(3, "Alice"),
            p("bio a"),
            h(3, "Bob"),
            p("bio b"),
            h(2, "Design"),
            h(3, "Carol"),
            p("bio c")
        ),
        intended: {
            title: "Our Team",
            items: [
                { title: "Engineering" },
                { title: "Alice", paragraphs: ["bio a"] },
                { title: "Bob", paragraphs: ["bio b"] },
                { title: "Design" },
                { title: "Carol", paragraphs: ["bio c"] },
            ],
        },
    },

    {
        name: "faq-categories",
        intent:
            "FAQ with category headings — the same two-level shape as the roster.",
        source: `# FAQ
## Billing
### How much?
a
### Refunds?
b
## Account
### Delete me?
c`,
        doc: doc(
            h(1, "FAQ"),
            h(2, "Billing"),
            h(3, "How much?"),
            p("a"),
            h(3, "Refunds?"),
            p("b"),
            h(2, "Account"),
            h(3, "Delete me?"),
            p("c")
        ),
        intended: {
            title: "FAQ",
            items: [
                { title: "Billing" },
                { title: "How much?", paragraphs: ["a"] },
                { title: "Refunds?", paragraphs: ["b"] },
                { title: "Account" },
                { title: "Delete me?", paragraphs: ["c"] },
            ],
        },
    },

    {
        name: "resume-adjacent",
        intent:
            "Jobs with a date subtitle each. The first job sits directly under the section title with no separator — as authors naturally write it.",
        source: `# Experience
## Google
### 2020–now
Built things.
## Meta
### 2018–2020
Other things.`,
        doc: doc(
            h(1, "Experience"),
            h(2, "Google"),
            h(3, "2020–now"),
            p("Built things."),
            h(2, "Meta"),
            h(3, "2018–2020"),
            p("Other things.")
        ),
        intended: {
            title: "Experience",
            items: [
                {
                    title: "Google",
                    subtitle: "2020–now",
                    paragraphs: ["Built things."],
                },
                {
                    title: "Meta",
                    subtitle: "2018–2020",
                    paragraphs: ["Other things."],
                },
            ],
        },
    },

    {
        name: "subtitle-then-items",
        intent:
            "A real subtitle directly under the title, then item groups at the subtitle's own level.",
        source: `# Work History
## A summary of my roles.
## Google
### 2020–now
x
## Facebook
### 2018–2020
y`,
        doc: doc(
            h(1, "Work History"),
            h(2, "A summary of my roles."),
            h(2, "Google"),
            h(3, "2020–now"),
            p("x"),
            h(2, "Facebook"),
            h(3, "2018–2020"),
            p("y")
        ),
        intended: {
            title: "Work History",
            subtitle: "A summary of my roles.",
            items: [
                { title: "Google", subtitle: "2020–now", paragraphs: ["x"] },
                { title: "Facebook", subtitle: "2018–2020", paragraphs: ["y"] },
            ],
        },
        note: "The rules get this right today. Guards the subtitle-inside-a-heading-run reading.",
    },

    {
        name: "subtitle-and-peer-cards",
        intent:
            "A subtitle, a lead, then cards at the SAME level as the subtitle.",
        source: `# Platform
## One tool, every team
lead
## For devs
d
## For designers
g`,
        doc: doc(
            h(1, "Platform"),
            h(2, "One tool, every team"),
            p("lead"),
            h(2, "For devs"),
            p("d"),
            h(2, "For designers"),
            p("g")
        ),
        intended: {
            title: "Platform",
            subtitle: "One tool, every team",
            paragraphs: ["lead"],
            items: [
                { title: "For devs", paragraphs: ["d"] },
                { title: "For designers", paragraphs: ["g"] },
            ],
        },
        note: "The rules get this right today, and it is the counterexample to 'demote the subtitle whenever its level recurs as items' — any recurrence-based heuristic breaks this row.",
    },

    {
        name: "paragraph-eyebrow",
        intent:
            "An eyebrow written the way most people first try: a short bold line above the title.",
        source: `**NEW**

# Build the future

Lead.`,
        doc: doc(boldP("NEW"), h(1, "Build the future"), p("Lead.")),
        intended: {
            pretitle: "NEW",
            title: "Build the future",
            paragraphs: ["Lead."],
        },
        note: "Currently the body-before-first-heading rule turns the whole section inside out: the title lands in items[0]. No grouping rule can fix this; it needs explicit syntax or a diagnostic.",
    },

    {
        name: "stacked-pretitle",
        intent: "A two-line eyebrow above the headline.",
        source: `#### ACME LABS
### ANNOUNCING
# Titan

Lead.`,
        doc: doc(h(4, "ACME LABS"), h(3, "ANNOUNCING"), h(1, "Titan"), p("Lead.")),
        intended: {
            pretitle: ["ACME LABS", "ANNOUNCING"],
            title: "Titan",
            paragraphs: ["Lead."],
        },
        note: "Greedy first-pair pretitle promotion currently consumes ACME LABS + ANNOUNCING as pretitle + title and orphans the real title into a second item.",
    },

    {
        name: "pricing-tiers",
        intent: "Title, lead, tiers each carrying a price subtitle.",
        source: `# Pricing
lead
### Free
#### $0
feats
### Pro
#### $29
feats`,
        doc: doc(
            h(1, "Pricing"),
            p("lead"),
            h(3, "Free"),
            h(4, "$0"),
            p("feats"),
            h(3, "Pro"),
            h(4, "$29"),
            p("feats")
        ),
        intended: {
            title: "Pricing",
            paragraphs: ["lead"],
            items: [
                { title: "Free", subtitle: "$0", paragraphs: ["feats"] },
                { title: "Pro", subtitle: "$29", paragraphs: ["feats"] },
            ],
        },
    },

    {
        name: "single-item",
        intent: "A title and ONE item — a lone stat.",
        source: `# Impact
## 15,000+
students reached`,
        doc: doc(h(1, "Impact"), h(2, "15,000+"), p("students reached")),
        intended: {
            title: "Impact",
            items: [{ title: "15,000+", paragraphs: ["students reached"] }],
        },
        note: "Byte-identical in shape to hero-minimal. No rule over the source can distinguish the two intents; only the consuming section type knows.",
    },

    {
        name: "three-line-header",
        intent:
            "A three-line header — name, role, affiliation. The title plus two descending subtitle lines.",
        source: `# Ada Lovelace
## Chief Scientist
### Analytical Engines Ltd

Short bio.`,
        doc: doc(
            h(1, "Ada Lovelace"),
            h(2, "Chief Scientist"),
            h(3, "Analytical Engines Ltd"),
            p("Short bio.")
        ),
        intended: {
            title: "Ada Lovelace",
            subtitle: ["Chief Scientist", "Analytical Engines Ltd"],
            paragraphs: ["Short bio."],
        },
        note: "Needs the headline to absorb descending lines into a subtitle array. Currently the third line lands in the headings[] overflow.",
    },

    {
        name: "event-cover",
        intent: "An event cover: name, dates, venue as the headline.",
        source: `# DevConf 2027
## June 12 – 14
### Lisbon

Call for papers is open.`,
        doc: doc(
            h(1, "DevConf 2027"),
            h(2, "June 12 – 14"),
            h(3, "Lisbon"),
            p("Call for papers is open.")
        ),
        intended: {
            title: "DevConf 2027",
            subtitle: ["June 12 – 14", "Lisbon"],
            paragraphs: ["Call for papers is open."],
        },
    },

    {
        name: "stepped-items-under-subtitle",
        intent:
            "A subtitle directly under the title, then entries stepped two sizes below the subtitle — no lead paragraph needed.",
        source: `# Work History
## A summary of my roles.
#### Google
##### 2020–now
x
#### Meta
##### 2018–2020
y`,
        doc: doc(
            h(1, "Work History"),
            h(2, "A summary of my roles."),
            h(4, "Google"),
            h(5, "2020–now"),
            p("x"),
            h(4, "Meta"),
            h(5, "2018–2020"),
            p("y")
        ),
        intended: {
            title: "Work History",
            subtitle: "A summary of my roles.",
            items: [
                { title: "Google", subtitle: "2020–now", paragraphs: ["x"] },
                { title: "Meta", subtitle: "2018–2020", paragraphs: ["y"] },
            ],
        },
        note: "The two-step spelling for items directly under a bodiless subtitle. Parses to intent already — guards the canonical spelling.",
    },

    {
        name: "label-on-item",
        intent:
            "A `#>` label line names the item that starts next — its pretitle, with no level arithmetic.",
        source: `# Pricing
Plans that grow with you.
#> Most popular
### Pro
#### $29 / month
Everything in Free.`,
        doc: doc(
            h(1, "Pricing"),
            p("Plans that grow with you."),
            label("Most popular"),
            h(3, "Pro"),
            h(4, "$29 / month"),
            p("Everything in Free.")
        ),
        intended: {
            title: "Pricing",
            paragraphs: ["Plans that grow with you."],
            items: [
                {
                    pretitle: "Most popular",
                    title: "Pro",
                    subtitle: "$29 / month",
                    paragraphs: ["Everything in Free."],
                },
            ],
        },
        note: "Guards label-binds-forward: the label opens the block it names.",
    },

    {
        name: "label-untitled",
        intent:
            "A `#>` label above an untitled section labels the untitled main body.",
        source: `#> Case study
Three teams, one launch date.

## Week one
We scoped the work.`,
        doc: doc(
            label("Case study"),
            p("Three teams, one launch date."),
            h(2, "Week one"),
            p("We scoped the work.")
        ),
        intended: {
            pretitle: "Case study",
            paragraphs: ["Three teams, one launch date."],
            items: [{ title: "Week one", paragraphs: ["We scoped the work."] }],
        },
        note: "Positional pretitle cannot express this: a lone small heading would have become the title.",
    },

    {
        name: "docs-outline",
        intent:
            "Prose documentation with an ordinary heading outline. Consumed through `sequence`; the grouped shape is incidental but must not drift silently.",
        source: `# Guide
intro
## Install
i
### macOS
m
### Linux
l
## Usage
u`,
        doc: doc(
            h(1, "Guide"),
            p("intro"),
            h(2, "Install"),
            p("i"),
            h(3, "macOS"),
            p("m"),
            h(3, "Linux"),
            p("l"),
            h(2, "Usage"),
            p("u")
        ),
        intended: null,
    },
];
