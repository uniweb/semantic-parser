# AGENTS.md

This file provides guidance for AI assistants working with code in this repository.

## Project Overview

This is a semantic parser for ProseMirror/TipTap content structures. It transforms rich text editor content into structured, semantic groups that web components can consume. The parser bridges the gap between natural content writing and component-based web development.

## Development Commands

```bash
# Run all tests
npm test

# Run a specific test file
npx vitest run tests/parser.test.js

# Run tests in watch mode
npx vitest

# Run a specific test by name
npx vitest run -t "handles simple document structure"
```

## Architecture

### Three-Stage Processing Pipeline

The parser processes content through three distinct stages, each building on the previous:

1. **Sequence Processing** (`src/processors/sequence.js`): Flattens the ProseMirror document tree into a linear sequence of semantic elements (headings, paragraphs, images, lists, etc.)

2. **Groups Processing** (`src/processors/groups.js`): Transforms the sequence into semantic groups with identified main content and items. Headings split groups via the staircase headline rule; a horizontal rule explicitly closes the current group — the two compose, there are no separate modes.

3. **ByType Processing** (`src/processors/byType.js`): Organizes elements by type with positional context, enabling type-specific queries

The main entry point (`src/index.js`) returns all three views:
```js
import { parseContent } from './src/index.js';

const result = parseContent(doc);
// {
//   raw: doc,        // Original ProseMirror document
//   sequence: [...], // Flat sequence of elements
//   title, pretitle, subtitle, paragraphs, items, ...  // flat content fields
// }
```

### Content Output Structure

The parser returns a flat content structure:

```js
{
  title: '',       // Main heading
  pretitle: '',    // `#>` label line(s) or smaller headings above the title
  subtitle: '',    // Line(s) one step below the title (string or array)
  paragraphs: [],
  links: [],       // All link-like entities (including buttons, documents)
  images: [],
  icons: [],
  videos: [],
  lists: [],
  quotes: [],
  snippets: [],    // Fenced code — [{ language, code }]
  data: {},        // Structured data (tagged data blocks, forms, cards)
  headings: [],    // Only from nested content (quote/list bodies)
  items: [],       // Child content groups (same structure recursively)
}
```

### Link Roles

Links include buttons and documents, distinguished by `role`:

```js
links: [
  { href: "/page", label: "Learn More", role: "link" },
  { href: "/action", label: "Get Started", role: "button", variant: "primary" },
  { href: "/file.pdf", label: "Download", role: "document", download: true },
]
```

### Structured Data

The `data` object holds all structured content:

```js
data: {
  "nav-links": [...],     // From ```yaml:nav-links
  "config": {...},        // From ```yaml:config
  "stats": [...],         // From FormBlock (activeSchemaId='stats') or ```yaml:stats
  "person": [...],        // From card-group with cardType="person"
  "event": [...]          // From card-group with cardType="event"
}
```

FormBlock data is routed to `data[activeSchemaId]`. A legacy
FormBlock without a `schemaId` still lands at `data.form`.

### Main Content Identification

The `identifyMainContent()` function in `src/processors/groups.js` determines if the first group should be treated as main content:
- Single group is always main content
- First group must have a more important (lower) heading level than the second group
- A first group with no heading at all (body before the first heading) is also promoted to main

### Special Element Detection

The sequence processor identifies several special element types by inspecting paragraph content:
- **Links**: Paragraphs containing only a single link mark
- **Images**: Paragraphs with single image (role: 'image' or 'banner')
- **Icons**: Paragraphs with single image (role: 'icon')
- **Buttons**: Editor `button` nodes → mapped to links with `role: "button"`
- **Videos**: Paragraphs with single image (role: 'video')

### Editor Node Mappings

Editor-specific nodes are mapped to standard entities:
- `button` node → `links[]` with `role: "button"` and `variant` attribute
- `FormBlock` → `data[activeSchemaId]` (fallback: `data.form` when no schemaId)
- `card-group` → `data[cardType]` arrays (e.g., `data.person`, `data.event`)
- `document-group` → `links[]` with `role: "document"` and `download: true`

### Tagged Data Blocks

Data blocks with tags route parsed data to the `data` object:

```markdown
```yaml:nav-links
- label: Home
  href: /
- label: About
  href: /about
```

```yaml:config
title: My Site
theme: dark
```
```

JSON is also supported (`json:tag-name`) if you prefer.

Results in:
```js
content.data['nav-links'] = [{ label: "Home", href: "/" }]
content.data['config'] = { title: "My Site", theme: "dark" }
```

**Parsing rules:**
- Tagged blocks with `json` language: parsed as JSON
- Tagged blocks with `yaml`/`yml` language: parsed as YAML
- Untagged blocks: not parsed (stay as raw text in sequence for display)

### List Processing

Lists maintain hierarchy through nested structure. The `processListItems()` function in sequence.js handles nested lists, while `processListContent()` in groups.js applies full group content processing to each list item, allowing lists to contain rich content (images, paragraphs, nested lists, etc.).

## Content Writing Conventions

Key patterns — the staircase rule (each heading relates to the one before it):

- **Pretitle**: `#>` label lines (headings with `role: "pretitle"`), and smaller headings stacked directly above a more important one (H3→H1, H6→H5, …). String or array.
- **Subtitle**: one step below the title, directly adjacent — and each further one-step descent (or same-size repeat) is another subtitle line. String or array.
- **Items**: a heading two or more steps below the previous one, a step back up, or any heading after body content starts a new group.
- **Banner Pattern**: an image (with banner role or followed by a heading) at the start of the first group stays with the headline.
- **Dividers**: a `horizontalRule` explicitly closes the current group; it composes with the heading rules rather than replacing them.
- **Main Content**: the first group is main if it's the only group, has a more important heading level than the second group, or has no heading at all.
- **Body Headings**: `body.headings` fills only from nested content (blockquote children, list items) — a section's headline never spills there.

## Testing Structure

Tests are organized by processor:
- `tests/parser.test.js` - Integration tests
- `tests/processors/sequence.test.js` - Sequence processing
- `tests/processors/groups.test.js` - Groups processing
- `tests/processors/byType.test.js` - ByType processing
- `tests/utils/role.test.js` - Role utilities
- `tests/fixtures/` - Shared test documents

## Important Implementation Notes

- The parser never modifies the original ProseMirror document
- Text content can include inline HTML for formatting (bold → `<strong>`, italic → `<em>`, links → `<a>`)
- Context information in byType includes position, previous/next elements, and nearest heading
- Headline slots and group boundaries come from one walk (`readStack`), so the two cannot disagree
