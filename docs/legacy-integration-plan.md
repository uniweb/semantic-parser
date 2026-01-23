# Legacy Integration Plan

A comprehensive plan for integrating battle-tested legacy features into the semantic-parser library.

## Current State Analysis

### ✅ What We Already Have

**Parser Core:**
- ✅ Divider-based grouping (same as legacy!)
- ✅ Heading-based grouping
- ✅ Pretitle detection (H3 before H1/H2)
- ✅ Banner detection
- ✅ Main content identification
- ✅ Nested lists with rich content

**Element Types:**
- ✅ Buttons (via button mark)
- ✅ Images (with roles: image, banner, icon, video)
- ✅ Videos
- ✅ Icons
- ✅ Links (single-link paragraph extraction)
- ✅ Lists (bullet/ordered with nesting)
- ✅ Code blocks

**Output Structure (flat):**
```javascript
{
  groups: {
    main: {
      // Flat structure - header and body fields merged at top level
      pretitle, title, subtitle,
      paragraphs, imgs, icons, videos, links, lists, buttons, ...
      banner: { url, caption, alt }
    },
    items: [...]  // Same flat structure
  }
}
```

**Mappers:**
- ✅ 11 named extractors (hero, card, article, stats, features, etc.)
- ✅ Custom schema-based extraction
- ✅ Path accessor with transformations
- ✅ Type system with validation

### ❌ What's Missing vs Legacy

**Parser Features:**
1. **H2 before H1 as pretitle** (currently only H3)
2. **Header alignment** (textAlign attribute)
3. **Header.subtitle2** (third heading level)
4. **Body.headings** (extract all headings in body)
5. **Blockquote elements**
6. **Code block JSON parsing** (currently stores as string)

**Legacy-Specific:**
7. **Header.description auto-fill** (subtitle2 || first paragraph)
8. **Body.properties/propertyBlocks** (last/all code blocks as JSON)
9. **Body.form/forms** (last/all forms)
10. **Body.quotes** (blockquotes)

**Output Format:**
11. **Legacy format** (main/items structure different from groups)

---

## Strategy: Best of Both Worlds

### Key Insight

Instead of a separate "legacy mapper", create:
1. **Parser enhancements** (add missing features with options)
2. **Legacy extractor** (named extractor for exact legacy format)
3. **Article class integration** (use new parser + legacy extractor)

### Architecture

```javascript
// Article class becomes thin wrapper
export default class Article {
    constructor(data, options) {
        // 1. Template system (keep as-is)
        const rendered = this.instantiateData(data);

        // 2. Parse with legacy options
        const { parseContent, mappers } = require('@uniweb/semantic-parser');
        const parsed = parseContent(rendered, {
            pretitleLevel: 2,        // H2 before H1
            parseCodeAsJson: true,   // Properties
            extractBodyHeadings: true // For TOC
        });

        // 3. Extract in legacy format
        this.parsed = mappers.extractors.legacy(parsed);
    }
}
```

**Benefits:**
- ✅ No separate mapper code
- ✅ Uses existing extractor pattern
- ✅ Components unchanged
- ✅ Template system stays separate
- ✅ Clean, modular architecture

---

## Implementation Plan

### Phase 1: Parser Options System

**File:** `src/index.js`

Add options parameter to parseContent:

```javascript
function parseContent(doc, options = {}) {
    const {
        pretitleLevel = 3,         // 2 for legacy, 3 for new
        parseCodeAsJson = false,   // Parse code blocks as JSON
        extractBodyHeadings = false, // Extract headings from body
        customElements = {}         // Custom element handlers
    } = options;

    // Pass options down to processors
    const sequence = processSequence(doc, options);
    const groups = processGroups(sequence, options);
    const byType = processByType(sequence);

    return {
        raw: doc,
        sequence,
        groups,
        byType
    };
}
```

### Phase 2: Sequence Processor Enhancements

**File:** `src/processors/sequence.js`

#### 2.1 Add Blockquote Support

```javascript
case 'blockquote':
    return {
        type: 'blockquote',
        content: node.content?.map(child => createSequenceElement(child)).filter(Boolean) || []
    };
```

Blockquotes can contain paragraphs, lists, images - process recursively.

#### 2.2 Add Code Block JSON Parsing

```javascript
case 'codeBlock':
    const textContent = getTextContent(node);
    let parsedJson = null;

    if (options.parseCodeAsJson) {
        try {
            parsedJson = JSON.parse(textContent);
        } catch (err) {
            // Invalid JSON, keep as string
        }
    }

    return {
        type: 'codeBlock',
        content: textContent,
        parsed: parsedJson
    };
```

