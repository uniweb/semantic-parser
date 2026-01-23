# Semantic Parser Entity Consolidation

This document defines the standard semantic entities output by the parser and how editor-specific node types map to them.

## Design Principle

**Editor nodes are authoring conveniences → Parser outputs standardized semantic entities**

The semantic parser accepts ProseMirror/TipTap documents from two sources:
1. **File-based markdown** via `@uniweb/content-reader`
2. **Visual editor** via TipTap with custom node types

Both sources must produce the same standardized output. Editor-specific node types (like `card-group`, `FormBlock`, `button` node) are conveniences that map to standard entities.

---

## Standard Entity Set

After consolidation, the parser outputs this flat structure:

```js
{
    // Header fields (from headings)
    title: '',
    pretitle: '',
    subtitle: '',
    subtitle2: '',

    // Body fields
    paragraphs: [],    // Text blocks with inline HTML formatting
    links: [],         // All link-like entities (buttons, documents, nav links)
    imgs: [],          // All images (with role distinguishing purpose)
    videos: [],        // Video embeds
    icons: [],         // Standalone icons
    lists: [],         // Bullet/ordered lists (recursive structure)
    quotes: [],        // Blockquotes (recursive structure)
    data: {},          // Structured data (tagged code blocks, forms, cards)
    headings: [],      // Overflow headings after title/subtitle/subtitle2

    items: [],         // Semantic groups (same structure recursively)
}
```

### Removed Fields

| Field | Status | Reason |
|-------|--------|--------|
| `alignment` | **Deprecated** | Editor-only concept, not expressible in markdown |
| `buttons` | **Merged into `links`** | Buttons are styled links |
| `cards` | **Merged into `data`** | Structured data with schema tag |
| `documents` | **Merged into `links`** | Documents are downloadable links |
| `forms` | **Merged into `data`** | Structured data with `form` tag |

---

## Entity Specifications

### Links

All link-like content merges into the `links` array. The `role` attribute distinguishes behavior.

```js
{
    href: "/contact",
    label: "Contact Us",

    // Role distinguishes link type
    role: "link",           // Default: standard hyperlink
         | "button"         // Call-to-action button
         | "button-primary" // Primary CTA
         | "button-outline" // Outline style button
         | "nav-link"       // Navigation link
         | "footer-link"    // Footer navigation
         | "document"       // Downloadable file

    // Button-specific attributes (when role is button-*)
    variant: "primary" | "secondary" | "outline" | "ghost",
    size: "sm" | "md" | "lg",
    icon: "icon-name",

    // Link behavior
    target: "_blank" | "_self",
    rel: "noopener noreferrer",
    download: true | "filename.pdf",
}
```

**Markdown syntax:**
```markdown
[Standard link](/page)
[Button link](button:/action){variant=primary}
[Download](report.pdf){download}
```

### Images

All image content uses the `imgs` array. The `role` attribute distinguishes purpose.

```js
{
    url: "/images/hero.jpg",
    alt: "Hero image",
    caption: "Optional caption",

    // Role distinguishes image purpose
    role: "image",      // Default: content image
         | "icon"       // Small icon/logo
         | "background" // Section background
         | "gallery"    // Gallery item
         | "banner"     // Hero/banner image

    // Layout attributes
    direction: "left" | "right" | "center",
    size: "basic" | "lg" | "full",

    // Styling
    filter: "grayscale" | "blur",
    theme: "light" | "dark",

    // Link wrapper (clickable image)
    href: "/link-target",
}
```

### Data (Structured Content)

The `data` object holds all structured content from tagged code blocks and editor widgets.

```js
{
    // From tagged code blocks
    "form": { fields: [...], submitLabel: "Send" },
    "nav-links": [{ label: "Home", href: "/" }],
    "config": { theme: "dark" },

    // From editor card widgets (mapped by type)
    "person": [
        { name: "John", title: "CEO", ... },
        { name: "Jane", title: "CTO", ... },
    ],
    "event": [
        { title: "Launch Party", date: "2024-01-15", location: "NYC", ... },
    ],
}
```

**Markdown syntax for structured data:**
```markdown
```yaml:form
fields:
  - name: email
    type: email
    required: true
submitLabel: Subscribe
```

```yaml:nav-links
- label: Home
  href: /
```
```

JSON is also supported (`json:tag-name`) if you prefer.

---

## Editor Node Mappings

This section documents how TipTap/editor-specific nodes map to standard entities.

### `button` Node → `links[]`

**Editor input:**
```js
{
    type: "button",
    content: [{ type: "text", text: "Click me" }],
    attrs: {
        href: "/action",
        variant: "primary",
        size: "lg",
        icon: "arrow-right"
    }
}
```

**Standard output:**
```js
links: [{
    href: "/action",
    label: "Click me",
    role: "button",
    variant: "primary",
    size: "lg",
    icon: "arrow-right"
}]
```

### `FormBlock` Node → `data.form`

**Editor input:**
```js
{
    type: "FormBlock",
    attrs: {
        data: {
            fields: [{ name: "email", type: "email" }],
            submitLabel: "Subscribe"
        }
    }
}
```

**Standard output:**
```js
data: {
    form: {
        fields: [{ name: "email", type: "email" }],
        submitLabel: "Subscribe"
    }
}
```

### `card-group` Node → `data[cardType]`

Cards are editor widgets for structured entities like people, events, addresses. Each card type becomes a key in `data`, with an array of all cards of that type. This follows the same pattern as tagged code blocks.

