# Content Mapping Patterns

This guide shows how to use the mapping utilities to transform parsed content into component-specific formats.

## Overview

The parser provides mapping utilities designed for two contexts:

- **Visual Editor Mode** (default): Gracefully handles content with silent cleanup, perfect for non-technical users
- **Build Mode**: Validates content and warns about issues, ideal for development workflows

### Mapping Tools

1. **Type System**: Automatic transformation based on field types (plaintext, richtext, excerpt, etc.)
2. **Helpers**: General-purpose utility functions
3. **Accessor**: Path-based extraction with schema support
4. **Extractors**: Pre-built patterns for common components

## Type System (Recommended)

The type system automatically transforms content based on component requirements, making it perfect for visual editors where users don't know about HTML/markdown.

### Visual Editor Mode (Default)

Gracefully handles content issues with silent, automatic cleanup:

```js
const schema = {
  title: {
    path: "groups.main.header.title",
    type: "plaintext",  // Auto-strips HTML markup
    maxLength: 60       // Auto-truncates with smart boundaries
  },
  description: {
    path: "groups.main.body.paragraphs",
    type: "excerpt",    // Auto-creates excerpt from paragraphs
    maxLength: 150
  },
  image: {
    path: "groups.main.body.imgs[0].url",
    type: "image",      // Normalizes image data
    defaultValue: "/placeholder.jpg",
    treatEmptyAsDefault: true
  }
};

// Visual editor mode (default) - silent cleanup
const data = mappers.extractBySchema(parsed, schema);
// {
//   title: "Welcome to Our Platform",  // <strong> tags stripped
//   description: "Get started with...", // Truncated, markup removed
//   image: "/hero.jpg" or "/placeholder.jpg"
// }
```

### Build Mode

Validates content and provides warnings for developers:

```js
const data = mappers.extractBySchema(parsed, schema, { mode: 'build' });

// Console output:
// ⚠️ [title] Field contains HTML markup but expects plain text (auto-fixed)
// ⚠️ [title] Text is 65 characters (max: 60) (auto-fixed)
```

### Available Field Types

#### `plaintext`

Strips all HTML markup, returning clean text. Perfect for titles, labels, and anywhere HTML shouldn't appear.

```js
{
  title: {
    path: "groups.main.header.title",
    type: "plaintext",
    maxLength: 60,              // Auto-truncate
    boundary: "word",            // or "sentence", "character"
    ellipsis: "...",
    transform: (text) => text.toUpperCase()  // Additional transform
  }
}

// Input: "Welcome to <strong>Our Platform</strong>"
// Output: "Welcome to Our Platform"
```

#### `richtext`

Preserves safe HTML while removing dangerous tags (script, iframe, etc.).

```js
{
  description: {
    path: "groups.main.body.paragraphs[0]",
    type: "richtext",
    allowedTags: ["strong", "em", "a", "br"],  // Customize allowed tags
    stripTags: ["script", "style"]              // Additional tags to remove
  }
}

// Input: "Text with <strong>bold</strong> and <script>bad</script>"
// Output: "Text with <strong>bold</strong> and "
```

#### `excerpt`

Auto-generates excerpt from content, stripping markup and truncating intelligently.

```js
{
  excerpt: {
    path: "groups.main.body.paragraphs",
    type: "excerpt",
    maxLength: 150,
    boundary: "word",             // or "sentence"
    preferFirstSentence: true     // Use first sentence if short enough
  }
}

// Input: ["Long paragraph with <em>formatting</em>...", "More text..."]
// Output: "Long paragraph with formatting..."
```

#### `number`

Parses and optionally formats numbers.

```js
{
  price: {
    path: "groups.main.header.title",
    type: "number",
    format: {
      decimals: 2,
      thousands: ",",
      decimal: "."
    }
  }
}

// Input: "1234.567"
// Output: "1,234.57"
```

#### `image`

Normalizes image data structure.

