# API Reference

## parseContent(doc, options)

Parses a ProseMirror/TipTap document into three semantic views.

### Import

```js
import { parseContent } from '@uniwebcms/semantic-parser';
```

### Parameters

- `doc` (Object): A ProseMirror/TipTap document object with `type: "doc"` and `content` array
- `options` (Object, optional): Parsing options
  - `parseCodeAsJson` (boolean): Parse code blocks as JSON for properties. Default: false

**Note:** Body headings are always collected automatically - no configuration needed.

### Returns

An object with four properties providing different views of the content:

```js
{
  raw: Object,      // Original ProseMirror document
  sequence: Array,  // Flat sequence of elements
  groups: Object,   // Semantic content groups
  byType: Object    // Elements organized by type
}
```

## Return Value Structure

### `raw`

The original ProseMirror document passed as input, unchanged.

### `sequence`

A flat array of semantic elements extracted from the document tree.

**Element Types:**

```js
// Heading
{
  type: "heading",
  level: 1,              // 1-6
  content: "Text content with <strong>HTML</strong> formatting"
}

// Paragraph
{
  type: "paragraph",
  content: "Text with <em>inline</em> <a href=\"...\">formatting</a>"
}

// List
{
  type: "list",
  style: "bullet" | "ordered",
  items: [
    {
      content: [/* array of elements */],
      items: [/* nested list items */]
    }
  ]
}

// Image
{
  type: "image",
  src: "path/to/image.jpg",
  alt: "Alt text",
  caption: "Caption text",
  role: "background" | "content" | "banner" | "icon"
}

// Icon (SVG)
{
  type: "icon",
  svg: "<svg>...</svg>"
}

// Video
{
  type: "video",
  src: "path/to/video.mp4",
  alt: "Alt text",
  caption: "Caption text"
}

// Link (paragraph containing only a link)
{
  type: "link",
  content: {
    href: "https://example.com",
    label: "Link text"
  }
}

// Button
{
  type: "button",
  content: "Button text",
  attrs: {
    // Button-specific attributes
  }
}

// Divider (horizontal rule)
{
  type: "divider"
}
```

### `groups`

Content organized into semantic groups with identified main content and items.

```js
{
  main: {
    header: {
      pretitle: "PRETITLE TEXT",  // H3 before main title
      title: "Main Title",         // First heading in group
      subtitle: "Subtitle"         // Second heading in group
    },
    body: {
      paragraphs: ["paragraph text", ...],
      imgs: [
        { url: "...", caption: "...", alt: "..." }
      ],
      icons: ["<svg>...</svg>", ...],
      videos: [
        { src: "...", caption: "...", alt: "..." }
      ],
      links: [
        { href: "...", label: "..." }
      ],
      lists: [
        [/* processed list items */]
      ],
      buttons: [
        { content: "...", attrs: {...} }
      ],
      properties: [],       // Code block content
      propertyBlocks: [],   // Array of code blocks
      cards: [],            // Not yet implemented
      headings: []          // Used in list items
    },
    banner: {
      url: "path/to/banner.jpg",
      caption: "Banner caption",
      alt: "Banner alt text"
    } | null,
    metadata: {
      level: 1,             // Heading level that started this group
      contentTypes: {}      // Set of content types in group
    }
  },
  items: [
    // Array of groups with same structure as main
  ],
  metadata: {
    dividerMode: false,     // Whether dividers were used for grouping
    groups: 0               // Total number of groups
  }
}
```

**Grouping Modes:**

1. **Heading-based grouping** (default): Groups start with heading patterns
2. **Divider-based grouping**: When any `horizontalRule` is present, groups are split by dividers

**Main Content Identification:**

- Single group → always main content
- Multiple groups → first group is main if it has lower heading level than second group
- Divider mode starting with divider → no main content, all items

### `byType`

Elements organized by type with positional context.

```js
{
  headings: [
    {
      type: "heading",
      level: 1,
      content: "Title",
      context: {
        position: 0,
        previousElement: null,
        nextElement: { type: "paragraph", ... },
        nearestHeading: null
      }
    }
  ],
  paragraphs: [
    {
      type: "paragraph",
      content: "Text",
      context: { ... }
    }
  ],
  images: {
    background: [/* images with role="background" */],
    content: [/* images with role="content" */],
    gallery: [/* images with role="gallery" */],
    icon: [/* images with role="icon" */]
  },
  lists: [/* list elements with context */],
  dividers: [/* divider elements with context */],
  metadata: {
    totalElements: 10,
    dominantType: "paragraph",
    hasMedia: true
  },

  // Helper methods
  getHeadingsByLevel(level),
  getElementsByHeadingContext(headingFilter)
}
```

**Helper Methods:**

```js
// Get all H1 headings
byType.getHeadingsByLevel(1)

// Get all elements under headings matching a filter
byType.getElementsByHeadingContext((heading) => heading.level === 2)
```

## Usage Examples

### Basic Usage

```js
import { parseContent } from "@uniwebcms/semantic-parser";

const doc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Welcome" }]
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Get started today." }]
    }
  ]
};

const result = parseContent(doc);
```

### Working with Groups

```js
const { groups } = parseContent(doc);

// Access main content
console.log(groups.main.header.title);
console.log(groups.main.body.paragraphs);

// Iterate through content items
groups.items.forEach(item => {
  console.log(item.header.title);
  console.log(item.body.paragraphs);
});
```

### Working with byType

```js
const { byType } = parseContent(doc);

// Get all images
const allImages = Object.values(byType.images).flat();

// Get all H2 headings
const h2Headings = byType.getHeadingsByLevel(2);

// Get content under specific headings
const featuresContent = byType.getElementsByHeadingContext(
  h => h.content.includes("Features")
);
```

### Working with Sequence

```js
const { sequence } = parseContent(doc);

// Process elements in order
sequence.forEach(element => {
  switch(element.type) {
    case 'heading':
      console.log(`H${element.level}: ${element.content}`);
      break;
    case 'paragraph':
      console.log(`P: ${element.content}`);
      break;
  }
});
```

## Text Formatting

The parser preserves inline formatting as HTML tags within text content:

- **Bold**: `<strong>text</strong>`
- **Italic**: `<em>text</em>`
- **Links**: `<a href="url">text</a>`

```js
// Input
{
  type: "paragraph",
  content: [
    { type: "text", text: "Normal " },
    { type: "text", marks: [{ type: "bold" }], text: "bold" }
  ]
}

// Output
{
  type: "paragraph",
  content: "Normal <strong>bold</strong>"
}
```

## Special Element Detection

The parser detects special patterns and extracts them as dedicated element types:

- **Paragraph with only a link** → `type: "link"`
- **Paragraph with only an image** (role: image/banner) → `type: "image"`
- **Paragraph with only an icon** (role: icon) → `type: "icon"`
- **Paragraph with only a button mark** → `type: "button"`
- **Paragraph with only a video** (role: video) → `type: "video"`

This makes it easier to identify and handle these special cases in downstream processing.