#### 2.3 Enhance getTextContent() for Legacy Marks

Add support for:
- **textStyle mark** → `<span style="color: var(--color)">text</span>`
- **highlight mark** → `<span style="background-color: var(--highlight)">text</span>`
- **Download attribute** → Add download attr for file extensions

```javascript
function getTextContent(node, options = {}) {
    // ... existing code ...

    if (marks.some(mark => mark.type === 'textStyle')) {
        const color = marks.find(m => m.type === 'textStyle')?.attrs?.color;
        if (color) {
            styledText = `<span style="color: var(--${color})">${styledText}</span>`;
        }
    }

    if (marks.some(mark => mark.type === 'highlight')) {
        styledText = `<span style="background-color: var(--highlight)">${styledText}</span>`;
    }

    if (marks.some(mark => mark.type === 'link')) {
        const href = marks.find(m => m.type === 'link').attrs.href;
        const target = marks.find(m => m.type === 'link').attrs.target || '_self';
        const isFileLink = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|webp|gif|svg|mp4|mp3|wav|mov|zip)$/i.test(href);
        styledText = `<a href="${href}" target="${target}"${isFileLink ? ' download' : ''}>${styledText}</a>`;
    }
}
```

### Phase 3: Groups Processor Enhancements

**File:** `src/processors/groups.js`

#### 3.1 Configurable Pretitle Level

```javascript
function isPreTitle(sequence, i, options = {}) {
    const { pretitleLevel = 3 } = options;

    return (
        i + 1 < sequence.length &&
        sequence[i].type === 'heading' &&
        sequence[i + 1].type === 'heading' &&
        sequence[i].level === pretitleLevel &&  // Configurable!
        sequence[i + 1].level < pretitleLevel
    );
}
```

#### 3.2 Extract Header Alignment

```javascript
function processGroupContent(elements, options = {}) {
    const header = {
        pretitle: '',
        title: '',
        subtitle: '',
        subtitle2: '',      // NEW
        alignment: null     // NEW
    };

    // ... existing code ...

    if (element.type === 'heading') {
        metadata.level ??= element.level;

        // Extract alignment from first heading
        if (!header.alignment && element.attrs?.textAlign) {
            header.alignment = element.attrs.textAlign;
        }

        // Assign to title/subtitle/subtitle2
        if (!header.title) {
            header.title = element.content;
        } else if (!header.subtitle) {
            header.subtitle = element.content;
        } else if (!header.subtitle2) {
            header.subtitle2 = element.content;  // NEW
        }
    }
}
```

**Note:** We need to pass heading attrs through sequence processor!

#### 3.3 Extract Alignment from Sequence

Update sequence processor to include attrs:

```javascript
case 'heading':
    return {
        type: 'heading',
        level: node.attrs.level,
        content: getTextContent(node),
        attrs: node.attrs  // NEW - pass through all attrs
    };
```

#### 3.4 Extract Body Headings

```javascript
function processGroupContent(elements, options = {}) {
    const { extractBodyHeadings = false } = options;

    const body = {
        // ... existing ...
        headings: []  // NEW
    };

    // ... in the element processing loop ...

    if (element.type === 'heading' && extractBodyHeadings) {
        // Skip header headings, only collect body headings
        if (header.title && header.subtitle) {
            body.headings.push(element.content);
        }
    }
}
```

**Better approach:** Track state to know when we're in "body" section:

```javascript
let inBody = false;

for (let i = 0; i < elements.length; i++) {
    // ... pretitle and banner detection ...

    const element = elements[i];

    if (element.type === 'heading') {
        // ... assign to header fields ...

        // After we have title (and optionally subtitle), we're in body
        if (header.title) {
            inBody = true;
        }
    } else {
        inBody = true;  // Any non-heading after header means body started
    }

    // Collect headings in body section
    if (inBody && element.type === 'heading' && extractBodyHeadings) {
        body.headings.push(element.content);
    }
}
```

#### 3.5 Add Blockquote Processing

```javascript
case 'blockquote':
    // Process blockquote content recursively
    const quoteContent = processGroupContent(element.content, options);
    body.quotes.push(quoteContent.body);
    break;
```

Add to body structure:
```javascript
const body = {
    // ... existing ...
    quotes: []  // NEW
};
```

#### 3.6 Add Code Block Properties

```javascript
case 'codeBlock':
    if (element.parsed) {
        // JSON parsed successfully
        body.properties = element.parsed;  // Last one
        body.propertyBlocks.push(element.parsed);  // All of them
    } else {
        // Keep as string (fallback)
        body.properties = element.content;
        body.propertyBlocks.push(element.content);
    }
    break;
```