```js
{
  image: {
    path: "groups.main.body.imgs[0]",
    type: "image",
    defaultValue: "/placeholder.jpg",
    defaultAlt: "Image"
  }
}

// Input: "/hero.jpg" or { url: "/hero.jpg", alt: "Hero" }
// Output: { url: "/hero.jpg", alt: "Hero", caption: null }
```

#### `link`

Normalizes link data structure.

```js
{
  cta: {
    path: "groups.main.body.links[0]",
    type: "link"
  }
}

// Input: "http://example.com" or { href: "/page", label: "Click" }
// Output: { href: "/page", label: "Click", target: "_self" }
```

### Validation for UI Hints

Get validation results without extracting data - perfect for showing hints in visual editors:

```js
const hints = mappers.validateSchema(parsed, schema, { mode: 'visual-editor' });

// {
//   title: [{
//     type: 'max_length',
//     severity: 'info',
//     message: 'Text is 65 characters (max: 60)',
//     autoFix: true
//   }],
//   image: [{
//     type: 'required',
//     severity: 'error',
//     message: 'Required image is missing',
//     autoFix: false
//   }]
// }

// Use in UI:
// Title field: ℹ️ "Title is a bit long (will be trimmed to fit)"
// Image field: ⚠️ "Image is required"
```

### Real-World Example

```js
// Component declares its content requirements
const componentSchema = {
  brand: {
    path: "groups.main.header.pretitle",
    type: "plaintext",
    maxLength: 20,
    transform: (text) => text.toUpperCase()
  },
  title: {
    path: "groups.main.header.title",
    type: "plaintext",
    maxLength: 60,
    required: true
  },
  subtitle: {
    path: "groups.main.header.subtitle",
    type: "plaintext",
    maxLength: 100
  },
  description: {
    path: "groups.main.body.paragraphs",
    type: "excerpt",
    maxLength: 200
  },
  image: {
    path: "groups.main.body.imgs[0].url",
    type: "image",
    defaultValue: "/placeholder.jpg"
  },
  cta: {
    path: "groups.main.body.links[0]",
    type: "link"
  }
};

// Engine extracts and transforms for component
const componentData = mappers.extractBySchema(parsed, componentSchema);

// Component receives clean, validated data:
// {
//   brand: "NEW PRODUCT",
//   title: "Welcome to Our Platform",
//   subtitle: "Get started today",
//   description: "Transform how you create content...",
//   image: "/hero.jpg",
//   cta: { href: "/signup", label: "Get Started", target: "_self" }
// }
```

---

## Quick Start

```js
import { parseContent, mappers } from "@uniweb/semantic-parser";

const parsed = parseContent(doc);

// Use a pre-built extractor
const heroData = mappers.extractors.hero(parsed);

// Or use schema-based extraction
const customData = mappers.extractBySchema(parsed, {
  title: "groups.main.header.title",
  image: { path: "groups.main.body.imgs[0].url", defaultValue: "/placeholder.jpg" }
});
```

## Helper Utilities

### Array Helpers

```js
const { helpers } = mappers;

// Get first item with default
const image = helpers.first(images, "/default.jpg");

// Get last item
const lastParagraph = helpers.last(paragraphs);

// Transform array
const titles = helpers.transformArray(items, item => item.header.title);

// Filter and transform
const h2s = helpers.filterArray(headings, h => h.level === 2, h => h.content);

// Join text
const description = helpers.joinText(paragraphs, " ");

// Compact (remove null/undefined/empty)
const cleanArray = helpers.compact([null, "text", "", undefined, "more"]);
// => ["text", "more"]
```

### Object Helpers

```js
// Get nested value safely
const title = helpers.get(parsed, "groups.main.header.title", "Untitled");

// Pick specific properties
const metadata = helpers.pick(parsed.groups.main, ["header", "banner"]);

// Omit properties
const withoutMetadata = helpers.omit(item, ["metadata"]);
```

