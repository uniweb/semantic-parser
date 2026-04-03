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
  // Header fields (from headings)
  pretitle: "",             // Heading before main title
  title: "Welcome",         // Main heading
  subtitle: "",             // Heading after main title

  // Body fields
  paragraphs: ["Get started today."],
  links: [],                // All links (including buttons, documents)
  images: [],
  videos: [],
  icons: [],
  lists: [],
  quotes: [],
  data: {},                 // Structured data (tagged data blocks, forms, cards)
  headings: [],             // Headings after subtitle, in document order

  // Additional content groups (from headings after content)
  items: [
    { title: "Feature 1", paragraphs: [...], links: [...] },
    { title: "Feature 2", paragraphs: [...], links: [...] }
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
const image = content.banner?.url;
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

The parser supports two grouping modes:

### Heading-Based Grouping (Default)

Groups are created based on heading patterns. A new group starts when:
- A heading follows content
- Multiple H1s appear (no main content created)
- The heading level indicates a new section

**Heading group formation:** Consecutive headings are consumed as a single semantic unit only when each subsequent heading is _exactly one level deeper_ than the previous (e.g., H1→H2→H3). Skipping levels (H1→H3) breaks the group — the deeper heading starts a new group instead of becoming a subtitle. This reflects natural document structure: a large level gap signals items, not a title-subtitle pair.

**Pretitle Detection:** Any heading followed by a more important heading is automatically detected as a pretitle:
- H3 before H1 → pretitle ✅
- H2 before H1 → pretitle ✅
- H6 before H5 → pretitle ✅
- H4 before H2 → pretitle ✅

No configuration needed - it just works naturally!

### Divider-Based Grouping

When any horizontal rule (`---`) is present, the entire document uses divider-based grouping. Groups are split explicitly by dividers.

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

## Use Cases

- **Component-based websites**: Extract structured data for React/Vue components
- **Content management**: Parse editor content into database-friendly structures
- **Static site generation**: Transform rich content into template-ready data
- **Content analysis**: Analyze document structure and content types

## License

GPL-3.0-or-later