**Editor input:**
```js
{
    type: "card-group",
    content: [
        {
            type: "card",
            attrs: {
                cardType: "person",
                title: "Jane Doe",
                subtitle: "CEO",
                coverImg: { src: "/jane.jpg" },
                address: '{"city": "NYC"}',
                icon: { svg: "..." }
            }
        },
        {
            type: "card",
            attrs: {
                cardType: "person",
                title: "John Smith",
                subtitle: "CTO",
                coverImg: { src: "/john.jpg" }
            }
        },
        {
            type: "card",
            attrs: {
                cardType: "event",
                title: "Launch Party",
                date: "2024-03-15",
                location: "San Francisco"
            }
        }
    ]
}
```

**Standard output:**
```js
data: {
    person: [
        {
            title: "Jane Doe",
            subtitle: "CEO",
            coverImg: "/jane.jpg",
            address: { city: "NYC" },
            icon: { svg: "..." }
        },
        {
            title: "John Smith",
            subtitle: "CTO",
            coverImg: "/john.jpg"
        }
    ],
    event: [
        {
            title: "Launch Party",
            date: "2024-03-15",
            location: "San Francisco"
        }
    ]
}
```

**Accessing cards by type:**
```js
// Get all person cards
const people = content.data.person || [];

// Get all event cards
const events = content.data.event || [];
```

**Card schemas:**
| Schema | Common Fields |
|--------|---------------|
| `person` | title (name), subtitle (role), coverImg (photo), address |
| `event` | title, date, location, description |
| `address` | street, city, state, country, postal |
| `document` | title, href, coverImg (preview), fileType |

### `document-group` Node → `links[]`

Documents are downloadable files. They map to links with `role: "document"`.

**Editor input:**
```js
{
    type: "document-group",
    content: [
        {
            type: "document",
            attrs: {
                title: "Annual Report",
                src: "/reports/annual-2024.pdf",
                coverImg: { src: "/preview.jpg" }
            }
        }
    ]
}
```

**Standard output:**
```js
links: [{
    href: "/reports/annual-2024.pdf",
    label: "Annual Report",
    role: "document",
    download: true,
    preview: "/preview.jpg"
}]
```

---

## Deprecation: `alignment`

The `alignment` field was extracted from heading's `textAlign` attribute in the editor. This is an editor-specific styling concern that:
- Cannot be expressed in file-based markdown
- Is a presentation concern, not semantic content
- Should be handled by component styling, not content structure

**Migration:** Components relying on `content.alignment` should:
1. Use CSS/Tailwind for text alignment
2. Or accept alignment as a component `param` in frontmatter

---

## Migration Path

### Phase 1: Add Mappings (Non-Breaking)

1. Continue outputting legacy fields (`buttons`, `cards`, `documents`, `forms`, `alignment`)
2. Also populate new locations (`links` for buttons/documents, `data` for cards/forms)
3. Components can migrate gradually

### Phase 2: Deprecation Warnings

1. Log warnings when legacy fields are accessed
2. Document migration for each field
3. Provide codemod or migration script

### Phase 3: Remove Legacy Fields

1. Remove `buttons`, `cards`, `documents`, `forms`, `alignment` from output
2. Update all components to use new structure
3. Update documentation

---

## Backwards Compatibility

During migration, the parser can provide a compatibility layer:

```js
// Parser option
const content = parse(doc, {
    legacyFields: true  // Include deprecated fields
});

// Or via getter that warns
Object.defineProperty(content, 'buttons', {
    get() {
        console.warn('content.buttons is deprecated, use content.links with role="button"');
        return content.links.filter(l => l.role?.startsWith('button'));
    }
});
```

---

## Component Migration Examples

### Before: Using `buttons`

```jsx
function CTA({ content }) {
    const { links, buttons } = content;
    return (
        <div>
            {links.map(link => <a href={link.href}>{link.label}</a>)}
            {buttons.map(btn => <button>{btn.content}</button>)}
        </div>
    );
}
```

### After: Unified `links`

```jsx
function CTA({ content }) {
    const { links } = content;
    const buttons = links.filter(l => l.role?.startsWith('button'));
    const plainLinks = links.filter(l => !l.role?.startsWith('button'));

    return (
        <div>
            {plainLinks.map(link => <a href={link.href}>{link.label}</a>)}
            {buttons.map(btn => (
                <a href={btn.href} className={`btn btn-${btn.variant}`}>
                    {btn.label}
                </a>
            ))}
        </div>
    );
}
```

### Or: Role-based rendering

```jsx
function CTA({ content }) {
    return (
        <div>
            {content.links.map(link => {
                if (link.role?.startsWith('button')) {
                    return <Button variant={link.variant}>{link.label}</Button>;
                }
                if (link.role === 'document') {
                    return <DownloadLink href={link.href}>{link.label}</DownloadLink>;
                }
                return <a href={link.href}>{link.label}</a>;
            })}
        </div>
    );
}
```

---

## Implementation Checklist

- [ ] Update `processGroupContent` in `groups.js` to map button → links
- [ ] Update `processGroupContent` to map card-group → data.cards
- [ ] Update `processGroupContent` to map document-group → links
- [ ] Update `processGroupContent` to map FormBlock → data.form
- [ ] Remove `alignment` from header extraction
- [ ] Add `legacyFields` option for backwards compatibility
- [ ] Update `flattenGroup` to use new structure
- [ ] Update tests for new entity structure
- [ ] Update AGENTS.md and README.md
- [ ] Create migration guide for components