### Validation

```js
// Check if value exists (not null/undefined/empty string)
if (helpers.exists(title)) {
  // title has a value
}

// Validate required fields
const validation = helpers.validateRequired(data, ["title", "image"]);
if (!validation.valid) {
  console.log("Missing fields:", validation.missing);
}
```

### Safe Extraction

```js
// Wrap extraction in try-catch
const safeExtractor = helpers.safe((parsed) => {
  return parsed.groups.main.header.title.toUpperCase();
}, "DEFAULT");

const title = safeExtractor(parsed); // Won't throw if path is invalid
```

## Path-Based Accessor

### Basic Usage

```js
const { accessor } = mappers;

// Simple path
const title = accessor.getByPath(parsed, "groups.main.header.title");

// Array index notation
const firstImage = accessor.getByPath(parsed, "groups.main.body.imgs[0].url");

// With default value
const image = accessor.getByPath(parsed, "groups.main.body.imgs[0].url", {
  defaultValue: "/placeholder.jpg"
});

// With transformation
const description = accessor.getByPath(parsed, "groups.main.body.paragraphs", {
  transform: (paragraphs) => paragraphs.join(" ")
});

// Required field (throws if missing)
const title = accessor.getByPath(parsed, "groups.main.header.title", {
  required: true
});
```

### Schema-Based Extraction

Extract multiple fields at once using a schema:

```js
const schema = {
  // Shorthand: just the path
  title: "groups.main.header.title",

  // Full config with options
  image: {
    path: "groups.main.body.imgs[0].url",
    defaultValue: "/placeholder.jpg"
  },

  description: {
    path: "groups.main.body.paragraphs",
    transform: (p) => p.join(" ")
  },

  cta: {
    path: "groups.main.body.links[0]",
    required: false
  }
};

const data = accessor.extractBySchema(parsed, schema);
// {
//   title: "...",
//   image: "..." or "/placeholder.jpg",
//   description: "...",
//   cta: {...} or null
// }
```

### Array Mapping

Extract data from array of items:

```js
// Simple: extract single field from each item
const titles = accessor.mapArray(parsed, "groups.items", "header.title");
// ["Item 1", "Item 2", "Item 3"]

// Complex: extract multiple fields from each item
const cards = accessor.mapArray(parsed, "groups.items", {
  title: "header.title",
  text: { path: "body.paragraphs", transform: p => p.join(" ") },
  image: { path: "body.imgs[0].url", defaultValue: "/default.jpg" }
});
// [
//   { title: "...", text: "...", image: "..." },
//   { title: "...", text: "...", image: "..." }
// ]
```

### Path Helpers

```js
// Check if path exists
if (accessor.hasPath(parsed, "groups.main.banner.url")) {
  // Banner exists
}

// Get first existing path
const image = accessor.getFirstExisting(parsed, [
  "groups.main.banner.url",
  "groups.main.body.imgs[0].url",
  "groups.items[0].body.imgs[0].url"
], "/fallback.jpg");
```

## Pre-Built Extractors

### Hero Component

Large header with title, image, and CTA:

```js
const heroData = mappers.extractors.hero(parsed);
// {
//   title: "Welcome",
//   subtitle: "Get started today",
//   kicker: "NEW",
//   description: "Join thousands of users...",
//   image: "/hero.jpg",
//   imageAlt: "Hero image",
//   banner: "/banner.jpg",
//   cta: { href: "/signup", label: "Get Started" },
//   button: { content: "Learn More", attrs: {...} }
// }
```

### Card Component

```js
// Single card from main content
const card = mappers.extractors.card(parsed);

// Multiple cards from items
const cards = mappers.extractors.card(parsed, { useItems: true });

// Specific card by index
const firstCard = mappers.extractors.card(parsed, { useItems: true, itemIndex: 0 });
```

### Article Content