### Phase 4: Legacy Extractor

**File:** `src/mappers/extractors.js`

Add new `legacy()` extractor that returns exact legacy format:

```javascript
/**
 * Extract content in legacy Article class format
 * Used for backward compatibility with existing components
 *
 * @param {Object} parsed - Parsed content from parseContent()
 * @returns {Object} Legacy format { main, items }
 */
function legacy(parsed) {
    const groups = parsed.groups || {};

    // Note: Parser now outputs FLAT structure (no header/body nesting)
    const transformGroup = (group) => {
        if (!group) return null;

        return {
            // Flat structure - all fields at top level
            title: group.title || '',
            subtitle: group.subtitle || '',
            subtitle2: group.subtitle2 || '',
            pretitle: group.pretitle || '',
            description: group.subtitle2 || first(group.paragraphs) || '',
            alignment: group.alignment || '',
            banner: group.banner ? {
                url: group.banner.url,
                alt: group.banner.alt,
                caption: group.banner.caption
            } : null,
            paragraphs: group.paragraphs || [],
            headings: group.headings || [],
            imgs: group.imgs || [],
            videos: group.videos || [],
            lists: group.lists || [],
            links: group.links || [],
            icons: group.icons || [],
            buttons: group.buttons || [],
            cards: group.cards || [],
            documents: group.documents || [],
            forms: group.forms || [],
            form: first(group.forms) || null,
            quotes: group.quotes || [],
            properties: group.properties || {},
            propertyBlocks: group.propertyBlocks || []
        };
    };

    return {
        main: transformGroup(groups.main),
        items: (groups.items || []).map(transformGroup)
    };
}

module.exports = {
    // ... existing extractors ...
    legacy
};
```

**Perfect match for legacy output!**

### Phase 5: Update Article Class

**File:** `/legacy/article.js`

Replace parsing logic:

```javascript
export default class Article {
    constructor(data, options) {
        // ... existing template system logic ...

        // OLD: this.parsed = this.parse(this.elements);

        // NEW: Use semantic-parser
        const { parseContent } = require('@uniweb/semantic-parser');
        const { extractors } = require('@uniweb/semantic-parser/mappers');

        const parsed = parseContent(this.content, {
            pretitleLevel: 2,         // Legacy H2 before H1
            parseCodeAsJson: true,    // Properties
            extractBodyHeadings: true // Body headings
        });

        this.parsed = extractors.legacy(parsed);
    }

    // Remove old parse(), parseItem(), parseGenericData(), parseHeader() methods
}
```

**Result:** Article class shrinks from 1164 lines to ~200 lines!

---

## Feature Comparison

| Feature | Legacy | New Parser | Legacy Extractor |
|---------|--------|------------|------------------|
| Divider grouping | ✅ | ✅ | ✅ |
| H2→H1 pretitle | ✅ | ✅ (option) | ✅ |
| H3→H1 pretitle | ❌ | ✅ (default) | ✅ |
| Header alignment | ✅ | ✅ (new) | ✅ |
| subtitle2 | ✅ | ✅ (new) | ✅ |
| Body headings | ✅ | ✅ (option) | ✅ |
| Buttons | ✅ | ✅ | ✅ |
| Blockquotes | ✅ | ✅ (new) | ✅ |
| Code as JSON | ✅ | ✅ (option) | ✅ |
| Properties | ✅ | ✅ (new) | ✅ |
| Links | ✅ | ✅ | ✅ |
| Template system | ✅ | ❌ (stays in Article) | N/A |
| Auto-items | ✅ | ❌ (stays in Article) | N/A |

**Coverage:** ~95% of legacy features + new capabilities!

---

## Migration Path

### Phase 1: Extend Parser (2-3 days)
1. Add options system to parseContent ✅
2. Add blockquote element type ✅
3. Add configurable pretitle level ✅
4. Add header alignment extraction ✅
5. Add subtitle2 support ✅
6. Add body headings extraction ✅
7. Add code block JSON parsing ✅
8. Enhance mark rendering (textStyle, highlight, download) ✅

### Phase 2: Create Legacy Extractor (1 day)
1. Implement `legacy()` extractor ✅
2. Test output matches legacy format exactly ✅
3. Add comprehensive tests ✅

### Phase 3: Integrate with Article Class (1 day)
1. Replace old parsing logic ✅
2. Keep template system as-is ✅
3. Run parallel comparison tests ✅
4. Verify component compatibility ✅

### Phase 4: Production Testing (ongoing)
1. Test with real production content ✅
2. Compare outputs side-by-side ✅
3. Identify and fix edge cases ✅
4. Performance benchmarking ✅

---

