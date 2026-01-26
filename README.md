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
  subtitle2: "",            // Third heading level

  // Body fields
  paragraphs: ["Get started today."],
  links: [],                // All links (including buttons, documents)
  imgs: [],
  videos: [],
  icons: [],
  lists: [],
  quotes: [],
  data: {},                 // Structured data (tagged code blocks, forms, cards)
  headings: [],             // Overflow headings after title/subtitle/subtitle2

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

## Content Mapping Utilities

The parser includes optional mapping utilities to transform parsed content into component-specific formats. Perfect for visual editors and component-based systems.

### Type System (Recommended)

Automatically transform content based on field types with context-aware behavior:

```js
const schema = {
  title: {
    path: "title",
    type: "plaintext",  // Auto-strips <strong>, <em>, etc.
    maxLength: 60       // Auto-truncates intelligently
  },
  excerpt: {
    path: "paragraphs",
    type: "excerpt",    // Auto-creates excerpt from paragraphs
    maxLength: 150
  },
  image: {
    path: "imgs[0].url",
    type: "image",
    defaultValue: "/placeholder.jpg"
  }
};

// Visual editor mode (default) - silent, graceful cleanup
const data = mappers.extractBySchema(parsed, schema);

// Build mode - validates and warns
const data = mappers.extractBySchema(parsed, schema, { mode: 'build' });
```

**Field Types:** `plaintext`, `richtext`, `excerpt`, `number`, `image`, `link`

### Using Pre-Built Extractors

```js
import { parseContent, mappers } from "@uniweb/semantic-parser";

const parsed = parseContent(doc);

// Extract hero component data
const heroData = mappers.extractors.hero(parsed);
// { title, subtitle, kicker, description, image, cta, ... }

// Extract card data
const cards = mappers.extractors.card(parsed, { useItems: true });

// Extract statistics
const stats = mappers.extractors.stats(parsed);
// [{ value: "12", label: "Partner Labs" }, ...]

// Extract navigation menu
const nav = mappers.extractors.navigation(parsed);

// Extract features list
const features = mappers.extractors.features(parsed);
```

### Schema-Based Mapping

Define custom mappings using schemas:

```js
const schema = {
  brand: "pretitle",
  title: "title",
  subtitle: "subtitle",
  image: {
    path: "imgs[0].url",
    defaultValue: "/placeholder.jpg"
  },
  actions: {
    path: "links",
    transform: links => links.map(l => ({ label: l.label, type: "primary" }))
  }
};

const componentData = mappers.accessor.extractBySchema(parsed, schema);
```

### Available Extractors

- `hero` - Hero/banner sections
- `card` - Card components
- `article` - Article/blog content
- `stats` - Statistics/metrics
- `navigation` - Navigation menus
- `features` - Feature lists
- `testimonial` - Testimonials
- `faq` - FAQ sections
- `pricing` - Pricing tiers
- `team` - Team members
- `gallery` - Image galleries

See **[Mapping Patterns Guide](./docs/mapping-patterns.md)** for complete documentation.

## Rendering Content

After extracting content, render it using a Text component that handles paragraph arrays, rich HTML, and formatting marks.

### Text Component Pattern

```jsx
import { parseContent, mappers } from '@uniweb/semantic-parser';
import { H1, P } from './components/Text';

const parsed = parseContent(doc);
const hero = mappers.extractors.hero(parsed);

// Render extracted content
<>
  <H1 text={hero.title} />
  <P text={hero.description} />  {/* Handles arrays automatically */}
</>
```

The Text component:
- **Handles arrays** - Renders `["Para 1", "Para 2"]` as separate paragraphs
- **Supports rich HTML** - Preserves formatting marks
- **Multi-line headings** - Wraps multiple lines in semantic heading tags
- **Color marks** - Supports `<mark>` and `<span>` for visual emphasis

See **[Text Component Reference](./docs/text-component-reference.md)** for implementation guide.

### Sanitization

Sanitize content at the engine level (during data preparation), not in components:

```javascript
import { parseContent, mappers } from '@uniweb/semantic-parser';

function prepareData(parsed) {
  const hero = mappers.extractors.hero(parsed);
  return {
    ...hero,
    title: mappers.types.sanitizeHtml(hero.title, {
      allowedTags: ['strong', 'em', 'mark', 'span'],
      allowedAttr: ['class', 'data-variant']
    })
  };
}
```

The parser provides sanitization utilities but doesn't enforce their use. Your engine decides when to sanitize based on security requirements.

## Content Grouping

The parser supports two grouping modes:

### Heading-Based Grouping (Default)

Groups are created based on heading patterns. A new group starts when:
- A heading follows content
- Multiple H1s appear (no main content created)
- The heading level indicates a new section

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

## Documentation

- **[Content Writing Guide](./docs/guide.md)**: Learn how to structure content for optimal parsing
- **[API Reference](./docs/api.md)**: Complete API documentation with all element types
- **[Mapping Patterns Guide](./docs/mapping-patterns.md)**: Transform content to component-specific formats
- **[Text Component Reference](./docs/text-component-reference.md)**: Reference implementation for rendering parsed content
- **[File Structure](./docs/file-structure.md)**: Codebase organization

## Use Cases

- **Component-based websites**: Extract structured data for React/Vue components
- **Content management**: Parse editor content into database-friendly structures
- **Static site generation**: Transform rich content into template-ready data
- **Content analysis**: Analyze document structure and content types

## License

GPL-3.0-or-later