```js
const article = mappers.extractors.article(parsed);
// {
//   title: "Article Title",
//   subtitle: "Subtitle",
//   kicker: "FEATURED",
//   author: "John Doe",
//   date: "2024-01-01",
//   banner: "/banner.jpg",
//   content: ["paragraph 1", "paragraph 2"],
//   images: [...],
//   videos: [...],
//   links: [...]
// }
```

### Statistics

```js
const stats = mappers.extractors.stats(parsed);
// [
//   { value: "12", label: "Partner Labs", description: "..." },
//   { value: "$25M", label: "Grant Funding", description: "..." }
// ]
```

### Navigation Menu

```js
const nav = mappers.extractors.navigation(parsed);
// [
//   {
//     label: "Products",
//     href: "/products",
//     children: [
//       { label: "Product 1", href: "/products/1", icon: "..." }
//     ]
//   }
// ]
```

### Features List

```js
const features = mappers.extractors.features(parsed);
// [
//   {
//     title: "Fast Performance",
//     subtitle: "Lightning quick",
//     description: "Our platform is optimized...",
//     icon: "<svg>...</svg>",
//     image: "/feature.jpg",
//     link: { href: "/learn-more", label: "Learn More" }
//   }
// ]
```

### Testimonials

```js
// Single testimonial
const testimonial = mappers.extractors.testimonial(parsed);

// Multiple testimonials from items
const testimonials = mappers.extractors.testimonial(parsed, { useItems: true });
// [
//   {
//     quote: "This product changed our workflow completely!",
//     author: "Jane Smith",
//     role: "CEO",
//     company: "Acme Inc",
//     image: "/jane.jpg",
//     imageAlt: "Jane Smith"
//   }
// ]
```

### FAQ

```js
const faqs = mappers.extractors.faq(parsed);
// [
//   {
//     question: "How does it work?",
//     answer: "Our platform uses advanced algorithms...",
//     links: [...]
//   }
// ]
```

### Pricing Tiers

```js
const tiers = mappers.extractors.pricing(parsed);
// [
//   {
//     name: "Pro",
//     price: "$29/month",
//     description: "For growing teams",
//     features: ["Unlimited users", "API access", "Priority support"],
//     cta: { href: "/signup", label: "Start Free Trial" },
//     highlighted: true
//   }
// ]
```

### Team Members

```js
const team = mappers.extractors.team(parsed);
// [
//   {
//     name: "Dr. Sarah Chen",
//     role: "Lead Researcher",
//     department: "Neuroscience",
//     bio: "Dr. Chen specializes in...",
//     image: "/sarah.jpg",
//     imageAlt: "Dr. Sarah Chen",
//     links: [{ href: "https://twitter.com/...", label: "Twitter" }]
//   }
// ]
```

### Gallery

```js
// All images
const allImages = mappers.extractors.gallery(parsed);

// Only from main content
const mainImages = mappers.extractors.gallery(parsed, { source: "main" });

// Only from items
const itemImages = mappers.extractors.gallery(parsed, { source: "items" });
// [
//   { url: "/image1.jpg", alt: "Image 1", caption: "Caption 1" },
//   { url: "/image2.jpg", alt: "Image 2", caption: "Caption 2" }
// ]
```

## Combining Utilities

You can combine helpers, accessors, and extractors for complex transformations:

```js
const { helpers, accessor, extractors } = mappers;

// Start with a pre-built extractor
const baseData = extractors.hero(parsed);

// Enhance with custom fields
const enhancedData = {
  ...baseData,
  // Add custom field using accessor
  customField: accessor.getByPath(parsed, "groups.main.metadata.custom"),

  // Transform array using helper
  relatedPosts: helpers.transformArray(
    accessor.getByPath(parsed, "groups.items", { defaultValue: [] }),
    item => ({
      title: item.header.title,
      link: helpers.first(item.body.links)
    })
  ),

  // Safe extraction with fallback
  safeData: helpers.safe(() => {
    return parsed.groups.main.complexPath.deepValue.toUpperCase();
  }, "DEFAULT")
};
```