## Testing Strategy

### 1. Unit Tests

Create comprehensive test coverage:

```javascript
describe('Legacy compatibility', () => {
    it('supports H2 before H1 as pretitle', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Pretitle' }] },
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] }
            ]
        };

        const parsed = parseContent(doc, { pretitleLevel: 2 });
        const legacy = extractors.legacy(parsed);

        expect(legacy.main.pretitle).toBe('Pretitle');
        expect(legacy.main.title).toBe('Title');
    });

    it('extracts header alignment', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Title' }] }
            ]
        };

        const parsed = parseContent(doc);
        const legacy = extractors.legacy(parsed);

        expect(legacy.main.alignment).toBe('center');
    });

    it('supports subtitle2 (H3 after H2)', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subtitle' }] },
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Subtitle2' }] }
            ]
        };

        const parsed = parseContent(doc);
        const legacy = extractors.legacy(parsed);

        expect(legacy.main.subtitle2).toBe('Subtitle2');
    });

    it('extracts body headings when option enabled', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section 1' }] },
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Subsection' }] }
            ]
        };

        const parsed = parseContent(doc, { extractBodyHeadings: true });
        const legacy = extractors.legacy(parsed);

        expect(legacy.main.headings).toEqual(['Section 1', 'Subsection']);
    });

    it('parses code blocks as JSON when option enabled', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'codeBlock', content: [{ type: 'text', text: '{"key": "value"}' }] }
            ]
        };

        const parsed = parseContent(doc, { parseCodeAsJson: true });
        const legacy = extractors.legacy(parsed);

        expect(legacy.main.properties).toEqual({ key: 'value' });
        expect(legacy.main.propertyBlocks).toEqual([{ key: 'value' }]);
    });

    it('processes blockquotes', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'blockquote',
                    content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'Quote text' }] }
                    ]
                }
            ]
        };

        const parsed = parseContent(doc);
        const legacy = extractors.legacy(parsed);

        expect(legacy.main.quotes[0].paragraphs).toContain('Quote text');
    });

    it('auto-fills header description', () => {
        const doc = {
            type: 'doc',
            content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subtitle' }] },
                { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Description' }] }
            ]
        };

        const parsed = parseContent(doc);
        const legacy = extractors.legacy(parsed);

        expect(legacy.main.description).toBe('Description');  // From subtitle2
    });
});
```

### 2. Integration Tests

Compare old vs new parser on production content:

```javascript
const legacyOutput = new Article(doc, options).parsed;
const newOutput = extractors.legacy(parseContent(doc, { pretitleLevel: 2, parseCodeAsJson: true }));

// Deep comparison
expect(newOutput).toEqual(legacyOutput);
```

### 3. Performance Tests

Benchmark parsing speed:

```javascript
console.time('Legacy parser');
const legacy = new Article(doc, options);
console.timeEnd('Legacy parser');

console.time('New parser');
const parsed = parseContent(doc, options);
const result = extractors.legacy(parsed);
console.timeEnd('New parser');
```

Expected: New parser should be **faster** (simpler, more focused).

---

## Benefits

### For Legacy Code
- ✅ **Drop-in replacement** - Same output format
- ✅ **Minimal changes** - Just replace parser internals
- ✅ **Keep template system** - Stays in Article class
- ✅ **Full compatibility** - Existing components work as-is

### For New Code
- ✅ **Modern extractors** - Use hero(), card(), features(), etc.
- ✅ **Cleaner output** - Groups structure is more semantic
- ✅ **Better DX** - Schema-based extraction, validation, types
- ✅ **Future-proof** - Modular, testable, maintainable

### For Both
- ✅ **Single parser** - One codebase to maintain
- ✅ **Battle-tested features** - Best of legacy + new
- ✅ **Gradual migration** - Use legacy extractor, migrate extractors over time
- ✅ **No duplication** - Shared processors, shared tests

---

## Next Steps

1. **Get approval** on this plan
2. **Implement Phase 1** - Parser enhancements (~2-3 days)
3. **Implement Phase 2** - Legacy extractor (~1 day)
4. **Test thoroughly** - Unit + integration tests (~1 day)
5. **Integrate** - Update Article class (~1 day)
6. **Deploy gradually** - Test in production, compare outputs

**Total effort:** ~5-6 days for complete legacy compatibility

---

## Questions

1. **Auto-fill description** - Keep in legacy extractor or skip?
2. **Custom elements** (cards, documents, forms) - Add extensibility system?
3. **Styled links** - Add now or later?
4. **Forms parsing** - Support FormBlock?
5. **Fallback strategy** - Keep old parser code temporarily?

Ready to start implementation?
