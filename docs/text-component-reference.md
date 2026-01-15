# Text Component Reference

A reference implementation of a smart typography component for rendering content from the semantic parser. This component is designed to handle the common patterns of rendering headings, paragraphs, and rich text content.

> **📦 Ready-to-use implementation:** [`reference/Text.js`](../reference/Text.js)
> **Installation guide:** [`reference/README.md`](../reference/README.md)

This is a **complete, production-ready implementation** that you can copy directly into your React project. See the [Installation](#installation) section below.

## Installation

**1. Copy the component to your project:**
```bash
cp reference/Text.js src/components/Text.js
```

**2. No additional dependencies needed** - Just React

**3. Sanitize at engine level** - See [Sanitization Tools](#sanitization-tools) below

**4. Use in your components:**
```jsx
import Text, { H1, P } from './components/Text';
import { parseContent, mappers } from '@uniwebcms/semantic-parser';

const parsed = parseContent(doc);
const hero = mappers.extractors.hero(parsed);

<H1 text={hero.title} />
<P text={hero.description} />
```

See [`reference/README.md`](../reference/README.md) for TypeScript setup and customization options.

## Overview

The Text component provides a unified interface for rendering text content, whether it's plain text, rich HTML, single strings, or arrays of paragraphs. It handles the complexities of:

- Rendering paragraph arrays with proper spacing
- Supporting rich HTML formatting (bold, italic, color marks)
- Semantic heading structures
- Empty content filtering

## Architecture Decision: Where to Sanitize

**Recommended: Sanitize at the engine level, not in the component.**

The semantic parser works with TipTap/ProseMirror editors that use schema-controlled HTML. The parser extracts and transforms this content, and your **engine** (the application layer that prepares data for components) should handle sanitization.

### Why Engine-Level Sanitization?

1. **Performance** - Sanitize once during data preparation, not on every render
2. **Context-aware** - Engine knows if content is from trusted TipTap or external sources
3. **Cacheable** - Sanitized content can be memoized
4. **Clear responsibility** - Engine owns the data pipeline

### Data Flow

```
TipTap Editor (schema-controlled)
    ↓
Parser (extraction + transformation)
    ↓
Engine (PRIMARY SANITIZATION HERE)
    ↓
Components (trust the data, just render)
```

The parser provides sanitization utilities (see [Sanitization Tools](#sanitization-tools)), but doesn't enforce their use. Your engine decides when and how to sanitize based on your security requirements.

## Implementation

### Basic Text Component

```jsx
import React from 'react';

/**
 * Text - A smart typography component for rendering content from semantic parser
 *
 * @param {Object} props
 * @param {string|string[]} props.text - Content to render (string or array of paragraphs)
 * @param {string} [props.as='p'] - HTML tag for wrapper/primary element
 * @param {string} [props.className] - CSS class for styling
 * @param {string} [props.lineAs] - Tag for array items (default: 'div' for headings, 'p' for others)
 */
const Text = ({ text, as = 'p', className, lineAs }) => {
  const isArray = Array.isArray(text);
  const Tag = as;
  const isHeading = as === 'h1' || as === 'h2' || as === 'h3' || as === 'h4' || as === 'h5' || as === 'h6';

  // Single string
  if (!isArray) {
    if (!text || text.trim() === '') return null;
    return (
      <Tag
        className={className}
        dangerouslySetInnerHTML={{ __html: text }}
      />
    );
  }

  // Array of strings - filter empty content
  const filteredText = text.filter(
    (item) => typeof item === 'string' && item.trim() !== ''
  );
  if (filteredText.length === 0) return null;

  const LineTag = lineAs || (isHeading ? 'div' : 'p');

  // Headings: wrap all lines in one heading tag
  if (isHeading) {
    return (
      <Tag className={className}>
        {filteredText.map((line, i) => (
          <LineTag
            key={i}
            dangerouslySetInnerHTML={{ __html: line }}
          />
        ))}
      </Tag>
    );
  }

  // Non-headings: render each line as separate element
  return (
    <>
      {filteredText.map((line, i) => (
        <LineTag
          key={i}
          className={className}
          dangerouslySetInnerHTML={{ __html: line }}
        />
      ))}
    </>
  );
};

export default Text;
```

### Semantic Wrapper Components

For better developer experience, create semantic shortcuts:

```jsx
// Heading components
export const H1 = (props) => <Text {...props} as="h1" />;
export const H2 = (props) => <Text {...props} as="h2" />;
export const H3 = (props) => <Text {...props} as="h3" />;
export const H4 = (props) => <Text {...props} as="h4" />;
export const H5 = (props) => <Text {...props} as="h5" />;
export const H6 = (props) => <Text {...props} as="h6" />;

// Paragraph component
export const P = (props) => <Text {...props} as="p" />;

// Div wrapper for flexible content
export const Div = (props) => <Text {...props} as="div" />;
```

## Usage with Semantic Parser

### Basic Examples

```jsx
import { parseContent } from '@uniwebcms/semantic-parser';
import { extractors } from '@uniwebcms/semantic-parser/mappers';
import { H1, P, Text } from './components/Text';

// Parse content
const parsed = parseContent(document);

// Extract hero data
const hero = extractors.hero(parsed);

// Render with Text components
<>
  <H1 text={hero.title} />
  {hero.subtitle && <H2 text={hero.subtitle} />}
  <P text={hero.description} />
</>
```

### Handling Arrays vs Strings

The parser's extractors now return paragraph arrays by default:

```jsx
// hero.description is an array: ["Para 1", "Para 2"]
<P text={hero.description} />
// Renders: <p>Para 1</p><p>Para 2</p>

// If you need a single string, use joinParagraphs helper
import { joinParagraphs } from '@uniwebcms/semantic-parser/mappers/helpers';

<P text={joinParagraphs(hero.description)} />
// Renders: <p>Para 1 Para 2</p>
```

### Multi-line Headings

```jsx
// heading.title might be an array for multi-line headings
<H1 text={heading.title} />

// Example with array: ["Welcome to", "Our Platform"]
// Renders: <h1><div>Welcome to</div><div>Our Platform</div></h1>
```

### Color Marks Support

The parser supports color marks for headings using `<mark>` or `<span>` tags:

```jsx
// Content with color mark
const title = "Welcome to <mark class='brand'>Our Platform</mark>";

<H1 text={title} />
// Renders with mark tag preserved (if sanitized properly)
```

**Sanitization Configuration for Color Marks:**

```javascript
// In your engine, when sanitizing
import { sanitizeHtml } from '@uniwebcms/semantic-parser/mappers/types';

const safeTitleContent = sanitizeHtml(titleContent, {
  allowedTags: ['strong', 'em', 'mark', 'span'],
  allowedAttr: ['class', 'data-variant']
});
```

### Empty Content Handling

The component automatically filters empty content:

```jsx
<P text={["Valid content", "", "  ", "More content"]} />
// Renders: <p>Valid content</p><p>More content</p>

<P text={[]} />
// Renders: null (nothing)
```

## Integration Patterns

### With Extractors

```jsx
import { parseContent, mappers } from '@uniwebcms/semantic-parser';
const { extractors, helpers } = mappers;

const parsed = parseContent(doc);
const card = extractors.card(parsed);

function Card({ data }) {
  return (
    <div className="card">
      <H3 text={data.title} />
      <P text={data.description} />
      {data.image && <img src={data.image} alt={data.imageAlt} />}
    </div>
  );
}

<Card data={card} />
```

### With Custom Schemas

```jsx
import { getByPath, extractBySchema } from '@uniwebcms/semantic-parser/mappers/accessor';

const schema = {
  title: { path: 'groups.main.header.title' },
  subtitle: { path: 'groups.main.header.subtitle' },
  content: { path: 'groups.main.body.paragraphs' }
};

const data = extractBySchema(parsed, schema);

<>
  <H1 text={data.title} />
  <H2 text={data.subtitle} />
  <P text={data.content} />
</>
```

### Rendering Lists

```jsx
const features = extractors.features(parsed);

<div className="features">
  {features.map((feature, i) => (
    <div key={i} className="feature">
      <H3 text={feature.title} />
      <P text={feature.description} />
    </div>
  ))}
</div>
```

## Styling

The component is unstyled by default. Add your own CSS:

```css
/* Paragraph spacing */
p + p {
  margin-top: 1.5rem;
}

/* Multi-line headings */
h1 > div + div {
  margin-top: 0.25rem;
}

/* Color marks */
mark.brand {
  background: linear-gradient(120deg, var(--brand-color) 0%, var(--brand-color) 100%);
  background-repeat: no-repeat;
  background-size: 100% 40%;
  background-position: 0 85%;
  color: inherit;
}
```

## Sanitization Tools

The parser exports sanitization utilities for use in your engine:

```javascript
import { sanitizeHtml, stripMarkup } from '@uniwebcms/semantic-parser/mappers/types';

// Sanitize HTML content
const safe = sanitizeHtml(content, {
  allowedTags: ['strong', 'em', 'mark', 'span', 'a'],
  allowedAttr: ['href', 'class', 'data-variant']
});

// Strip all HTML (for plain text)
const plain = stripMarkup(content);
```

### When to Sanitize

**Always sanitize** when:
- Content comes from external sources
- Content is user-generated
- You're unsure of the source

**Optional sanitization** when:
- Content is from your controlled TipTap editor
- TipTap schema is locked down
- You trust the content pipeline

**Never needed** when:
- Content is hard-coded in your app
- Content is from your CMS with known schemas

## Advanced Customizations

### Custom Line Spacing

Add a `spacing` prop for different paragraph spacing:

```jsx
const Text = React.memo(({ text, as = 'p', className, lineAs, spacing = 'normal' }) => {
  const spacingClass = spacing !== 'normal' ? `spacing-${spacing}` : '';
  const combinedClass = [className, spacingClass].filter(Boolean).join(' ');

  // ... rest of implementation using combinedClass
});

// Usage
<P text={paragraphs} spacing="comfortable" />
```

```css
.spacing-compact p + p { margin-top: 0.75rem; }
.spacing-comfortable p + p { margin-top: 1.5rem; }
.spacing-relaxed p + p { margin-top: 2rem; }
```

### Plain Text Mode

Add an opt-out for HTML rendering:

```jsx
const Text = React.memo(({ text, as = 'p', className, lineAs, plainText = false }) => {
  // ... existing code

  if (plainText) {
    // Render without dangerouslySetInnerHTML
    return <Tag className={className}>{text}</Tag>;
  }

  // ... rest of implementation
});

// Usage
<Text text="Show <tags> literally" plainText={true} />
```

## Best Practices

### 1. Sanitize at Engine Level

```javascript
// ✅ Good - sanitize during data preparation
function prepareHeroData(parsed) {
  const hero = extractors.hero(parsed);
  return {
    ...hero,
    title: sanitizeHtml(hero.title),
    description: hero.description.map(p => sanitizeHtml(p))
  };
}

const heroData = prepareHeroData(parsed);
<H1 text={heroData.title} />
```

```javascript
// ❌ Avoid - sanitizing in component on every render
function Hero({ data }) {
  const safeTitle = sanitizeHtml(data.title); // Runs every render!
  return <H1 text={safeTitle} />;
}
```

### 2. Handle Empty Content

```javascript
// ✅ Good - component handles it
<P text={description} />

// ❌ Avoid - manual checks everywhere
{description && description.length > 0 && <P text={description} />}
```

### 3. Use Semantic Wrappers

```javascript
// ✅ Good - clear intent
<H1 text={title} />
<P text={content} />

// ❌ Avoid - verbose
<Text text={title} as="h1" />
<Text text={content} as="p" />
```

### 4. Preserve Arrays When Possible

```javascript
// ✅ Good - preserves paragraph structure
<P text={hero.description} />

// ⚠️ Consider if you really need this
<P text={joinParagraphs(hero.description)} />
```

## TypeScript Support

```typescript
interface TextProps {
  text: string | string[];
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'div' | 'span';
  className?: string;
  lineAs?: string;
  spacing?: 'compact' | 'normal' | 'comfortable' | 'relaxed';
  plainText?: boolean;
}

const Text: React.FC<TextProps> = ({ ... }) => { ... };
```

## Performance Considerations

1. **Sanitize once** - At engine level, not in component
2. **Memoize data** - Cache parsed/extracted data at the engine level with `useMemo`
3. **Filter early** - Remove empty content during extraction if possible
4. **Use proper keys** - In lists, use stable unique keys (not array indices)
5. **Batch updates** - Prepare all data before rendering

**Note:** The Text component itself is simple and fast. No need for `React.memo` unless profiling proves it's a bottleneck.

## Browser Support

- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Uses `dangerouslySetInnerHTML` (supported in all React versions)
- Server-side rendering compatible

## Security Notes

1. **Trust your pipeline** - If engine sanitizes, component can trust the data
2. **DOMPurify recommended** - Use in engine for sanitization
3. **TipTap content** - Generally safe due to schema control
4. **External content** - Always sanitize before rendering
5. **Color marks** - Ensure `class` and `data-variant` attributes are allowed

## Summary

- **Component is simple** - Just renders, doesn't sanitize
- **Engine sanitizes** - Once during data preparation
- **Parser provides tools** - Utilities available but not enforced
- **Flexible** - Handles strings, arrays, plain and rich text
- **Semantic** - Smart defaults for headings vs paragraphs
- **Performant** - Memoized, filters empty content automatically

Copy this implementation and adapt it to your needs. The key is keeping the component simple and moving complexity to your engine layer where you have full context and control.
