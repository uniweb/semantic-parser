# AGENTS.md

This file provides guidance for AI assistants working with code in this repository.

## Project Overview

This is a semantic parser for ProseMirror/TipTap content structures. It transforms rich text editor content into structured, semantic groups that web components can consume. The parser bridges the gap between natural content writing and component-based web development.

## Development Commands

```bash
# Run all tests
npm test

# Run tests with JSON report output
npm run test-report

# Run a specific test file
npx jest tests/parser.test.js

# Run tests in watch mode
npx jest --watch

# Run a specific test by name
npx jest -t "handles simple document structure"
```

## Architecture

### Three-Stage Processing Pipeline

The parser processes content through three distinct stages, each building on the previous:

1. **Sequence Processing** (`src/processors/sequence.js`): Flattens the ProseMirror document tree into a linear sequence of semantic elements (headings, paragraphs, images, lists, etc.)

2. **Groups Processing** (`src/processors/groups.js`): Transforms the sequence into semantic groups with identified main content and items. Supports two grouping modes:
   - Heading-based grouping (default)
   - Divider-based grouping (when horizontal rules are present)

3. **ByType Processing** (`src/processors/byType.js`): Organizes elements by type with positional context, enabling type-specific queries

The main entry point (`src/index.js`) returns all three views:
```js
import { parseContent } from './src/index.js';

const result = parseContent(doc);
// {
//   raw: doc,        // Original ProseMirror document
//   sequence: [...], // Flat sequence of elements
//   groups: {...},   // Semantic groups with main/items
//   byType: {...}    // Elements organized by type
// }
```

### Content Output Structure

The parser returns a flat content structure:

```js
{
  title: '',       // Main heading
  pretitle: '',    // Heading before main title
  subtitle: '',    // Heading after main title
  paragraphs: [],
  links: [],
  imgs: [],
  icons: [],
  videos: [],
  lists: [],
  buttons: [],
  data: {},        // Tagged code blocks (keyed by tag name)
  cards: [],
  headings: [],
  items: [],       // Child content groups
}
```

### Main Content Identification

The `identifyMainContent()` function (src/processors/groups.js:282) determines if the first group should be treated as main content:
- Single group is always main content
- First group must have lower heading level than second group
- Divider mode affects main content identification

### Special Element Detection

The sequence processor identifies several special element types by inspecting paragraph content:
- **Links**: Paragraphs containing only a single link mark
- **Images**: Paragraphs with single image (role: 'image' or 'banner')
- **Icons**: Paragraphs with single image (role: 'icon')
- **Buttons**: Paragraphs with single text node having button mark
- **Videos**: Paragraphs with single image (role: 'video')

These are extracted into dedicated element types for easier downstream processing.

### Tagged Code Blocks

Code blocks with tags route parsed data to the `data` object:

```markdown
```json:nav-links
[{ "label": "Home", "href": "/" }]
```

```yaml:config
title: My Site
theme: dark
```
```

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

The parser implements the semantic conventions documented in `docs/guide.md`. Key patterns:

- **Pretitle Pattern**: Any heading followed by a more important heading (e.g., H3→H1, H2→H1, H6→H5, etc.)
- **Banner Pattern**: Image (with banner role or followed by heading) at start of first group
- **Divider Mode**: Presence of any `horizontalRule` switches entire document to divider-based grouping
- **Heading Groups**: Consecutive headings with increasing levels are consumed together
- **Main Content**: First group is main if it's the only group OR has lower heading level than second group
- **Body Headings**: Headings that overflow the header slots (title, subtitle, subtitle2) are automatically collected in `body.headings`

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
- The `processors_old/` directory contains legacy implementations - do not modify
- Context information in byType includes position, previous/next elements, and nearest heading
- Group splitting logic differs significantly between heading mode and divider mode
