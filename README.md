# @uniweb/semantic-parser

A semantic parser for ProseMirror/TipTap content structures that helps bridge the gap between natural content writing and component-based web development.

## What it Does

The parser transforms rich text editor content (ProseMirror/TipTap) into structured, semantic groups that web components can easily consume. It provides two complementary views of your content:

1. **Sequence**: An ordered list of all content elements (for rendering in document order)
2. **Groups**: Content organized into semantic sections (main content + items)

## Installation

```bash
npm install @uniweb/semantic-parser
```

## Quick Start

```js
import { parseContent } from "@uniweb/semantic-parser";

// Your ProseMirror/TipTap document
const doc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Welcome" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Get started today." }],
    },
  ],
};

// Parse the content
const result = parseContent(doc);

// Access different views
console.log(result.sequence);  // Ordered array of elements
console.log(result.title);     // Main content fields at top level
console.log(result.items);     // Additional content groups
```

## Output Structure

### Sequence View

An ordered array of semantic elements preserving document order:

```js
result.sequence = [
  { type: "heading", level: 1, content: "Welcome" },
  { type: "paragraph", content: "Get started today." }
]
```

### Content Structure

Main content fields are at the top level. The `items` array contains additional content groups (created when headings appear after content), each with the same field structure:

```js
result = {
  // Header fields (from headings) — each is a string, or an array when the
  // part spans several lines
  pretitle: "",             // `#>` label line(s), or smaller headings above the title
  title: "Welcome",         // Main heading
  subtitle: "",             // Line(s) one step below the title

  // Body fields
  paragraphs: ["Get started today."],
  links: [],                // All links (including buttons, documents)
  images: [],
  videos: [],
  icons: [],
  lists: [],
  quotes: [],
  insets: [],               // Inline @Component references — { refId }
  snippets: [],             // Fenced code blocks — { language, code }
  data: {},                 // Structured data (tagged data blocks, forms, cards)
  headings: [],             // Only from nested content (quote/list bodies)

  // Additional content groups (from headings after content)
  // Each item has the SAME flat structure as the top level — title,
  // pretitle, subtitle, paragraphs, links, images, icons, lists,
  // snippets, data, etc. Use this for cards, features, FAQ entries.
  items: [
    { title: "Feature 1", paragraphs: [...], links: [...], /* ...full shape */ },
    { title: "Feature 2", paragraphs: [...], links: [...], /* ...full shape */ }
  ],

  // Ordered sequence for document-order rendering
  sequence: [...],

  // Original document
  raw: { type: "doc", content: [...] }
}
```

## Common Use Cases

### Extracting Main Content

```js
const content = parseContent(doc);

const title = content.title;
const description = content.paragraphs.join(" ");
const image = content.images[0]?.src;
```

### Processing Content Sections

```js
const content = parseContent(doc);

// Main content
console.log("Title:", content.title);
console.log("Description:", content.paragraphs);

// Additional content groups
content.items.forEach(item => {
  console.log("Section:", item.title);
  console.log("Content:", item.paragraphs);
});
```

### Sequential Processing

```js
const { sequence } = parseContent(doc);

sequence.forEach(element => {
  switch(element.type) {
    case 'heading':
      renderHeading(element);
      break;
    case 'paragraph':
      renderParagraph(element);
      break;
    case 'image':
      renderImage(element);
      break;
  }
});
```

## Content Grouping

The parser interprets heading levels **relatively**, not absolutely. There is no requirement that a section start with H1 — what matters is the relationship *between* headings (which is more important, which is deeper, which comes after body content). Starting at H1 is natural and recommended, but the same structure works starting at H2 or H3 — every rule below is about relative levels.

### How groups are formed

A new group is started whenever a heading appears after non-heading content (paragraphs, images, links, lists, etc.). A horizontal rule (`---`) explicitly closes the current group.

When a group begins with headings, the parser reads one **headline stack** with the staircase rule — each heading relates to the one before it:

1. **Same size** — another line of the same part: a split title, or another subtitle line. Merged slots become arrays.
2. **One step smaller** — the next line of the headline: the subtitle first, then further subtitle lines (`subtitle` is a string for one line, an array for several — a three-line header like name / role / affiliation fits in one headline).
3. **Two or more steps smaller, or a step back up** — the stack ends; the rest of the run starts a new group (an item), read the same way.

Before the title, `#>` label lines (headings carrying `role: "pretitle"`) and every smaller heading stacked above the most important one — in whatever order — join the `pretitle`. A label line anywhere names the block it sits in; a label with no following heading labels an untitled block.