## Engine Integration Example

In your component engine, you might use mappers like this:

```js
// Component provides a schema
const componentSchema = {
  content: {
    type: "hero", // Use pre-built extractor
    // OR
    mapping: {    // Use custom mapping
      brand: "groups.main.header.pretitle",
      title: "groups.main.header.title",
      subtitle: "groups.main.header.subtitle",
      image: { path: "groups.main.body.imgs[0].url", defaultValue: "/default.jpg" },
      actions: {
        path: "groups.main.body.links",
        transform: links => links.map(l => ({ label: l.label, type: "primary" }))
      }
    }
  }
};

// Engine maps content before passing to component
function prepareComponentData(doc, schema) {
  const parsed = parseContent(doc);

  if (schema.content.type) {
    // Use named extractor
    return mappers.extractors[schema.content.type](parsed);
  } else if (schema.content.mapping) {
    // Use custom schema
    return mappers.accessor.extractBySchema(parsed, schema.content.mapping);
  }

  // Fallback to standard parsed structure
  return parsed;
}
```

## Rendering Extracted Content

After extracting content, you need to render it in your components. The parser works with content that may contain paragraph arrays, rich HTML, and formatting marks.

### Text Component Pattern

A **Text component** is recommended for rendering extracted content. See the [Text Component Reference](./text-component-reference.md) for a complete implementation guide.

#### Why Use a Text Component?

The parser's extractors return content in flexible formats:
- **Arrays of paragraphs** - `["Para 1", "Para 2"]`
- **Rich HTML** - `"Welcome to <strong>our platform</strong>"`
- **Color marks** - `"Title with <mark class='brand'>highlight</mark>"`

A Text component handles all these cases automatically.

#### Quick Example

```jsx
import { parseContent, mappers } from '@uniweb/semantic-parser';
import { H1, P } from './components/Text'; // See docs/text-component-reference.md

const parsed = parseContent(doc);
const hero = mappers.extractors.hero(parsed);

// Simple rendering
<>
  <H1 text={hero.title} />
  {hero.subtitle && <H2 text={hero.subtitle} />}
  <P text={hero.description} />
</>
```

#### Handling Paragraph Arrays

Extractors now return paragraph arrays to preserve structure:

```jsx
// hero.description is an array: ["First para", "Second para"]
<P text={hero.description} />
// Renders: <p>First para</p><p>Second para</p>

// If you need a single string, use joinParagraphs
import { joinParagraphs } from '@uniweb/semantic-parser/mappers/helpers';

<P text={joinParagraphs(hero.description, '\n\n')} />
// Renders: <p>First para\n\nSecond para</p>
```

#### Multi-line Headings

```jsx
// heading.title might be an array for multi-line titles
<H1 text={heading.title} />

// Example: ["Welcome to", "Our Platform"]
// Renders: <h1><div>Welcome to</div><div>Our Platform</div></h1>
```

#### Complete Integration Example

```jsx
import { parseContent, mappers } from '@uniweb/semantic-parser';
import { H1, H2, H3, P } from './components/Text';

function HeroSection({ document }) {
  // Parse and extract
  const parsed = parseContent(document);
  const hero = mappers.extractors.hero(parsed);

  return (
    <section className="hero">
      {hero.kicker && <div className="kicker">{hero.kicker}</div>}
      <H1 text={hero.title} className="hero-title" />
      {hero.subtitle && <H2 text={hero.subtitle} className="hero-subtitle" />}
      <P text={hero.description} className="hero-description" />
      {hero.image && <img src={hero.image} alt={hero.imageAlt} />}
      {hero.cta && (
        <a href={hero.cta.href} className="cta-button">
          {hero.cta.text}
        </a>
      )}
    </section>
  );
}
```

#### Rendering Lists