### Main content vs items

Once groups are split, the parser decides whether the first group is the section's main content or whether *all* groups should be treated as items. The first group becomes main content when **either**:

- It has no heading at all (body content appearing before the first heading), **or**
- Its heading level is more important (lower-numbered) than the second group's heading level.

Otherwise, every group becomes an item and the top-level header fields stay empty. For example, a document that starts with `## Card A` followed by `## Card B` produces two items and no main title — because the first group is not more important than the second. The same is true for two H1s in a row, or two H3s; the rule is about *relative* importance, not a specific level.

This is the mechanism that creates repeating content groups (cards, features, FAQ entries) without any extra configuration.

### Pretitle detection

Two spellings fill the `pretitle` slot:

- **A `#>` label line** — a heading with `role: "pretitle"`. It names the block that starts next, at any depth, with no level arithmetic; the hash count is carried for round-tripping and means nothing.
- **Position** — smaller headings stacked above the most important heading of a run (H3 before H1, H6 before H5, …), in any order. `#### / ### / # Title` and `## / ### / # Title` both yield a two-line pretitle.

### Banner image

If a section's very first element is an image (or an image followed immediately by a heading), the parser keeps the image and the following heading in the same group rather than splitting them. This lets a leading image act as a banner for the section's title without becoming an unrelated item.

### Divider-based grouping

A horizontal rule (`---`) explicitly closes the current group and starts a new one. Dividers compose with the heading rules above — they don't replace them — and are useful in three situations:

- **Resolving ambiguity.** When the heading rules would group content one way but you want it grouped another way. Most common case: forcing items without a subtitle. Without a divider, `# Our Stats` followed by `## 15,000+` makes `## 15,000+` the subtitle (one step down). Adding `---` between them closes the headline so `## 15,000+` becomes `items[0].title` instead — as does writing the entries two steps down (`### 15,000+`), the divider-free spelling.
- **Forcing splits within same-level runs.** Same-level headings that would otherwise merge into a multi-line title/subtitle become separate groups when separated by a divider.
- **Personal preference.** Even when the heading rules would already produce the desired structure, authors can use `---` as an explicit visual separator between groups. It never changes a structure that's already correct — it just makes the boundary obvious in the markdown source.

## Text Formatting

Inline formatting is preserved as HTML tags:

```js
// Input: Text with bold mark
// Output: "Text with <strong>bold</strong>"

// Input: Text with italic mark
// Output: "Text with <em>emphasis</em>"

// Input: Link mark
// Output: "Click <a href=\"/docs\">here</a>"

// Input: Span mark (bracketed spans)
// Output: "This is <span class=\"highlight\">highlighted</span> text"
```

### Span Marks

Bracketed spans (`[text]{.class}`) are converted to `<span>` elements with their attributes:

```js
// Input mark
{ type: "span", attrs: { class: "highlight", id: "note-1" } }

// Output HTML
'<span class="highlight" id="note-1">text</span>'
```

Spans can have classes, IDs, and custom attributes. They combine with other marks—a span with bold becomes `<strong><span class="...">text</span></strong>`.

### Inline Insets and Cross-references

The parser handles inline `inset_placeholder` nodes — generated by
`@uniweb/build`'s content collector when it pulls
`![alt](@Component){k=v}`, `[text](@Component){k=v}`, `[@key]{k=v}`,
or `[#id]{k=v}` references out of paragraph content. Two artifacts
ship to consumers:

1. **`children` carries an `inset` entry per placeholder** — each
   carrying the `refId` and `embedKind` (`'text'` for textual sugars
   like `[@key]` / `[#id]` / `[text](@Component)`; `'visual'` for
   `![alt](@Component)`). Renderers that walk `paragraph.children`
   pick these up alongside icons, math, and links.

2. **`text` carries a `<uniweb-inset data-ref-id="…"></uniweb-inset>`
   marker** at the placeholder position — useful for renderers that
   read `paragraph.text` as a flat HTML string (kit's `<Prose>` is the
   canonical example; it splits on the marker and intersperses
   React-rendered insets via the framework's child-block renderer).

The two views stay in lockstep — both record every inline inset the
parser sees, in source order.

## Use Cases

- **Component-based websites**: Extract structured data for React/Vue components
- **Content management**: Parse editor content into database-friendly structures
- **Static site generation**: Transform rich content into template-ready data
- **Content analysis**: Analyze document structure and content types

## License

GPL-3.0-or-later