```jsx
function FeaturesList({ document }) {
  const parsed = parseContent(document);
  const features = mappers.extractors.features(parsed);

  return (
    <div className="features-grid">
      {features.map((feature, i) => (
        <div key={i} className="feature-card">
          {feature.icon && <img src={feature.icon} alt="" />}
          <H3 text={feature.title} />
          {feature.subtitle && <P text={feature.subtitle} className="subtitle" />}
          <P text={feature.description} />
        </div>
      ))}
    </div>
  );
}
```

### Sanitization Strategy

**Important:** Sanitize at the engine level, not in components.

```javascript
// ✅ Good - sanitize during data preparation
import { sanitizeHtml } from '@uniweb/semantic-parser/mappers/types';

function prepareHeroData(parsed) {
  const hero = mappers.extractors.hero(parsed);

  return {
    ...hero,
    title: sanitizeHtml(hero.title, {
      allowedTags: ['strong', 'em', 'mark', 'span'],
      allowedAttr: ['class', 'data-variant']
    }),
    description: hero.description.map(p => sanitizeHtml(p))
  };
}

const safeHeroData = prepareHeroData(parsed);
<H1 text={safeHeroData.title} />
```

```javascript
// ❌ Avoid - sanitizing in component on every render
function Hero({ data }) {
  const safeTitle = sanitizeHtml(data.title); // Runs every render!
  return <H1 text={safeTitle} />;
}
```

#### When to Sanitize

- **Always**: External content, user-generated content
- **Optional**: Trusted TipTap editor with locked schema
- **Never needed**: Hard-coded content in your app

See [Text Component Reference - Sanitization](./text-component-reference.md#sanitization-tools) for detailed guidance.

### Helper Functions for Rendering

```javascript
import {
  joinParagraphs,
  excerptFromParagraphs,
  countWords
} from '@uniweb/semantic-parser/mappers/helpers';

// Join paragraphs for single-string display
const singlePara = joinParagraphs(hero.description, ' ');

// Create excerpt for preview
const excerpt = excerptFromParagraphs(article.content, {
  maxLength: 150
});

// Count words for reading time estimate
const wordCount = countWords(article.content);
const readingTime = Math.ceil(wordCount / 200); // ~200 words/min
```

### Color Marks in Headings

The parser supports color marks for visual emphasis:

```jsx
// Content with color mark
const title = "Welcome to <mark class='brand'>Our Platform</mark>";

<H1 text={title} />
```

**CSS for Color Marks:**

```css
mark.brand {
  background: linear-gradient(
    120deg,
    var(--brand-color) 0%,
    var(--brand-color) 100%
  );
  background-repeat: no-repeat;
  background-size: 100% 40%;
  background-position: 0 85%;
  color: inherit;
  padding: 0;
}
```

**Ensure sanitization allows marks:**

```javascript
sanitizeHtml(content, {
  allowedTags: ['strong', 'em', 'mark', 'span'],
  allowedAttr: ['class', 'data-variant']
});
```

## Best Practices

1. **Start with extractors**: Use pre-built patterns when they match your needs
2. **Customize gradually**: Override specific fields from extractors if needed
3. **Use schemas for clarity**: Schema-based extraction is self-documenting
4. **Provide defaults**: Always specify default values for optional fields
5. **Safe extraction**: Use `helpers.safe()` when accessing uncertain paths
6. **Validate**: Use `validateRequired()` for critical fields
7. **Type safety**: Consider adding TypeScript definitions for your schemas
8. **Sanitize at engine level**: Sanitize once during data preparation, not in components
9. **Preserve arrays**: Keep paragraph arrays when possible for better rendering control
10. **Use Text component**: Adopt the reference Text component for consistent rendering

## Contributing Patterns

If you develop a common pattern that could benefit others, consider contributing it as a new extractor. Common patterns include:

- Product cards
- Event listings
- Timeline entries
- Contact forms
- Newsletter signups
- Social proof sections
- Comparison tables
